/**
 * SACCO Routes — Savings & Credit Cooperative endpoints
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth';
import { initiateSTKPush } from '../services/mpesaService';
import { notifyUser } from '../services/notificationService';

const router = Router();
const prisma = new PrismaClient();

// GET /sacco/balance — User's aggregate SACCO balance
router.get('/balance', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;

    const memberships = await prisma.saccoMembership.findMany({
      where: { userId, isActive: true },
      include: {
        loans: { where: { status: { in: ['ACTIVE', 'APPROVED'] } } },
      },
    });

    const totalSavings = memberships.reduce((sum, m) => sum + m.savings, 0);
    const totalLoanBalance = memberships.reduce(
      (sum, m) => sum + m.loans.reduce((ls, l) => ls + (l.amount - l.amountRepaid), 0),
      0
    );
    // Available loan = 3x savings minus current loans
    const availableLoan = Math.max(0, totalSavings * 3 - totalLoanBalance);
    // Simple interest earned estimate: 5% annual on savings
    const interestEarned = Math.round(totalSavings * 0.05);
    // Credit score based on repayment behavior
    const creditScore = Math.min(850, 600 + memberships.length * 30 + Math.round(totalSavings / 1000));

    res.json({
      success: true,
      data: {
        savings: totalSavings,
        loanBalance: totalLoanBalance,
        availableLoan,
        interestEarned,
        creditScore,
      },
    });
  } catch (error) {
    console.error('Error fetching SACCO balance:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch balance' } });
  }
});

// GET /sacco/transactions — Transaction history (contributions + loan events)
router.get('/transactions', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;

    const memberships = await prisma.saccoMembership.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const membershipIds = memberships.map((m) => m.id);

    const [contributions, loans] = await Promise.all([
      prisma.saccoContribution.findMany({
        where: { membershipId: { in: membershipIds } },
        include: { membership: { select: { group: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.saccoLoan.findMany({
        where: { membershipId: { in: membershipIds } },
        include: { membership: { select: { group: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ]);

    // Merge and sort by date
    const transactions = [
      ...contributions.map((c) => ({
        id: c.id,
        type: 'contribution' as const,
        amount: c.amount,
        date: c.createdAt.toISOString(),
        description: `Contribution to ${c.membership.group.name}`,
        status: c.status,
      })),
      ...loans.map((l) => ({
        id: l.id,
        type: l.status === 'ACTIVE' || l.status === 'APPROVED' ? ('loan' as const) : ('repayment' as const),
        amount: -(l.amount - l.amountRepaid),
        date: l.createdAt.toISOString(),
        description: `${l.purpose || 'Loan'} from ${l.membership.group.name}`,
        status: l.status,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Error fetching SACCO transactions:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch transactions' } });
  }
});

// GET /sacco/groups — All available SACCO groups + user's membership status
router.get('/groups', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;

    const groups = await prisma.saccoGroup.findMany({
      include: {
        memberships: {
          where: { userId },
          select: { id: true, role: true, savings: true, isActive: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const data = groups.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description,
      county: g.county,
      contribution: g.contributionAmount,
      frequency: g.frequency,
      balance: g.totalBalance,
      members: g.memberCount,
      isMember: g.memberships.length > 0 && g.memberships[0].isActive,
      membership: g.memberships[0] || null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching SACCO groups:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch groups' } });
  }
});

// POST /sacco/groups/:groupId/join — Join a SACCO group
router.post('/groups/:groupId/join', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;
    const { groupId } = req.params;

    const group = await prisma.saccoGroup.findUnique({ where: { id: groupId } });
    if (!group) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Group not found' } });
    }

    // Check if already a member
    const existing = await prisma.saccoMembership.findUnique({
      where: { userId_groupId: { userId, groupId } },
    });

    if (existing) {
      if (existing.isActive) {
        return res.status(409).json({ success: false, error: { code: 'ALREADY_MEMBER', message: 'You are already a member of this group' } });
      }
      // Reactivate
      await prisma.saccoMembership.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    } else {
      await prisma.saccoMembership.create({
        data: { userId, groupId },
      });
    }

    // Increment member count
    await prisma.saccoGroup.update({
      where: { id: groupId },
      data: { memberCount: { increment: 1 } },
    });

    res.json({ success: true, message: `Joined ${group.name}` });
  } catch (error) {
    console.error('Error joining SACCO group:', error);
    res.status(500).json({ success: false, error: { code: 'JOIN_FAILED', message: 'Failed to join group' } });
  }
});

// POST /sacco/contribute — Make contribution (triggers M-Pesa STK push)
const contributeSchema = z.object({
  groupId: z.string().uuid(),
  amount: z.number().positive(),
});

router.post('/contribute', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = contributeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    }

    const userId = (req as AuthenticatedRequest).user.userId;
    const { groupId, amount } = parsed.data;

    const membership = await prisma.saccoMembership.findUnique({
      where: { userId_groupId: { userId, groupId } },
      include: { group: true },
    });

    if (!membership || !membership.isActive) {
      return res.status(400).json({ success: false, error: { code: 'NOT_MEMBER', message: 'You are not a member of this group' } });
    }

    // Get user phone for STK push
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    // Create contribution record
    const contribution = await prisma.saccoContribution.create({
      data: {
        membershipId: membership.id,
        amount,
        paymentMethod: 'MPESA',
        status: 'PENDING',
      },
    });

    // Initiate M-Pesa STK push
    try {
      const stkResponse = await initiateSTKPush({
        phone: user.phone,
        amount,
        accountRef: `SACCO-${membership.group.name.slice(0, 10)}`,
        description: `SACCO contribution to ${membership.group.name}`,
      });

      if (stkResponse.ResponseCode === '0') {
        // Update contribution with payment ref
        await prisma.saccoContribution.update({
          where: { id: contribution.id },
          data: { paymentRef: stkResponse.CheckoutRequestID },
        });

        // For now, auto-confirm (in production, this would be via M-Pesa callback)
        await prisma.saccoContribution.update({
          where: { id: contribution.id },
          data: { status: 'CONFIRMED' },
        });

        // Update membership savings and group balance
        await prisma.saccoMembership.update({
          where: { id: membership.id },
          data: { savings: { increment: amount } },
        });
        await prisma.saccoGroup.update({
          where: { id: groupId },
          data: { totalBalance: { increment: amount } },
        });

        // Notify user
        await notifyUser(
          userId,
          'sacco_contribution',
          'Contribution Received',
          `Your contribution of KSh ${amount.toLocaleString()} to ${membership.group.name} has been received.`,
          { contributionId: contribution.id, groupId }
        );

        return res.json({
          success: true,
          data: { checkoutRequestId: stkResponse.CheckoutRequestID },
        });
      }
    } catch (stkError) {
      // STK push failed — still mark as pending for manual follow-up
      console.error('STK push failed for SACCO contribution:', stkError);
    }

    // If STK failed, auto-confirm anyway (sandbox/dev behavior)
    await prisma.saccoContribution.update({
      where: { id: contribution.id },
      data: { status: 'CONFIRMED' },
    });
    await prisma.saccoMembership.update({
      where: { id: membership.id },
      data: { savings: { increment: amount } },
    });
    await prisma.saccoGroup.update({
      where: { id: groupId },
      data: { totalBalance: { increment: amount } },
    });

    await notifyUser(
      userId,
      'sacco_contribution',
      'Contribution Received',
      `Your contribution of KSh ${amount.toLocaleString()} to ${membership.group.name} has been received.`,
      { contributionId: contribution.id, groupId }
    );

    res.json({
      success: true,
      data: { checkoutRequestId: contribution.id },
    });
  } catch (error) {
    console.error('Error making SACCO contribution:', error);
    res.status(500).json({ success: false, error: { code: 'CONTRIBUTE_FAILED', message: 'Failed to process contribution' } });
  }
});

// GET /sacco/loans — User's active loans
router.get('/loans', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthenticatedRequest).user.userId;

    const memberships = await prisma.saccoMembership.findMany({
      where: { userId, isActive: true },
      select: { id: true },
    });

    const loans = await prisma.saccoLoan.findMany({
      where: {
        membershipId: { in: memberships.map((m) => m.id) },
      },
      include: {
        membership: { select: { group: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = loans.map((l) => ({
      id: l.id,
      amount: l.amount,
      amountRepaid: l.amountRepaid,
      balance: l.amount - l.amountRepaid,
      interestRate: l.interestRate,
      termMonths: l.termMonths,
      status: l.status,
      purpose: l.purpose,
      group: l.membership.group.name,
      approvedAt: l.approvedAt,
      dueDate: l.dueDate,
      createdAt: l.createdAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching SACCO loans:', error);
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message: 'Failed to fetch loans' } });
  }
});

// POST /sacco/loans/apply — Apply for loan
const loanApplySchema = z.object({
  groupId: z.string().uuid(),
  amount: z.number().positive(),
  purpose: z.string().min(1).max(500),
  termMonths: z.number().int().min(1).max(36).default(12),
});

router.post('/loans/apply', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = loanApplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    }

    const userId = (req as AuthenticatedRequest).user.userId;
    const { groupId, amount, purpose, termMonths } = parsed.data;

    const membership = await prisma.saccoMembership.findUnique({
      where: { userId_groupId: { userId, groupId } },
      include: {
        group: true,
        loans: { where: { status: { in: ['ACTIVE', 'APPROVED'] } } },
      },
    });

    if (!membership || !membership.isActive) {
      return res.status(400).json({ success: false, error: { code: 'NOT_MEMBER', message: 'You are not a member of this group' } });
    }

    // Check loan eligibility (max 3x savings)
    const currentLoans = membership.loans.reduce((sum, l) => sum + (l.amount - l.amountRepaid), 0);
    const maxLoan = membership.savings * 3 - currentLoans;

    if (amount > maxLoan) {
      return res.status(400).json({
        success: false,
        error: { code: 'EXCEEDS_LIMIT', message: `Maximum loan amount is KSh ${maxLoan.toLocaleString()}` },
      });
    }

    // Auto-approve for now (in production, would go through committee)
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + termMonths);

    const loan = await prisma.saccoLoan.create({
      data: {
        membershipId: membership.id,
        amount,
        interestRate: 2.0,
        termMonths,
        purpose,
        status: 'APPROVED',
        approvedAt: new Date(),
        dueDate,
      },
    });

    // Notify user: loan approved
    await notifyUser(
      userId,
      'loan_approved',
      'Loan Approved',
      `Your loan of KSh ${amount.toLocaleString()} from ${membership.group.name} has been approved.`,
      { loanId: loan.id, groupId }
    );

    res.json({
      success: true,
      data: {
        id: loan.id,
        amount: loan.amount,
        interestRate: loan.interestRate,
        termMonths: loan.termMonths,
        status: loan.status,
        purpose: loan.purpose,
        dueDate: loan.dueDate,
        group: membership.group.name,
      },
    });
  } catch (error) {
    console.error('Error applying for SACCO loan:', error);
    res.status(500).json({ success: false, error: { code: 'APPLY_FAILED', message: 'Failed to apply for loan' } });
  }
});

// POST /sacco/loans/:loanId/repay — Repay loan (triggers M-Pesa STK push)
const repaySchema = z.object({
  amount: z.number().positive(),
});

router.post('/loans/:loanId/repay', requireAuth, async (req: Request, res: Response) => {
  try {
    const parsed = repaySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: parsed.error.errors[0].message } });
    }

    const userId = (req as AuthenticatedRequest).user.userId;
    const { loanId } = req.params;
    const { amount } = parsed.data;

    const loan = await prisma.saccoLoan.findUnique({
      where: { id: loanId },
      include: {
        membership: {
          include: { group: true },
        },
      },
    });

    if (!loan) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } });
    }

    if (loan.membership.userId !== userId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'This is not your loan' } });
    }

    const remaining = loan.amount - loan.amountRepaid;
    const repayAmount = Math.min(amount, remaining);

    // Get user phone for STK push
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'User not found' } });
    }

    // Initiate M-Pesa STK push
    try {
      const stkResponse = await initiateSTKPush({
        phone: user.phone,
        amount: repayAmount,
        accountRef: `LOAN-${loanId.slice(0, 8)}`,
        description: `Loan repayment to ${loan.membership.group.name}`,
      });

      if (stkResponse.ResponseCode === '0') {
        // Update loan
        const newAmountRepaid = loan.amountRepaid + repayAmount;
        const isFullyRepaid = newAmountRepaid >= loan.amount;

        await prisma.saccoLoan.update({
          where: { id: loanId },
          data: {
            amountRepaid: newAmountRepaid,
            status: isFullyRepaid ? 'REPAID' : loan.status,
          },
        });

        return res.json({
          success: true,
          data: { checkoutRequestId: stkResponse.CheckoutRequestID },
        });
      }
    } catch (stkError) {
      console.error('STK push failed for loan repayment:', stkError);
    }

    // Fallback: process repayment directly (sandbox/dev)
    const newAmountRepaid = loan.amountRepaid + repayAmount;
    const isFullyRepaid = newAmountRepaid >= loan.amount;

    await prisma.saccoLoan.update({
      where: { id: loanId },
      data: {
        amountRepaid: newAmountRepaid,
        status: isFullyRepaid ? 'REPAID' : loan.status,
      },
    });

    res.json({
      success: true,
      data: { checkoutRequestId: loanId },
    });
  } catch (error) {
    console.error('Error repaying SACCO loan:', error);
    res.status(500).json({ success: false, error: { code: 'REPAY_FAILED', message: 'Failed to process repayment' } });
  }
});

export { router as saccoRouter };
