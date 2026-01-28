import { Router, Request, Response } from 'express';

const router = Router();

// Swahili crop keywords
const cropKeywords: Record<string, string> = {
  nyanya: 'tomato',
  viazi: 'potato',
  vitunguu: 'onion',
  kabichi: 'cabbage',
  karoti: 'carrot',
  sukuma: 'sukuma',
  spinachi: 'spinach',
  tomato: 'tomato',
  potato: 'potato',
  onion: 'onion',
};

// Mock prices
const prices: Record<string, number> = {
  tomato: 80,
  potato: 60,
  onion: 70,
  cabbage: 40,
  carrot: 50,
  sukuma: 20,
  spinach: 30,
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

function generateResponse(intent: string, crop?: string, lang: string = 'sw'): string {
  if (intent === 'help') {
    return lang === 'sw'
      ? 'Tuma "bei nyanya" kupata bei ya soko. Mazao: nyanya, viazi, vitunguu, kabichi, karoti, sukuma'
      : 'Send "bei tomato" to get market price. Crops: tomato, potato, onion, cabbage, carrot, sukuma';
  }

  if (intent === 'price_check' && crop) {
    const price = prices[crop];
    if (price) {
      return lang === 'sw'
        ? `Bei ya ${crop}: KSh ${price}/kg (Wakulima Market)`
        : `${crop} price: KSh ${price}/kg (Wakulima Market)`;
    }
  }

  return lang === 'sw'
    ? 'Samahani, sijui hilo. Tuma "msaada" kwa usaidizi.'
    : 'Sorry, I did not understand. Send "help" for assistance.';
}

// POST /api/v1/sms/incoming - Africa's Talking webhook
router.post('/incoming', async (req: Request, res: Response) => {
  const { from, text, to } = req.body;

  console.log(`[SMS] From: ${from}, Text: ${text}`);

  const { intent, crop } = parseMessage(text || '');
  const response = generateResponse(intent, crop);

  // Log for audit
  console.log(`[SMS Response] To: ${from}, Message: ${response}`);

  // TODO: Send response via Africa's Talking API
  // For now just return what we would send
  res.json({
    success: true,
    data: {
      from,
      text,
      intent,
      crop,
      response,
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
  const response = generateResponse(intent, crop);

  res.json({
    success: true,
    data: { input: message, intent, crop, response },
  });
});

export { router as smsRouter };
