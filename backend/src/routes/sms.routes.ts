import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { mapCropToEnum } from '../utils/cropMapping';
import { calculateTrends, BASE_PRICES } from '../services/marketDataService';

const router = Router();
const prisma = new PrismaClient();

// Africa's Talking SDK initialization
let atSms: any = null;
const AT_USERNAME = process.env.AT_USERNAME;
const AT_API_KEY = process.env.AT_API_KEY;
const AT_SENDER_ID = process.env.AT_SENDER_ID;

if (AT_USERNAME && AT_API_KEY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AfricasTalking = require('africastalking');
    const at = AfricasTalking({
      apiKey: AT_API_KEY,
      username: AT_USERNAME,
    });
    atSms = at.SMS;
    console.log('[SMS] Africa\'s Talking SDK initialized');
  } catch (err) {
    console.warn('[SMS] Failed to initialize Africa\'s Talking SDK:', err);
  }
} else {
  console.warn('[SMS] AT_USERNAME / AT_API_KEY not set — SMS sending disabled');
}

// Swahili crop keywords
const cropKeywords: Record<string, string> = {
  nyanya: 'tomato',
  viazi: 'potato',
  vitunguu: 'onion',
  kabichi: 'cabbage',
  karoti: 'carrot',
  sukuma: 'kale',
  spinachi: 'spinach',
  tomato: 'tomato',
  potato: 'potato',
  onion: 'onion',
  mango: 'mango',
  avocado: 'avocado',
  ndizi: 'banana',
  banana: 'banana',
};

function parseMessage(text: string): { intent: string; crop?: string } {
  const lower = text.toLowerCase().trim();

  // Check for price query: "bei nyanya" or "price tomato"
  if (lower.startsWith('bei ') || lower.startsWith('price ')) {
    const cropWord = lower.replace(/^(bei|price)\s+/, '');
    const crop = cropKeywords[cropWord];
    if (crop) {
      return { intent: 'price_check', crop };
    }
  }

  // Check for help
  if (lower === 'help' || lower === 'msaada') {
    return { intent: 'help' };
  }

  // Check for any crop keyword
  for (const [keyword, crop] of Object.entries(cropKeywords)) {
    if (lower.includes(keyword)) {
      return { intent: 'price_check', crop };
    }
  }

  return { intent: 'unknown' };
}

async function getMarketPrice(crop: string): Promise<{ price: number; trend: string } | null> {
  try {
    const cropEnum = mapCropToEnum(crop);
    const trends = await calculateTrends(cropEnum);
    return { price: trends.currentPrice, trend: trends.trend };
  } catch {
    // Fallback to static base prices
    const cropEnum = mapCropToEnum(crop);
    const base = BASE_PRICES[cropEnum];
    if (base) {
      return { price: base.avg, trend: 'STABLE' };
    }
    return null;
  }
}

async function generateResponse(intent: string, crop?: string, lang: string = 'sw'): Promise<string> {
  if (intent === 'help') {
    return lang === 'sw'
      ? 'Tuma "bei nyanya" kupata bei ya soko. Mazao: nyanya, viazi, vitunguu, kabichi, karoti, sukuma'
      : 'Send "bei tomato" to get market price. Crops: tomato, potato, onion, cabbage, carrot, sukuma';
  }

  if (intent === 'price_check' && crop) {
    const marketData = await getMarketPrice(crop);
    if (marketData) {
      const trendEmoji = marketData.trend === 'RISING' ? '↑' : marketData.trend === 'FALLING' ? '↓' : '→';
      return lang === 'sw'
        ? `Bei ya ${crop}: KSh ${marketData.price}/kg ${trendEmoji} (Wakulima Market)`
        : `${crop} price: KSh ${marketData.price}/kg ${trendEmoji} (Wakulima Market)`;
    }
  }

  return lang === 'sw'
    ? 'Samahani, sijui hilo. Tuma "msaada" kwa usaidizi.'
    : 'Sorry, I did not understand. Send "help" for assistance.';
}

async function sendSms(to: string, message: string): Promise<string | null> {
  if (!atSms) {
    console.warn('[SMS] Sending disabled — no AT credentials. Would send to', to);
    return null;
  }

  try {
    const options: any = { to: [to], message };
    if (AT_SENDER_ID) {
      options.from = AT_SENDER_ID;
    }
    const result = await atSms.send(options);
    const recipient = result?.SMSMessageData?.Recipients?.[0];
    return recipient?.messageId || null;
  } catch (err) {
    console.error('[SMS] Failed to send SMS:', err);
    return null;
  }
}

async function logSms(
  phone: string,
  direction: 'INBOUND' | 'OUTBOUND',
  message: string,
  intent?: string,
  entities?: any,
  atMessageId?: string | null,
): Promise<void> {
  try {
    // Try to find user by phone
    const user = await prisma.user.findUnique({ where: { phone } });

    await prisma.smsLog.create({
      data: {
        userId: user?.id || null,
        phone,
        direction,
        message,
        intent: intent || null,
        entities: entities || null,
        atMessageId: atMessageId || null,
        status: direction === 'INBOUND' ? 'DELIVERED' : (atMessageId ? 'SENT' : 'PENDING'),
      },
    });
  } catch (err) {
    console.error('[SMS] Failed to log SMS:', err);
  }
}

// POST /api/v1/sms/incoming - Africa's Talking webhook
router.post('/incoming', async (req: Request, res: Response) => {
  const { from, text, to } = req.body;

  console.log(`[SMS] From: ${from}, Text: ${text}`);

  const { intent, crop } = parseMessage(text || '');
  const response = await generateResponse(intent, crop);

  // Log inbound message
  await logSms(from, 'INBOUND', text || '', intent, crop ? { crop } : null);

  // Send reply via Africa's Talking
  const atMessageId = await sendSms(from, response);

  // Log outbound message
  await logSms(from, 'OUTBOUND', response, intent, crop ? { crop } : null, atMessageId);

  console.log(`[SMS Response] To: ${from}, Message: ${response}`);

  res.json({
    success: true,
    data: {
      from,
      text,
      intent,
      crop,
      response,
      sent: !!atMessageId,
    },
  });
});

// GET /api/v1/sms/test - Test SMS parsing
router.get('/test', async (req: Request, res: Response) => {
  const { message } = req.query;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Provide ?message=bei nyanya' },
    });
  }

  const { intent, crop } = parseMessage(message);
  const response = await generateResponse(intent, crop);

  res.json({
    success: true,
    data: { input: message, intent, crop, response },
  });
});

export { router as smsRouter };
