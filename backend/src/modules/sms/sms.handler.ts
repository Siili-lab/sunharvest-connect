/**
 * SMS Handler
 *
 * Processes incoming SMS from Africa's Talking.
 * Parses farmer intent and dispatches to appropriate service.
 */

import { AfricasTalkingClient } from '../../infrastructure/sms/africasTalking';
import { IntentParser } from './intent.parser';
import { MarketService } from '../market/market.service';
import { ProduceService } from '../produce/produce.service';
import { SMSTemplates } from './sms.templates';

interface IncomingSMS {
  from: string;
  to: string;
  text: string;
  date: string;
  id: string;
}

export class SMSHandler {
  constructor(
    private smsClient: AfricasTalkingClient,
    private intentParser: IntentParser,
    private marketService: MarketService,
    private produceService: ProduceService
  ) {}

  /**
   * Process incoming SMS from webhook
   */
  async handleIncoming(sms: IncomingSMS): Promise<void> {
    const phoneNumber = sms.from;
    const message = sms.text.trim();

    try {
      // Parse user intent
      const intent = await this.intentParser.parse(message);

      let response: string;

      switch (intent.type) {
        case 'CHECK_PRICE':
          response = await this.handlePriceCheck(intent.entities);
          break;

        case 'LIST_PRODUCE':
          response = await this.handleListProduce(phoneNumber, intent.entities);
          break;

        case 'CHECK_STATUS':
          response = await this.handleStatusCheck(phoneNumber);
          break;

        case 'HELP':
          response = SMSTemplates.help();
          break;

        default:
          response = SMSTemplates.unknownCommand();
      }

      await this.smsClient.send(phoneNumber, response);
    } catch (error) {
      console.error('SMS processing error:', error);
      await this.smsClient.send(phoneNumber, SMSTemplates.error());
    }
  }

  /**
   * Handle price check request
   * Example: "bei nyanya" or "price tomatoes"
   */
  private async handlePriceCheck(entities: Record<string, string>): Promise<string> {
    const cropType = entities.crop;
    const prices = await this.marketService.getCurrentPrices(cropType);

    return SMSTemplates.priceResponse(cropType, prices);
  }

  /**
   * Handle produce listing request
   * Example: "nina nyanya 50kg embu" (I have 50kg tomatoes in Embu)
   */
  private async handleListProduce(
    phoneNumber: string,
    entities: Record<string, string>
  ): Promise<string> {
    const { crop, quantity, location } = entities;

    // Create pending listing (needs photo for grading)
    const listing = await this.produceService.createPendingListing({
      phoneNumber,
      cropType: crop,
      quantity: parseFloat(quantity),
      location,
    });

    return SMSTemplates.listingCreated(listing.id, crop, quantity);
  }

  /**
   * Check status of user's listings
   */
  private async handleStatusCheck(phoneNumber: string): Promise<string> {
    const listings = await this.produceService.getListingsByPhone(phoneNumber);
    return SMSTemplates.statusResponse(listings);
  }
}
