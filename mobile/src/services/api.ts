import axios from 'axios';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// API URL configuration
const getApiUrl = () => {
  if (__DEV__) {
    // Web browser uses localhost, native uses device-specific addresses
    if (Platform.OS === 'web') {
      return 'http://localhost:3000/api/v1';
    }
    // Android emulator uses 10.0.2.2, iOS simulator uses localhost
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:3000/api/v1'
      : 'http://localhost:3000/api/v1';
  }
  return 'https://api.sunharvest.com/api/v1';
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type GradeResult = {
  grade: 'Premium' | 'Grade A' | 'Grade B' | 'Reject';
  confidence: number;
  suggestedPrice: number;
  currency: string;
  unit: string;
  cropType: string;
  defects: string[];
  gradedAt: string;
};

export type Listing = {
  id: string;
  crop: string;
  grade: string;
  price: number;
  quantity: number;
  farmer: string;
  location: string;
};

export type MarketPrice = {
  crop: string;
  wholesale: number;
  retail: number;
  unit: string;
  currency: string;
};

export type User = {
  id: string;
  name: string;
  phone: string;
  userType: 'farmer' | 'buyer' | 'transporter';
  location: string;
  createdAt: string;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type RegisterData = {
  name: string;
  phone: string;
  pin: string;
  location: string;
  userType: 'farmer' | 'buyer' | 'transporter';
};

// Grade produce image
export async function gradeImage(imageUri: string, cropType: string = 'tomato'): Promise<GradeResult> {
  const formData = new FormData();

  const fileInfo = await FileSystem.getInfoAsync(imageUri);
  if (!fileInfo.exists) {
    throw new Error('Image file not found');
  }

  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'produce.jpg',
  } as any);
  formData.append('cropType', cropType);

  const response = await api.post<{ success: boolean; data: GradeResult }>('/produce/grade', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  if (!response.data.success) {
    throw new Error('Grading failed');
  }

  return response.data.data;
}

// Get produce listings
export async function getListings(): Promise<Listing[]> {
  const response = await api.get<{ success: boolean; data: Listing[] }>('/produce/listings');
  return response.data.data;
}

// Get market prices
export async function getMarketPrices(): Promise<MarketPrice[]> {
  const response = await api.get<{ success: boolean; data: MarketPrice[] }>('/market/prices');
  return response.data.data;
}

// Get price for specific crop
export async function getCropPrice(crop: string): Promise<MarketPrice> {
  const response = await api.get<{ success: boolean; data: MarketPrice }>(`/market/prices?crop=${crop}`);
  return response.data.data;
}

// Authentication
export async function login(phone: string, pin: string): Promise<AuthResponse> {
  const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/login', {
    phone,
    pin,
  });
  return response.data.data;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await api.post<{ success: boolean; data: AuthResponse }>('/auth/register', data);
  return response.data.data;
}

// Get current user
export async function getCurrentUser(): Promise<User> {
  const response = await api.get<{ success: boolean; data: User }>('/auth/me');
  return response.data.data;
}

// Create a new listing
export async function createListing(listing: {
  crop: string;
  grade: string;
  price: number;
  quantity: number;
  location: string;
  imageUri?: string;
}): Promise<Listing> {
  const response = await api.post<{ success: boolean; data: Listing }>('/produce/listings', listing);
  return response.data.data;
}

// ============================================
// AI MARKET INTELLIGENCE
// ============================================

export type PricePrediction = {
  recommendedPrice: number;
  priceRangeMin: number;
  priceRangeMax: number;
  confidence: number;
  marketAverage: number;
  trend: 'rising' | 'stable' | 'falling';
  reasoning: string[];
  demandLevel: 'low' | 'normal' | 'high';
  currency: string;
  unit: string;
};

export type SuccessPrediction = {
  estimatedDays: number;
  daysRange: { min: number; max: number };
  confidence: number;
  category: 'fast' | 'normal' | 'slow' | 'unlikely';
  probability: number;
  factors: string[];
  suggestions: string[];
};

export type MarketTrend = {
  crop: string;
  currentPrice: number;
  weekAgo: number;
  monthAgo: number;
  trend: 'rising' | 'stable' | 'falling';
  changePercent: number;
  history: { date: string; price: number }[];
  forecast: { date: string; price: number }[];
  demandLevel: 'low' | 'normal' | 'high';
  bestTimeToSell: 'now' | 'wait' | 'anytime';
};

export type MarketIntelligence = {
  summary: {
    marketSentiment: 'bullish' | 'bearish' | 'neutral';
    risingCrops: number;
    fallingCrops: number;
    stableCrops: number;
  };
  crops: {
    crop: string;
    price: number;
    trend: string;
    changePercent: number;
    avgDaysToSell: number;
    demandLevel: string;
  }[];
  hotCrops: string[];
  coldCrops: string[];
  insights: string[];
  lastUpdated: string;
};

// Get AI price prediction
export async function getPricePrediction(params: {
  crop: string;
  grade: string;
  quantity: number;
  county: string;
}): Promise<PricePrediction> {
  const response = await api.post<{ success: boolean; data: PricePrediction }>(
    '/market/predict-price',
    params
  );
  return response.data.data;
}

// Get success prediction (time to sell)
export async function getSuccessPrediction(params: {
  crop: string;
  grade: string;
  price: number;
  quantity: number;
  county: string;
}): Promise<SuccessPrediction> {
  const response = await api.post<{ success: boolean; data: SuccessPrediction }>(
    '/market/success-estimate',
    params
  );
  return response.data.data;
}

// Get market trends
export async function getMarketTrends(crop?: string, county?: string): Promise<MarketTrend> {
  const params = new URLSearchParams();
  if (crop) params.append('crop', crop);
  if (county) params.append('county', county);

  const response = await api.get<{ success: boolean; data: MarketTrend }>(
    `/market/trends?${params.toString()}`
  );
  return response.data.data;
}

// Get full market intelligence
export async function getMarketIntelligence(county?: string): Promise<MarketIntelligence> {
  const params = county ? `?county=${county}` : '';
  const response = await api.get<{ success: boolean; data: MarketIntelligence }>(
    `/market/intelligence${params}`
  );
  return response.data.data;
}

// ============================================
// OFFERS & ORDERS
// ============================================

export type Offer = {
  id: string;
  listingId: string;
  crop: string;
  quantity: number;
  price: number;
  total: number;
  status: 'PENDING' | 'ACCEPTED' | 'PAID' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';
  farmer?: string;
  farmerPhone?: string;
  buyer?: string;
  buyerPhone?: string;
  location?: string;
  images?: string[];
  createdAt: string;
};

// Create a new offer
export async function createOffer(params: {
  listingId: string;
  buyerId: string;
  quantity: number;
  price: number;
  message?: string;
}): Promise<{ success: boolean; offer: Offer }> {
  const response = await api.post('/listings/../offers', params);
  return response.data;
}

// Get offers for a buyer
export async function getBuyerOffers(buyerId: string, status?: string): Promise<Offer[]> {
  const params = status ? `?status=${status}` : '';
  const response = await api.get(`/offers/buyer/${buyerId}${params}`);
  return response.data;
}

// Get offers for a farmer
export async function getFarmerOffers(farmerId: string, status?: string): Promise<Offer[]> {
  const params = status ? `?status=${status}` : '';
  const response = await api.get(`/offers/farmer/${farmerId}${params}`);
  return response.data;
}

// Accept an offer (farmer)
export async function acceptOffer(offerId: string): Promise<{ success: boolean; message: string }> {
  const response = await api.put(`/offers/${offerId}/accept`);
  return response.data;
}

// Decline an offer (farmer)
export async function declineOffer(offerId: string): Promise<{ success: boolean; message: string }> {
  const response = await api.put(`/offers/${offerId}/decline`);
  return response.data;
}

// Mark offer as paid
export async function payOffer(offerId: string, paymentRef: string): Promise<{ success: boolean }> {
  const response = await api.put(`/offers/${offerId}/pay`, { paymentRef, paymentMethod: 'MPESA' });
  return response.data;
}

// Mark as delivered
export async function markDelivered(offerId: string): Promise<{ success: boolean }> {
  const response = await api.put(`/offers/${offerId}/deliver`);
  return response.data;
}

// Complete transaction (buyer confirms)
export async function completeTransaction(offerId: string, rating?: number): Promise<{ success: boolean }> {
  const response = await api.put(`/offers/${offerId}/complete`, { rating });
  return response.data;
}

// Get single offer details
export async function getOfferDetails(offerId: string): Promise<Offer> {
  const response = await api.get(`/offers/${offerId}`);
  return response.data;
}

// ============================================
// TRUST SCORE
// ============================================

export type TrustScoreBreakdown = {
  completionRate: number;
  rating: number;
  accountAge: number;
  verification: number;
  responseTime: number;
  disputeRate: number;
};

export type TrustScore = {
  score: number;
  level: 'New' | 'Basic' | 'Trusted' | 'Verified' | 'Elite';
  breakdown: TrustScoreBreakdown;
  badges: string[];
  totalTransactions: number;
  memberSince: string;
  insights: string[];
};

export type TrustScoreSummary = {
  score: number;
  level: 'New' | 'Basic' | 'Trusted' | 'Verified' | 'Elite';
  rating: number;
  totalRatings: number;
  isVerified: boolean;
};

// Get full trust score for a user
export async function getTrustScore(userId: string): Promise<TrustScore> {
  // Use base URL without /api/v1 prefix since trust-score is mounted at /api/trust-score
  const baseUrl = API_URL.replace('/api/v1', '');
  const response = await axios.get<TrustScore>(`${baseUrl}/api/trust-score/${userId}`);
  return response.data;
}

// Get quick summary for display on cards
export async function getTrustScoreSummary(userId: string): Promise<TrustScoreSummary> {
  const baseUrl = API_URL.replace('/api/v1', '');
  const response = await axios.get<TrustScoreSummary>(`${baseUrl}/api/trust-score/${userId}/summary`);
  return response.data;
}

// ============================================
// USER STATS & PROFILE
// ============================================

export type UserStats = {
  role: string;
  name: string;
  rating: number | null;
  totalRatings: number;
  // Farmer-specific
  totalListings?: number;
  activeListings?: number;
  totalSold?: number;
  totalRevenue?: number;
  // Buyer-specific
  totalPurchases?: number;
  totalSpent?: number;
  activeOffers?: number;
  // Transporter-specific
  totalDeliveries?: number;
  activeJobs?: number;
};

export type UserTransaction = {
  id: string;
  crop: string;
  quantity: number;
  unit: string;
  agreedPrice: number;
  status: string;
  farmer: { id: string; name: string };
  buyer: { id: string; name: string };
  county: string;
  paymentMethod: string | null;
  paymentRef: string | null;
  pickupDate: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type PaginatedResponse<T> = {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export async function getUserStats(userId: string): Promise<UserStats> {
  const response = await api.get<{ success: boolean; data: UserStats }>(`/users/${userId}/stats`);
  return response.data.data;
}

export async function updateUserProfile(userId: string, data: {
  name?: string;
  county?: string;
  subCounty?: string;
  ward?: string;
  language?: string;
  vehicleType?: string;
  vehicleCapacity?: number;
}): Promise<any> {
  const response = await api.put(`/users/${userId}`, data);
  return response.data.data;
}

export async function getUserTransactions(userId: string, params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<PaginatedResponse<UserTransaction>> {
  const query = new URLSearchParams();
  if (params?.page) query.append('page', params.page.toString());
  if (params?.limit) query.append('limit', params.limit.toString());
  if (params?.status) query.append('status', params.status);

  const response = await api.get<PaginatedResponse<UserTransaction>>(
    `/users/${userId}/transactions?${query.toString()}`
  );
  return response.data;
}

// ============================================
// DELIVERIES
// ============================================

export type AvailableDelivery = {
  transactionId: string;
  crop: string;
  quantity: number;
  unit: string;
  agreedPrice: number;
  pickup: {
    county: string;
    farmerName: string;
    farmerPhone: string;
  };
  delivery: {
    county: string | null;
    buyerName: string;
    buyerPhone: string;
  };
  createdAt: string;
};

export type MyDelivery = AvailableDelivery & {
  status: string;
  pickupDate: string | null;
  deliveredAt: string | null;
};

export async function getAvailableDeliveries(params?: {
  county?: string;
  limit?: number;
}): Promise<AvailableDelivery[]> {
  const query = new URLSearchParams();
  if (params?.county) query.append('county', params.county);
  if (params?.limit) query.append('limit', params.limit.toString());

  const response = await api.get<{ success: boolean; data: AvailableDelivery[] }>(
    `/deliveries/available?${query.toString()}`
  );
  return response.data.data;
}

export async function acceptDelivery(transactionId: string, transporterId: string): Promise<{
  transactionId: string;
  status: string;
  transporterId: string;
  pickupDate: string;
}> {
  const response = await api.post(`/deliveries/${transactionId}/accept`, { transporterId });
  return response.data.data;
}

export async function completeDelivery(transactionId: string): Promise<{
  transactionId: string;
  status: string;
  deliveredAt: string;
}> {
  const response = await api.put(`/deliveries/${transactionId}/complete`);
  return response.data.data;
}

export async function getMyDeliveries(transporterId: string, params?: {
  status?: string;
  limit?: number;
}): Promise<MyDelivery[]> {
  const query = new URLSearchParams();
  if (params?.status) query.append('status', params.status);
  if (params?.limit) query.append('limit', params.limit.toString());

  const response = await api.get<{ success: boolean; data: MyDelivery[] }>(
    `/deliveries/my/${transporterId}?${query.toString()}`
  );
  return response.data.data;
}

// ============================================
// GRADING DISPUTES
// ============================================

export async function disputeGrade(gradingId: string, reason?: string): Promise<{
  id: string;
  isDisputed: boolean;
  reviewStatus: string;
  grade: string;
}> {
  const response = await api.post(`/grading/${gradingId}/dispute`, { reason });
  return response.data.data;
}

export async function getPendingReviews(): Promise<any[]> {
  const response = await api.get('/grading/pending-reviews');
  return response.data.data;
}

export async function reviewGrade(gradingId: string, data: {
  action: 'approve' | 'override';
  newGrade?: string;
  reviewedBy: string;
  notes?: string;
}): Promise<any> {
  const response = await api.put(`/grading/${gradingId}/review`, data);
  return response.data.data;
}

export { api };
