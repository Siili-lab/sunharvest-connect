/**
 * Shared Types
 *
 * Types shared between mobile app, backend, and other services.
 * Keep in sync across all platforms.
 */

// ===== User Types =====

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  role: UserRole;
  language: Language;
  location?: Location;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'farmer' | 'buyer' | 'transporter' | 'admin';

export type Language = 'en' | 'sw';

export interface Location {
  county: string;
  subCounty?: string;
  ward?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

// ===== Produce Types =====

export interface ProduceListing {
  id: string;
  farmerId: string;
  cropType: CropType;
  variety?: string;
  quantity: number;
  unit: Unit;
  qualityGrade: QualityGrade;
  price: Price;
  images: string[];
  location: Location;
  harvestDate?: Date;
  availableUntil?: Date;
  status: ListingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type CropType =
  | 'tomatoes'
  | 'mangoes'
  | 'onions'
  | 'potatoes'
  | 'cabbage'
  | 'kale'
  | 'spinach'
  | 'avocado'
  | 'bananas'
  | 'oranges';

export type Unit = 'kg' | 'piece' | 'bunch' | 'crate';

export type QualityGrade = 'PREMIUM' | 'GRADE_A' | 'GRADE_B' | 'REJECT';

export interface Price {
  amount: number;
  currency: 'KES';
  unit: Unit;
  negotiable: boolean;
}

export type ListingStatus = 'pending' | 'active' | 'reserved' | 'sold' | 'expired' | 'cancelled';

// ===== Grading Types =====

export interface GradingResult {
  grade: QualityGrade;
  confidence: number;
  suggestedPrice: PriceRange;
  defects: Defect[];
  modelVersion: string;
  timestamp: Date;
}

export interface PriceRange {
  min: number;
  max: number;
  currency: 'KES';
  unit: Unit;
}

export interface Defect {
  type: DefectType;
  severity: 'low' | 'medium' | 'high';
  description?: string;
}

export type DefectType =
  | 'bruise'
  | 'rot'
  | 'discoloration'
  | 'pest_damage'
  | 'size_irregular'
  | 'ripeness_uneven'
  | 'dehydration';

// ===== Market Types =====

export interface MarketPrice {
  cropType: CropType;
  market: Market;
  wholesale: number;
  retail: number;
  unit: Unit;
  currency: 'KES';
  date: Date;
  trend: PriceTrend;
}

export interface Market {
  id: string;
  name: string;
  location: Location;
  type: 'wholesale' | 'retail' | 'farmgate';
}

export type PriceTrend = 'rising' | 'stable' | 'falling';

// ===== Transaction Types =====

export interface Transaction {
  id: string;
  listingId: string;
  sellerId: string;
  buyerId: string;
  quantity: number;
  unit: Unit;
  agreedPrice: number;
  currency: 'KES';
  status: TransactionStatus;
  paymentMethod?: PaymentMethod;
  transporterId?: string;
  createdAt: Date;
  completedAt?: Date;
}

export type TransactionStatus =
  | 'pending'
  | 'accepted'
  | 'payment_pending'
  | 'paid'
  | 'in_transit'
  | 'delivered'
  | 'completed'
  | 'disputed'
  | 'cancelled';

export type PaymentMethod = 'mpesa' | 'cash' | 'bank_transfer';

// ===== API Types =====

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ResponseMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ResponseMeta {
  timestamp: string;
  requestId?: string;
  page?: number;
  limit?: number;
  total?: number;
}

// ===== SMS Types =====

export interface SMSMessage {
  id: string;
  from: string;
  to: string;
  text: string;
  direction: 'inbound' | 'outbound';
  status: SMSStatus;
  timestamp: Date;
}

export type SMSStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface ParsedIntent {
  type: IntentType;
  confidence: number;
  entities: Record<string, string>;
  rawText: string;
}

export type IntentType =
  | 'CHECK_PRICE'
  | 'LIST_PRODUCE'
  | 'CHECK_STATUS'
  | 'ACCEPT_OFFER'
  | 'REJECT_OFFER'
  | 'HELP'
  | 'UNKNOWN';
