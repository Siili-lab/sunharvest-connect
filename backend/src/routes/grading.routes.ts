import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireFarmer, requireAdmin, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// POST /api/v1/grading/:id/dispute — farmer disputes a grade (verify grading belongs to user)
router.post('/:id/dispute', requireAuth, requireFarmer, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthenticatedRequest).user.userId;
    const { reason } = req.body;

    const gradingResult = await prisma.gradingResult.findUnique({ where: { id } });
    if (!gradingResult) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Grading result not found' },
      });
    }

    if (gradingResult.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only dispute your own grading results.' },
      });
    }

    if (gradingResult.isDisputed) {
      return res.status(400).json({
        success: false,
        error: { code: 'ALREADY_DISPUTED', message: 'This grading result is already disputed' },
      });
    }

    const updated = await prisma.gradingResult.update({
      where: { id },
      data: {
        isDisputed: true,
        reviewStatus: 'PENDING_REVIEW',
        reviewNotes: reason || null,
      },
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        isDisputed: updated.isDisputed,
        reviewStatus: updated.reviewStatus,
        grade: updated.grade,
      },
    });
  } catch (error) {
    console.error('Error disputing grading result:', error);
    res.status(500).json({
      success: false,
      error: { code: 'DISPUTE_FAILED', message: 'Failed to dispute grading result' },
    });
  }
});

// GET /api/v1/grading/pending-reviews — admin gets disputed grades needing review
router.get('/pending-reviews', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { limit = '50' } = req.query;

    const results = await prisma.gradingResult.findMany({
      where: {
        isDisputed: true,
        reviewStatus: 'PENDING_REVIEW',
      },
      include: {
        user: {
          select: { id: true, name: true, phone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    const data = results.map((r) => ({
      id: r.id,
      cropType: r.cropType,
      grade: r.grade,
      confidence: r.confidence,
      defects: r.defects,
      imageUrl: r.imageUrl,
      modelVersion: r.modelVersion,
      reviewNotes: r.reviewNotes,
      user: r.user,
      createdAt: r.createdAt,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching pending reviews:', error);
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message: 'Failed to fetch pending reviews' },
    });
  }
});

// PUT /api/v1/grading/:id/review — admin approves or overrides grade (use token userId as reviewedBy)
router.put('/:id/review', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const reviewedBy = (req as AuthenticatedRequest).user.userId;
    const { action, newGrade, notes } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        error: { code: 'MISSING_FIELDS', message: 'action is required' },
      });
    }

    if (action !== 'approve' && action !== 'override') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_ACTION', message: 'action must be "approve" or "override"' },
      });
    }

    const gradingResult = await prisma.gradingResult.findUnique({ where: { id } });
    if (!gradingResult) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Grading result not found' },
      });
    }

    const updateData: any = {
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes: notes || gradingResult.reviewNotes,
    };

    if (action === 'approve') {
      updateData.reviewStatus = 'APPROVED';
    } else if (action === 'override') {
      if (!newGrade) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_GRADE', message: 'newGrade is required when overriding' },
        });
      }
      updateData.reviewStatus = 'OVERRIDDEN';
      updateData.originalGrade = gradingResult.grade;
      updateData.grade = newGrade;
    }

    const updated = await prisma.gradingResult.update({
      where: { id },
      data: updateData,
    });

    res.json({
      success: true,
      data: {
        id: updated.id,
        grade: updated.grade,
        originalGrade: updated.originalGrade,
        reviewStatus: updated.reviewStatus,
        reviewedBy: updated.reviewedBy,
        reviewedAt: updated.reviewedAt,
      },
    });
  } catch (error) {
    console.error('Error reviewing grading result:', error);
    res.status(500).json({
      success: false,
      error: { code: 'REVIEW_FAILED', message: 'Failed to review grading result' },
    });
  }
});

export { router as gradingRouter };
