import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'en' | 'sw';

// Translation keys
export const translations = {
  en: {
    // Common
    app_name: 'SunHarvest Connect',
    loading: 'Loading...',
    cancel: 'Cancel',
    confirm: 'Confirm',
    save: 'Save',
    delete: 'Delete',
    edit: 'Edit',
    search: 'Search',
    filter: 'Filter',
    all: 'All',
    view_all: 'View All',
    back: 'Back',
    continue: 'Continue',
    submit: 'Submit',
    close: 'Close',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    error: 'Error',
    success: 'Success',
    retry: 'Retry',

    // Auth
    welcome: 'Welcome',
    login: 'Login',
    register: 'Register',
    phone_number: 'Phone Number',
    enter_phone: 'Enter your phone number',
    pin: 'PIN',
    enter_pin: 'Enter your 4-digit PIN',
    create_pin: 'Create a 4-digit PIN',
    confirm_pin: 'Confirm PIN',
    name: 'Full Name',
    enter_name: 'Enter your full name',
    location: 'Location',
    select_county: 'Select your county',
    user_type: 'I am a...',
    farmer: 'Farmer',
    buyer: 'Buyer',
    transporter: 'Transporter',
    login_success: 'Login successful',
    register_success: 'Registration successful',
    invalid_credentials: 'Invalid phone or PIN',

    // Navigation
    home: 'Home',
    dashboard: 'Dashboard',
    sell: 'Sell',
    market: 'Market',
    orders: 'Orders',
    jobs: 'Jobs',
    deliveries: 'Deliveries',
    profile: 'Profile',
    sacco: 'SACCO',

    // Dashboard
    good_morning: 'Good morning',
    good_afternoon: 'Good afternoon',
    good_evening: 'Good evening',
    ai_insights: 'AI Insights',
    quick_actions: 'Quick Actions',
    market_prices: 'Market Prices',
    view_trends: 'View trends',
    todays_weather: "Today's Weather",
    create_listing: 'Create Listing',
    browse_market: 'Browse Market',
    ai_prices: 'AI Prices',
    my_orders: 'My Orders',
    total_revenue: 'Total Revenue',
    total_spent: 'Total Spent',
    total_earnings: 'Total Earnings',
    listings: 'Listings',
    offers: 'Offers',
    rating: 'Rating',
    views: 'views',
    sales: 'sales',
    this_month: 'this month',

    // Market
    marketplace: 'Marketplace',
    market_intelligence: 'Market Intelligence',
    available_listings: 'Available Listings',
    todays_market_prices: "Today's Market Prices",
    live: 'Live',
    search_crops: 'Search crops, farmers, locations...',
    no_listings: 'No Listings Found',
    check_back: 'Check back later for new listings',
    per_kg: 'per kg',
    kg_available: 'kg available',
    make_offer: 'Make Offer',
    ai_graded: 'AI Graded',
    contact_farmer: 'Contact Farmer',
    contact_buyer: 'Contact Buyer',
    call: 'Call',
    whatsapp: 'WhatsApp',
    escrow_protection: 'Escrow Protection',
    escrow_description: 'Your payment is held securely until you confirm delivery',

    // Sell/Create Listing
    sell_produce: 'Sell Produce',
    what_selling: 'What are you selling?',
    select_crop: 'Select crop type and enter details',
    crop_type: 'Crop Type',
    quantity: 'Quantity',
    quantity_kg: 'Quantity (kg)',
    price: 'Price',
    price_per_kg: 'Price per kg (KSh)',
    description: 'Description',
    description_optional: 'Description (optional)',
    add_photos: 'Add Photos',
    upload_photos: 'Upload at least 2 photos for AI quality grading',
    camera: 'Camera',
    gallery: 'Gallery',
    run_ai_grading: 'Run AI Quality Grading',
    ai_quality_grade: 'AI Quality Grade',
    confident: 'confident',
    suggested_price: 'Suggested Price',
    harvest_details: 'Harvest Details',
    harvest_date: 'Harvest Date',
    available_for: 'Available for (days)',
    storage_conditions: 'Storage Conditions',
    cool_dry: 'Cool & Dry',
    refrigerated: 'Refrigerated',
    room_temp: 'Room Temp',
    delivery_options: 'Delivery Options',
    pickup_location: 'Pickup Location',
    delivery_available: 'Delivery Available?',
    delivery_radius: 'Delivery Radius (km)',
    listing_summary: 'Listing Summary',
    total_value: 'Total Value',
    publish_listing: 'Publish Listing',
    listing_published: 'Listing Published!',
    listing_live: 'Your listing is now live on the marketplace.',

    // Orders
    active: 'Active',
    history: 'History',
    pending: 'Pending',
    accepted: 'Accepted',
    paid: 'Paid',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
    no_orders: 'No orders',
    accept_offer: 'Accept Offer',
    decline_offer: 'Decline Offer',
    offer_accepted: 'Offer accepted',
    offer_declined: 'Offer declined',
    pay_mpesa: 'Pay with M-Pesa',
    payment_initiated: 'Payment Initiated',
    check_phone: 'Check your phone for M-Pesa prompt.',
    confirm_delivery: 'Confirm Delivery',
    confirm_receipt: 'Confirm Receipt',
    delivery_confirmed: 'Delivery Confirmed',
    payment_released: 'Payment has been released to the farmer.',
    mark_delivered: 'Mark as Delivered',
    escrow_held: 'Funds held in escrow',
    total_amount: 'Total Amount',
    order_details: 'Order Details',

    // Trust Score
    trust_score: 'Trust Score',
    your_trust_score: 'Your Trust Score',
    transactions: 'Transactions',
    member_since: 'Member Since',
    achievements: 'Achievements',
    score_breakdown: 'Score Breakdown',
    completion_rate: 'Completion Rate',
    partner_rating: 'Partner Rating',
    account_age: 'Account Age',
    verification: 'Verification',
    response_time: 'Response Time',
    dispute_history: 'Dispute History',
    ai_insights_title: 'AI Insights',

    // Profile
    account_info: 'Account Information',
    account_information: 'Account Information',
    transaction_history: 'Transaction History',
    select_language: 'Select Language',
    tagline: 'Empowering Kenyan Farmers',
    recent_activity: 'Recent Activity',
    settings: 'Settings',
    push_notifications: 'Push Notifications',
    sms_alerts: 'SMS Alerts',
    edit_profile: 'Edit Profile',
    change_pin: 'Change PIN',
    language: 'Language',
    english: 'English',
    swahili: 'Kiswahili',
    support: 'Support',
    help_center: 'Help Center',
    contact_support: 'Contact Support',
    terms_privacy: 'Terms & Privacy',
    about: 'About SunHarvest',
    logout: 'Log Out',
    logout_confirm: 'Are you sure you want to log out?',
    verify_account: 'Verify Account',
    verified: 'Verified',

    // Deliveries (Transporter)
    available_jobs: 'Available Jobs',
    my_jobs: 'My Jobs',
    todays_earnings: "Today's Earnings",
    active_jobs: 'Active Jobs',
    pickup: 'Pickup',
    delivery: 'Delivery',
    distance: 'Distance',
    payment: 'Payment',
    deadline: 'Deadline',
    accept_job: 'Accept Job',
    job_accepted: 'Job accepted!',
    contact_farmer_pickup: 'Contact the farmer to arrange pickup.',
    cargo_info: 'Cargo Information',
    route: 'Route',
    contacts: 'Contacts',
    special_instructions: 'Special Instructions',
    mark_picked_up: 'Mark as Picked Up',
    start_delivery: 'Start Delivery',
    complete_get_paid: 'Complete & Get Paid',
    ai_route_suggestion: 'AI Route Suggestion',

    // AI Features
    ai_price_suggestion: 'AI Price Suggestion',
    recommended_price: 'Recommended Price',
    market_average: 'Market Average',
    price_trend: 'Price Trend',
    rising: 'Rising',
    stable: 'Stable',
    falling: 'Falling',
    demand_level: 'Demand Level',
    high: 'High',
    normal: 'Normal',
    low: 'Low',
    success_estimate: 'Success Estimate',
    estimated_days: 'Estimated Days to Sell',
    probability: 'Sale Probability',
    fast: 'Fast',
    slow: 'Slow',
    unlikely: 'Unlikely',

    // Grades
    premium: 'Premium',
    grade_a: 'Grade A',
    grade_b: 'Grade B',
    grade_c: 'Grade C',
    reject: 'Reject',
  },

  sw: {
    // Common
    app_name: 'SunHarvest Connect',
    loading: 'Inapakia...',
    cancel: 'Ghairi',
    confirm: 'Thibitisha',
    save: 'Hifadhi',
    delete: 'Futa',
    edit: 'Hariri',
    search: 'Tafuta',
    filter: 'Chuja',
    all: 'Zote',
    view_all: 'Ona Zote',
    back: 'Rudi',
    continue: 'Endelea',
    submit: 'Wasilisha',
    close: 'Funga',
    yes: 'Ndiyo',
    no: 'Hapana',
    ok: 'Sawa',
    error: 'Hitilafu',
    success: 'Imefanikiwa',
    retry: 'Jaribu tena',

    // Auth
    welcome: 'Karibu',
    login: 'Ingia',
    register: 'Jisajili',
    phone_number: 'Nambari ya Simu',
    enter_phone: 'Ingiza nambari yako ya simu',
    pin: 'PIN',
    enter_pin: 'Ingiza PIN yako ya nambari 4',
    create_pin: 'Tengeneza PIN ya nambari 4',
    confirm_pin: 'Thibitisha PIN',
    name: 'Jina Kamili',
    enter_name: 'Ingiza jina lako kamili',
    location: 'Mahali',
    select_county: 'Chagua kaunti yako',
    user_type: 'Mimi ni...',
    farmer: 'Mkulima',
    buyer: 'Mnunuzi',
    transporter: 'Msafirishaji',
    login_success: 'Umeingia kikamilifu',
    register_success: 'Usajili umefanikiwa',
    invalid_credentials: 'Simu au PIN si sahihi',

    // Navigation
    home: 'Nyumbani',
    dashboard: 'Dashibodi',
    sell: 'Uza',
    market: 'Soko',
    orders: 'Oda',
    jobs: 'Kazi',
    deliveries: 'Usafirishaji',
    profile: 'Wasifu',
    sacco: 'SACCO',

    // Dashboard
    good_morning: 'Habari za asubuhi',
    good_afternoon: 'Habari za mchana',
    good_evening: 'Habari za jioni',
    ai_insights: 'Maarifa ya AI',
    quick_actions: 'Vitendo vya Haraka',
    market_prices: 'Bei za Soko',
    view_trends: 'Angalia mwenendo',
    todays_weather: 'Hali ya Hewa Leo',
    create_listing: 'Tengeneza Orodha',
    browse_market: 'Vinjari Soko',
    ai_prices: 'Bei za AI',
    my_orders: 'Oda Zangu',
    total_revenue: 'Mapato Jumla',
    total_spent: 'Matumizi Jumla',
    total_earnings: 'Mapato Jumla',
    listings: 'Orodha',
    offers: 'Ofa',
    rating: 'Kiwango',
    views: 'mitazamo',
    sales: 'mauzo',
    this_month: 'mwezi huu',

    // Market
    marketplace: 'Soko',
    market_intelligence: 'Akili ya Soko',
    available_listings: 'Orodha Zinazopatikana',
    todays_market_prices: 'Bei za Soko Leo',
    live: 'Moja kwa Moja',
    search_crops: 'Tafuta mazao, wakulima, maeneo...',
    no_listings: 'Hakuna Orodha',
    check_back: 'Rudi baadaye kwa orodha mpya',
    per_kg: 'kwa kilo',
    kg_available: 'kg inapatikana',
    make_offer: 'Toa Bei',
    ai_graded: 'Imepimwa na AI',
    contact_farmer: 'Wasiliana na Mkulima',
    contact_buyer: 'Wasiliana na Mnunuzi',
    call: 'Piga Simu',
    whatsapp: 'WhatsApp',
    escrow_protection: 'Ulinzi wa Escrow',
    escrow_description: 'Malipo yako yamehifadhiwa salama hadi uthibitishe kupokelewa',

    // Sell/Create Listing
    sell_produce: 'Uza Mazao',
    what_selling: 'Unauza nini?',
    select_crop: 'Chagua aina ya zao na ingiza maelezo',
    crop_type: 'Aina ya Zao',
    quantity: 'Kiasi',
    quantity_kg: 'Kiasi (kg)',
    price: 'Bei',
    price_per_kg: 'Bei kwa kilo (KSh)',
    description: 'Maelezo',
    description_optional: 'Maelezo (si lazima)',
    add_photos: 'Ongeza Picha',
    upload_photos: 'Pakia angalau picha 2 kwa upimaji wa AI',
    camera: 'Kamera',
    gallery: 'Galari',
    run_ai_grading: 'Fanya Upimaji wa AI',
    ai_quality_grade: 'Daraja la Ubora la AI',
    confident: 'uhakika',
    suggested_price: 'Bei Inayopendekezwa',
    harvest_details: 'Maelezo ya Mavuno',
    harvest_date: 'Tarehe ya Kuvuna',
    available_for: 'Inapatikana kwa (siku)',
    storage_conditions: 'Hali ya Kuhifadhi',
    cool_dry: 'Baridi & Kavu',
    refrigerated: 'Jokofu',
    room_temp: 'Joto la Chumba',
    delivery_options: 'Chaguo za Uwasilishaji',
    pickup_location: 'Mahali pa Kuchukua',
    delivery_available: 'Uwasilishaji Unapatikana?',
    delivery_radius: 'Umbali wa Uwasilishaji (km)',
    listing_summary: 'Muhtasari wa Orodha',
    total_value: 'Thamani Jumla',
    publish_listing: 'Chapisha Orodha',
    listing_published: 'Orodha Imechapishwa!',
    listing_live: 'Orodha yako iko sokoni sasa.',

    // Orders
    active: 'Hai',
    history: 'Historia',
    pending: 'Inasubiri',
    accepted: 'Imekubaliwa',
    paid: 'Imelipwa',
    in_transit: 'Njiani',
    delivered: 'Imewasilishwa',
    completed: 'Imekamilika',
    cancelled: 'Imeghairiwa',
    disputed: 'Ina Mgogoro',
    no_orders: 'Hakuna oda',
    accept_offer: 'Kubali Ofa',
    decline_offer: 'Kataa Ofa',
    offer_accepted: 'Ofa imekubaliwa',
    offer_declined: 'Ofa imekataliwa',
    pay_mpesa: 'Lipa na M-Pesa',
    payment_initiated: 'Malipo Yameanzishwa',
    check_phone: 'Angalia simu yako kwa M-Pesa.',
    confirm_delivery: 'Thibitisha Uwasilishaji',
    confirm_receipt: 'Thibitisha Kupokea',
    delivery_confirmed: 'Uwasilishaji Umethibitishwa',
    payment_released: 'Malipo yametolewa kwa mkulima.',
    mark_delivered: 'Weka kama Imewasilishwa',
    escrow_held: 'Fedha zimehifadhiwa',
    total_amount: 'Jumla ya Kiasi',
    order_details: 'Maelezo ya Oda',

    // Trust Score
    trust_score: 'Alama ya Uaminifu',
    your_trust_score: 'Alama Yako ya Uaminifu',
    transactions: 'Miamala',
    member_since: 'Mwanachama Tangu',
    achievements: 'Mafanikio',
    score_breakdown: 'Mgawanyo wa Alama',
    completion_rate: 'Kiwango cha Kukamilisha',
    partner_rating: 'Kiwango cha Mshirika',
    account_age: 'Umri wa Akaunti',
    verification: 'Uthibitisho',
    response_time: 'Muda wa Kujibu',
    dispute_history: 'Historia ya Migogoro',
    ai_insights_title: 'Maarifa ya AI',

    // Profile
    account_info: 'Taarifa za Akaunti',
    account_information: 'Taarifa za Akaunti',
    transaction_history: 'Historia ya Miamala',
    select_language: 'Chagua Lugha',
    tagline: 'Kuwawezesha Wakulima wa Kenya',
    recent_activity: 'Shughuli za Hivi Karibuni',
    settings: 'Mipangilio',
    push_notifications: 'Arifa za Push',
    sms_alerts: 'Arifa za SMS',
    edit_profile: 'Hariri Wasifu',
    change_pin: 'Badilisha PIN',
    language: 'Lugha',
    english: 'Kiingereza',
    swahili: 'Kiswahili',
    support: 'Msaada',
    help_center: 'Kituo cha Msaada',
    contact_support: 'Wasiliana na Msaada',
    terms_privacy: 'Masharti & Faragha',
    about: 'Kuhusu SunHarvest',
    logout: 'Ondoka',
    logout_confirm: 'Una uhakika unataka kuondoka?',
    verify_account: 'Thibitisha Akaunti',
    verified: 'Imethibitishwa',

    // Deliveries (Transporter)
    available_jobs: 'Kazi Zinazopatikana',
    my_jobs: 'Kazi Zangu',
    todays_earnings: 'Mapato ya Leo',
    active_jobs: 'Kazi Hai',
    pickup: 'Kuchukua',
    delivery: 'Kuwasilisha',
    distance: 'Umbali',
    payment: 'Malipo',
    deadline: 'Mwisho',
    accept_job: 'Kubali Kazi',
    job_accepted: 'Kazi imekubaliwa!',
    contact_farmer_pickup: 'Wasiliana na mkulima kupanga kuchukua.',
    cargo_info: 'Taarifa za Mizigo',
    route: 'Njia',
    contacts: 'Mawasiliano',
    special_instructions: 'Maelekezo Maalum',
    mark_picked_up: 'Weka kama Imechukuliwa',
    start_delivery: 'Anza Kuwasilisha',
    complete_get_paid: 'Kamilisha & Lipwe',
    ai_route_suggestion: 'Pendekezo la Njia la AI',

    // AI Features
    ai_price_suggestion: 'Pendekezo la Bei la AI',
    recommended_price: 'Bei Inayopendekezwa',
    market_average: 'Wastani wa Soko',
    price_trend: 'Mwenendo wa Bei',
    rising: 'Inapanda',
    stable: 'Imara',
    falling: 'Inashuka',
    demand_level: 'Kiwango cha Mahitaji',
    high: 'Juu',
    normal: 'Kawaida',
    low: 'Chini',
    success_estimate: 'Makadirio ya Mafanikio',
    estimated_days: 'Siku za Kuuza (Makadirio)',
    probability: 'Uwezekano wa Kuuza',
    fast: 'Haraka',
    slow: 'Polepole',
    unlikely: 'Haiwezekani',

    // Grades
    premium: 'Hali ya Juu',
    grade_a: 'Daraja A',
    grade_b: 'Daraja B',
    grade_c: 'Daraja C',
    reject: 'Imekataliwa',
  },
};

type TranslationKeys = keyof typeof translations.en;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKeys) => string;
  isSwahili: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const saved = await AsyncStorage.getItem('language');
      if (saved === 'en' || saved === 'sw') {
        setLanguageState(saved);
      }
    } catch (error) {
      console.error('Error loading language:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem('language', lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const t = (key: TranslationKeys): string => {
    return translations[language][key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        isSwahili: language === 'sw',
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export type { Language, TranslationKeys };
