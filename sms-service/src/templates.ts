/**
 * SMS Response Templates
 *
 * Bilingual templates for SMS responses.
 * Keep messages under 160 characters for single SMS.
 */

interface PriceData {
  wholesale: number;
  retail: number;
  unit: string;
}

interface Listing {
  id: string;
  cropType: string;
  quantity: number;
  status: 'pending' | 'active' | 'sold';
}

export const SMSTemplates = {
  /**
   * Welcome message for new users
   */
  welcome: (language: 'en' | 'sw' = 'en'): string => {
    return language === 'sw'
      ? 'Karibu SunHarvest! Tuma "bei" kupata bei za soko. Tuma "msaada" kwa maelekezo.'
      : 'Welcome to SunHarvest! Send "price" for market prices. Send "help" for instructions.';
  },

  /**
   * Price response
   */
  priceResponse: (crop: string, prices: PriceData, language: 'en' | 'sw' = 'en'): string => {
    const cropName = crop.charAt(0).toUpperCase() + crop.slice(1);

    return language === 'sw'
      ? `${cropName}: Jumla KES ${prices.wholesale}/${prices.unit}, Rejareja KES ${prices.retail}/${prices.unit}. Bei ya leo Nairobi.`
      : `${cropName}: Wholesale KES ${prices.wholesale}/${prices.unit}, Retail KES ${prices.retail}/${prices.unit}. Today's Nairobi prices.`;
  },

  /**
   * Listing created confirmation
   */
  listingCreated: (listingId: string, crop: string, quantity: string, language: 'en' | 'sw' = 'en'): string => {
    return language === 'sw'
      ? `Orodha #${listingId} imeundwa: ${quantity} ${crop}. Tuma picha kupata daraja la ubora.`
      : `Listing #${listingId} created: ${quantity} ${crop}. Send photo to get quality grade.`;
  },

  /**
   * Status response for user's listings
   */
  statusResponse: (listings: Listing[], language: 'en' | 'sw' = 'en'): string => {
    if (listings.length === 0) {
      return language === 'sw'
        ? 'Huna orodha za sasa. Tuma "weka [zao] [kiasi] [mahali]" kuunda.'
        : 'You have no active listings. Send "list [crop] [qty] [location]" to create.';
    }

    const statusMap = {
      pending: language === 'sw' ? 'inasubiri' : 'pending',
      active: language === 'sw' ? 'inaendelea' : 'active',
      sold: language === 'sw' ? 'imeuzwa' : 'sold',
    };

    const summary = listings
      .slice(0, 3)
      .map(l => `#${l.id}: ${l.quantity}kg ${l.cropType} (${statusMap[l.status]})`)
      .join(', ');

    return summary;
  },

  /**
   * Help instructions
   */
  help: (language: 'en' | 'sw' = 'en'): string => {
    return language === 'sw'
      ? 'Amri: "bei [zao]" - bei, "weka [zao] [kg] [mahali]" - orodhesha, "hali" - angalia orodha.'
      : 'Commands: "price [crop]" - prices, "list [crop] [kg] [location]" - create listing, "status" - check listings.';
  },

  /**
   * Error message
   */
  error: (language: 'en' | 'sw' = 'en'): string => {
    return language === 'sw'
      ? 'Samahani, kuna tatizo. Tafadhali jaribu tena. Tuma "msaada" kwa maelekezo.'
      : 'Sorry, something went wrong. Please try again. Send "help" for instructions.';
  },

  /**
   * Unknown command
   */
  unknownCommand: (language: 'en' | 'sw' = 'en'): string => {
    return language === 'sw'
      ? 'Amri haijulikani. Tuma "msaada" kwa orodha ya amri.'
      : 'Unknown command. Send "help" for available commands.';
  },

  /**
   * Grade result notification
   */
  gradeResult: (
    crop: string,
    grade: string,
    priceMin: number,
    priceMax: number,
    language: 'en' | 'sw' = 'en'
  ): string => {
    const gradeNames: Record<string, Record<string, string>> = {
      PREMIUM: { en: 'Premium', sw: 'Ubora wa Juu' },
      GRADE_A: { en: 'Grade A', sw: 'Daraja A' },
      GRADE_B: { en: 'Grade B', sw: 'Daraja B' },
      REJECT: { en: 'Below Standard', sw: 'Chini ya Kiwango' },
    };

    const gradeName = gradeNames[grade]?.[language] || grade;

    return language === 'sw'
      ? `${crop}: ${gradeName}. Bei inayopendekezwa: KES ${priceMin}-${priceMax}/kg.`
      : `${crop}: ${gradeName}. Suggested price: KES ${priceMin}-${priceMax}/kg.`;
  },

  /**
   * Buyer interest notification
   */
  buyerInterest: (
    buyerName: string,
    crop: string,
    quantity: number,
    offeredPrice: number,
    language: 'en' | 'sw' = 'en'
  ): string => {
    return language === 'sw'
      ? `Mnunuzi ${buyerName} anataka ${quantity}kg ${crop} @ KES ${offeredPrice}/kg. Jibu "ndio" kukubali au "hapana" kukataa.`
      : `Buyer ${buyerName} wants ${quantity}kg ${crop} @ KES ${offeredPrice}/kg. Reply "yes" to accept or "no" to decline.`;
  },
};
