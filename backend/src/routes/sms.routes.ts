import { Router, Request, Response } from 'express';
import { PrismaClient, CropType, ListingStatus } from '@prisma/client';
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

// -------------------------------------------------------------------
// NLP: Crop keywords (English + Swahili)
// -------------------------------------------------------------------
const cropKeywords: Record<string, string> = {
  nyanya: 'tomato', tomato: 'tomato', tomatoes: 'tomato',
  viazi: 'potato', potato: 'potato', potatoes: 'potato',
  vitunguu: 'onion', onion: 'onion', onions: 'onion',
  kabichi: 'cabbage', cabbage: 'cabbage',
  karoti: 'carrot', carrot: 'carrot', carrots: 'carrot',
  sukuma: 'kale', kale: 'kale', sukumawiki: 'kale',
  spinachi: 'spinach', spinach: 'spinach',
  embe: 'mango', mango: 'mango', mangoes: 'mango', maembe: 'mango',
  parachichi: 'avocado', avocado: 'avocado',
  ndizi: 'banana', banana: 'banana', bananas: 'banana',
  chungwa: 'orange', orange: 'orange', machungwa: 'orange',
  pilipili: 'pepper', pepper: 'pepper',
};

// Kenya county keywords (for entity extraction from SMS)
const countyKeywords: Record<string, string> = {
  nairobi: 'Nairobi', nbi: 'Nairobi',
  mombasa: 'Mombasa', msa: 'Mombasa',
  kisumu: 'Kisumu',
  nakuru: 'Nakuru',
  kiambu: 'Kiambu',
  eldoret: 'Uasin Gishu',
  meru: 'Meru',
  embu: 'Embu',
  machakos: 'Machakos',
  nyeri: 'Nyeri',
  muranga: 'Murang\'a', "murang'a": 'Murang\'a',
  nyandarua: 'Nyandarua',
  kajiado: 'Kajiado',
  kirinyaga: 'Kirinyaga',
  transnzoia: 'Trans Nzoia', kitale: 'Trans Nzoia',
};

// -------------------------------------------------------------------
// Intent & Entity Parsing
// -------------------------------------------------------------------
interface ParsedMessage {
  intent: string;
  crop?: string;
  quantity?: number;
  unit?: string;
  location?: string;
  lang: 'sw' | 'en';
}

function parseMessage(text: string): ParsedMessage {
  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/);

  // Detect language: Swahili keywords → sw, else en
  const swKeywords = ['bei', 'nina', 'nataka', 'msaada', 'angalia', 'nunua', 'uza', 'hali'];
  const lang = swKeywords.some(kw => lower.includes(kw)) ? 'sw' : 'en';

  // Extract crop
  let crop: string | undefined;
  for (const word of words) {
    if (cropKeywords[word]) {
      crop = cropKeywords[word];
      break;
    }
  }

  // Extract quantity (number + optional unit)
  let quantity: number | undefined;
  let unit: string | undefined = 'kg';
  const qtyMatch = lower.match(/(\d+)\s*(kg|kgs|bags?|crates?|pieces?|bunches?)?/i);
  if (qtyMatch) {
    quantity = parseInt(qtyMatch[1], 10);
    if (qtyMatch[2]) {
      const u = qtyMatch[2].toLowerCase().replace(/s$/, '');
      unit = u === 'bag' ? 'bag' : u === 'crate' ? 'crate' : u === 'piece' ? 'piece' : u === 'bunch' ? 'bunch' : 'kg';
    }
  }

  // Extract location (county)
  let location: string | undefined;
  for (const word of words) {
    if (countyKeywords[word]) {
      location = countyKeywords[word];
      break;
    }
  }

  // --- Intent classification ---

  // HELP: "help", "msaada"
  if (lower === 'help' || lower === 'msaada') {
    return { intent: 'help', lang };
  }

  // LIST_PRODUCE: "nina nyanya 50kg Embu" or "sell tomato 30kg Nakuru"
  // Pattern: "nina/sell/uza" + crop + quantity + location
  if (lower.startsWith('nina ') || lower.startsWith('sell ') || lower.startsWith('uza ')) {
    return { intent: 'list_produce', crop, quantity, unit, location, lang };
  }

  // FIND_BUYER: "buyer tomato Nairobi" or "nunua nyanya"
  if (lower.startsWith('buyer ') || lower.startsWith('nunua ') || lower.startsWith('find buyer')) {
    return { intent: 'find_buyer', crop, location, lang };
  }

  // CHECK_ORDER: "order", "status", "hali"
  if (lower.startsWith('order') || lower.startsWith('status') || lower.startsWith('hali')) {
    return { intent: 'check_order', lang };
  }

  // PRICE_CHECK: "bei nyanya" or "price tomato"
  if (lower.startsWith('bei ') || lower.startsWith('price ')) {
    const cropWord = lower.replace(/^(bei|price)\s+/, '').split(/\s/)[0];
    const priceCrop = cropKeywords[cropWord] || crop;
    return { intent: 'price_check', crop: priceCrop, lang };
  }

  // Fallback: if a crop keyword is found, default to price check
  if (crop) {
    return { intent: 'price_check', crop, lang };
  }

  return { intent: 'unknown', lang };
}

// -------------------------------------------------------------------
// Market price lookup
// -------------------------------------------------------------------
async function getMarketPrice(crop: string): Promise<{ price: number; trend: string } | null> {
  try {
    const cropEnum = mapCropToEnum(crop);
    const trends = await calculateTrends(cropEnum);
    return { price: trends.currentPrice, trend: trends.trend };
  } catch {
    const cropEnum = mapCropToEnum(crop);
    const base = BASE_PRICES[cropEnum];
    if (base) {
      return { price: base.avg, trend: 'STABLE' };
    }
    return null;
  }
}

// -------------------------------------------------------------------
// Create SMS listing for a farmer
// -------------------------------------------------------------------
async function createSmsListing(
  phone: string,
  crop: string,
  quantity: number,
  location: string,
): Promise<{ success: boolean; listingId?: string; price?: number }> {
  // Find the user by phone
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) {
    return { success: false };
  }

  // Get market price for pricing suggestion
  const marketData = await getMarketPrice(crop);
  const price = marketData?.price || BASE_PRICES[mapCropToEnum(crop)]?.avg || 50;

  const cropEnum = mapCropToEnum(crop);

  const listing = await prisma.produceListing.create({
    data: {
      farmerId: user.id,
      cropType: cropEnum,
      qualityGrade: 'GRADE_A', // Default for SMS listings (no camera available)
      priceAmount: price,
      quantity,
      county: location,
      images: [],
      status: 'ACTIVE' as ListingStatus,
      availableUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  return { success: true, listingId: listing.id, price };
}

// -------------------------------------------------------------------
// Check user's recent orders
// -------------------------------------------------------------------
async function checkUserOrders(phone: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { phone } });
  if (!user) return null;

  // Find recent transactions involving this user
  const transactions = await prisma.transaction.findMany({
    where: {
      OR: [
        { buyerId: user.id },
        { listing: { farmerId: user.id } },
      ],
      status: { not: 'COMPLETED' },
    },
    include: {
      listing: { select: { cropType: true, quantity: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  return transactions.length > 0
    ? transactions.map(t =>
        `${t.listing.cropType.toLowerCase()} ${t.listing.quantity}kg - ${t.status}`
      ).join('\n')
    : null;
}

// -------------------------------------------------------------------
// Find active buyers for a crop
// -------------------------------------------------------------------
async function findBuyers(crop: string, county?: string): Promise<number> {
  const cropEnum = mapCropToEnum(crop);

  // Count recent transactions as buyer activity indicator
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const count = await prisma.transaction.count({
    where: {
      listing: {
        cropType: cropEnum,
        ...(county && { county }),
      },
      createdAt: { gte: thirtyDaysAgo },
    },
  });

  return count;
}

// -------------------------------------------------------------------
// Response generation
// -------------------------------------------------------------------
async function generateResponse(parsed: ParsedMessage): Promise<string> {
  const { intent, crop, quantity, location, lang } = parsed;
  const sw = lang === 'sw';

  if (intent === 'help') {
    return sw
      ? 'SunHarvest Connect:\n' +
        '• "bei nyanya" - bei ya soko\n' +
        '• "nina nyanya 50kg Embu" - tangaza mazao\n' +
        '• "nunua nyanya" - tafuta wanunuzi\n' +
        '• "hali" - angalia oda zako\n' +
        'Mazao: nyanya, viazi, vitunguu, kabichi, karoti, sukuma, embe, parachichi, ndizi'
      : 'SunHarvest Connect:\n' +
        '• "price tomato" - market price\n' +
        '• "sell tomato 50kg Embu" - list produce\n' +
        '• "buyer tomato" - find buyers\n' +
        '• "status" - check your orders\n' +
        'Crops: tomato, potato, onion, cabbage, carrot, kale, mango, avocado, banana';
  }

  if (intent === 'price_check' && crop) {
    const marketData = await getMarketPrice(crop);
    if (marketData) {
      const trendIcon = marketData.trend === 'RISING' ? '↑' : marketData.trend === 'FALLING' ? '↓' : '→';
      return sw
        ? `Bei ya ${crop}: KSh ${marketData.price}/kg ${trendIcon} (Wakulima Market). Tangaza uuze: tuma "nina ${crop} [kilo] [eneo]"`
        : `${crop} price: KSh ${marketData.price}/kg ${trendIcon} (Wakulima Market). To sell: send "sell ${crop} [kg] [county]"`;
    }
  }

  if (intent === 'list_produce') {
    if (!crop) {
      return sw
        ? 'Taja zao lako. Mfano: "nina nyanya 50kg Embu"'
        : 'Specify your crop. Example: "sell tomato 50kg Embu"';
    }
    if (!quantity) {
      return sw
        ? `Taja kilo. Mfano: "nina ${crop} 50kg ${location || 'Nairobi'}"`
        : `Specify quantity. Example: "sell ${crop} 50kg ${location || 'Nairobi'}"`;
    }
    if (!location) {
      return sw
        ? `Taja eneo lako. Mfano: "nina ${crop} ${quantity}kg Embu"`
        : `Specify your county. Example: "sell ${crop} ${quantity}kg Embu"`;
    }

    // All fields present — attempt to create listing
    // We need the user's phone which will come from the webhook caller
    return `__CREATE_LISTING__:${crop}:${quantity}:${location}`;
  }

  if (intent === 'find_buyer' && crop) {
    const buyerCount = await findBuyers(crop, location);
    const marketData = await getMarketPrice(crop);
    const priceStr = marketData ? `KSh ${marketData.price}/kg` : '';

    if (buyerCount > 0) {
      return sw
        ? `Wanunuzi ${buyerCount} wa ${crop} wamepatikana${location ? ` ${location}` : ''}. Bei: ${priceStr}. Tangaza: "nina ${crop} [kilo] [eneo]"`
        : `${buyerCount} recent ${crop} buyers found${location ? ` in ${location}` : ''}. Price: ${priceStr}. List: "sell ${crop} [kg] [county]"`;
    } else {
      return sw
        ? `Hakuna wanunuzi wa ${crop} sasa hivi. Tangaza uuze na wanunuzi watawasiliana nawe.`
        : `No recent ${crop} buyers found. Create a listing and buyers will contact you.`;
    }
  }

  if (intent === 'check_order') {
    // check_order needs the user phone, handled in the webhook
    return '__CHECK_ORDER__';
  }

  return sw
    ? 'Samahani, sijui hilo. Tuma "msaada" kwa usaidizi.'
    : 'Sorry, I did not understand. Send "help" for assistance.';
}

// -------------------------------------------------------------------
// SMS sending
// -------------------------------------------------------------------
async function sendSms(to: string, message: string): Promise<string | null> {
  if (!atSms) {
    console.warn('[SMS] Sending disabled — no AT credentials. Would send to', to, ':', message);
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

// -------------------------------------------------------------------
// SMS logging
// -------------------------------------------------------------------
async function logSms(
  phone: string,
  direction: 'INBOUND' | 'OUTBOUND',
  message: string,
  intent?: string,
  entities?: any,
  atMessageId?: string | null,
): Promise<void> {
  try {
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

// -------------------------------------------------------------------
// POST /api/v1/sms/incoming — Africa's Talking webhook
// -------------------------------------------------------------------
router.post('/incoming', async (req: Request, res: Response) => {
  const { from, text, to } = req.body;
  if (!from || typeof from !== 'string' || !from.startsWith('+')) {
    return res.status(400).json({ success: false, error: { message: 'Invalid webhook payload' } });
  }

  console.log(`[SMS] From: ${from}, Text: ${text}`);

  const parsed = parseMessage(text || '');
  let response = await generateResponse(parsed);

  // Handle special response markers that need the user's phone
  if (response.startsWith('__CREATE_LISTING__:')) {
    const parts = response.split(':');
    const [, crop, qty, loc] = parts;
    const result = await createSmsListing(from, crop, parseInt(qty, 10), loc);

    if (result.success) {
      response = parsed.lang === 'sw'
        ? `Orodha imeundwa! ${crop} ${qty}kg huko ${loc} kwa KSh ${result.price}/kg. Wanunuzi watawasiliana nawe.`
        : `Listing created! ${crop} ${qty}kg in ${loc} at KSh ${result.price}/kg. Buyers will contact you.`;
    } else {
      response = parsed.lang === 'sw'
        ? 'Jiandikishe kwanza kwenye SunHarvest Connect kupitia simu janja au tuma nambari yako kwa msaada.'
        : 'Please register on SunHarvest Connect app first, or contact support.';
    }
  } else if (response === '__CHECK_ORDER__') {
    const orders = await checkUserOrders(from);
    if (orders) {
      response = parsed.lang === 'sw'
        ? `Oda zako:\n${orders}`
        : `Your orders:\n${orders}`;
    } else {
      response = parsed.lang === 'sw'
        ? 'Hakuna oda zinazofanya kazi sasa hivi.'
        : 'No active orders found.';
    }
  }

  const entities = {
    ...(parsed.crop && { crop: parsed.crop }),
    ...(parsed.quantity && { quantity: parsed.quantity }),
    ...(parsed.location && { location: parsed.location }),
  };

  // Log inbound
  await logSms(from, 'INBOUND', text || '', parsed.intent, Object.keys(entities).length > 0 ? entities : null);

  // Send reply
  const atMessageId = await sendSms(from, response);

  // Log outbound
  await logSms(from, 'OUTBOUND', response, parsed.intent, Object.keys(entities).length > 0 ? entities : null, atMessageId);

  console.log(`[SMS Response] To: ${from}, Intent: ${parsed.intent}, Message: ${response}`);

  res.json({
    success: true,
    data: {
      from,
      text,
      intent: parsed.intent,
      entities,
      response,
      sent: !!atMessageId,
    },
  });
});

// -------------------------------------------------------------------
// GET /api/v1/sms/test — Test SMS parsing (no actual SMS sent)
// -------------------------------------------------------------------
router.get('/test', async (req: Request, res: Response) => {
  const { message } = req.query;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: { message: 'Provide ?message=bei nyanya' },
      examples: [
        '?message=bei nyanya',
        '?message=nina nyanya 50kg Embu',
        '?message=sell tomato 30kg Nakuru',
        '?message=buyer mango Mombasa',
        '?message=status',
        '?message=msaada',
      ],
    });
  }

  const parsed = parseMessage(message);
  const response = await generateResponse(parsed);

  res.json({
    success: true,
    data: {
      input: message,
      intent: parsed.intent,
      entities: {
        crop: parsed.crop,
        quantity: parsed.quantity,
        unit: parsed.unit,
        location: parsed.location,
      },
      lang: parsed.lang,
      response,
    },
  });
});

// -------------------------------------------------------------------
// GET /api/v1/sms/logs — View SMS logs (admin)
// -------------------------------------------------------------------
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { phone, intent, limit = '50' } = req.query;

    const where: any = {};
    if (phone) where.phone = phone;
    if (intent) where.intent = intent;

    const logs = await prisma.smsLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit as string, 10) || 50, 200),
      select: {
        id: true,
        phone: true,
        direction: true,
        message: true,
        intent: true,
        entities: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: logs, count: logs.length });
  } catch (error) {
    res.status(500).json({ success: false, error: { message: 'Failed to fetch SMS logs' } });
  }
});

export { router as smsRouter };
