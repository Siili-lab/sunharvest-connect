# SunHarvest Connect — Complete System Documentation

**An AI-Powered Agricultural Marketplace for Kenyan Smallholder Farmers**
By Winfred Mutheu Siili & Kelvin Mwendwa Mutunga

---

## Table of Contents

1. [What is SunHarvest Connect?](#1-what-is-sunharvest-connect)
2. [System Architecture](#2-system-architecture)
3. [Feature Breakdown](#3-feature-breakdown)
   - 3.1 Authentication & Onboarding
   - 3.2 Farmer Dashboard
   - 3.3 AI Quality Grading
   - 3.4 AI Price Intelligence
   - 3.5 Sell Flow (Listing Creation)
   - 3.6 Marketplace
   - 3.7 Offers & Transaction Lifecycle
   - 3.8 Delivery Management
   - 3.9 Market Intelligence Dashboard
   - 3.10 Trust Score System
   - 3.11 SACCO (Cooperative Savings)
   - 3.12 SMS Access (NLP)
   - 3.13 Notifications
   - 3.14 User Profile & Settings
   - 3.15 Bilingual Support (English/Swahili)
   - 3.16 Privacy & Data Protection
4. [The 5 AI Capabilities](#4-the-5-ai-capabilities)
5. [Database Design](#5-database-design)
6. [ML Pipeline](#6-ml-pipeline)
7. [Infrastructure](#7-infrastructure)
8. [Testing](#8-testing)
9. [Security](#9-security)

---

## 1. What is SunHarvest Connect?

SunHarvest Connect is a mobile application that helps Kenyan farmers sell their produce directly to buyers, cutting out middlemen. It uses AI to grade produce quality, suggest fair prices, predict how fast a listing will sell, and provide real-time market intelligence.

**The three problems we solve:**

| Problem | Impact | Our Solution |
|---------|--------|--------------|
| 30-45% of produce is lost after harvest | Farmers can't grade quality or find buyers fast enough | AI quality grading + direct marketplace |
| Farmers earn 40-60% below wholesale | Middlemen control pricing | AI price intelligence from real market data |
| 70% of smallholders excluded from banking | No credit history or collateral | SACCO savings + transaction-based credit scoring |

**In simple terms:** A farmer photographs their tomatoes, the AI tells them the quality grade, suggests a fair price based on today's market, they list it, a buyer in Nairobi sees it and makes an offer, the farmer accepts, payment happens via M-Pesa, and a transporter delivers it. If the farmer doesn't have a smartphone, they can do it all via SMS.

---

## 2. System Architecture

```
                    +-----------------+
                    |   Mobile App    |
                    | (React Native/  |
                    |     Expo)       |
                    +--------+--------+
                             |
                        REST API calls
                             |
                    +--------v--------+
                    |  Backend API    |
                    | (Node.js +      |
                    |  Express +      |
                    |  TypeScript)    |
                    +--+-----+----+--+
                       |     |    |
          +------------+     |    +------------+
          |                  |                 |
+---------v-----+  +---------v-----+  +-------v-------+
|  PostgreSQL   |  |    Redis      |  |  ML Server    |
|  (Database)   |  |   (Cache)     |  | (Flask +      |
|  16 tables    |  | Price cache   |  |  TensorFlow)  |
+---------------+  +---------------+  +---------------+
```

**In simple terms:**
- **Mobile App** = what the farmer/buyer/transporter sees on their phone
- **Backend API** = the brain that handles all requests, connects everything together
- **PostgreSQL** = where all the data lives (users, listings, transactions, prices, weather)
- **Redis** = a fast temporary store that caches frequently requested data (like market prices) so we don't hit the database every time
- **ML Server** = runs the trained AI model that grades produce quality from photos

### Tech Stack

| Layer | Technology | Why We Chose It |
|-------|-----------|-----------------|
| Mobile | React Native + Expo | One codebase for both Android and iOS. Expo gives us over-the-air updates without going through app stores |
| Backend | Node.js + Express + TypeScript | Fast, widely supported, TypeScript catches bugs before they reach users |
| Database | PostgreSQL 15 + Prisma ORM | Relational data (users, listings, transactions) fits naturally. Prisma gives us type-safe queries |
| Cache | Redis 7 | Caches price predictions and market data. Reduces DB load, speeds up responses |
| ML | TensorFlow + MobileNetV2 | Industry-standard for image classification. MobileNetV2 is specifically designed to be lightweight for mobile |
| ML Server | Flask + Gunicorn | Python is the standard for ML serving. Flask is lightweight. Gunicorn handles concurrent requests |
| SMS | Africa's Talking | Kenya's leading SMS gateway. Supports bulk SMS, USSD, and has good developer tools |
| Payments | M-Pesa (Safaricom Daraja API) | M-Pesa is used by 96% of Kenyan mobile money users. It's the only payment method that makes sense |
| Infrastructure | Docker Compose | One command (`docker-compose up`) starts all four services. Easy to deploy anywhere |

---

## 3. Feature Breakdown

### 3.1 Authentication & Onboarding

**What the user sees:**
A welcome screen with a dark green hero section, the SunHarvest Connect logo, and three feature highlight cards. Below that, a "Get Started" button and three demo account buttons (Farmer, Buyer, Transporter).

**How it works:**
- Users log in with their **phone number + 4-digit PIN** (not email/password — designed for Kenyan farmers who are familiar with M-Pesa's PIN system)
- New users register with name, phone, PIN, location (county), and role (farmer/buyer/transporter)
- On successful login, the server returns a **JWT token** that the app stores locally and sends with every subsequent request
- Demo accounts are pre-loaded with real transaction data for presentations

**Frontend:** `mobile/src/app/auth.tsx`
- Welcome screen with hero section, feature cards, role-based demo buttons
- Login form with phone + PIN inputs
- Register form with name, phone, PIN, location picker, role selector
- Language toggle (EN/SW) on the auth screen

**Backend:** `POST /api/v1/auth/register` and `POST /api/v1/auth/login`
- Registration hashes the PIN with **bcrypt** (so we never store the actual PIN)
- Login verifies the PIN against the hash, returns a signed JWT token (expires in 7 days)
- `GET /api/v1/auth/me` returns the current user's profile from the token
- Rate limited: 5 login attempts per 15 minutes per IP

**In simple terms:** You type your phone number and PIN, the server checks if they match, and gives you a digital key (JWT token) that proves who you are for the next 7 days.

---

### 3.2 Farmer Dashboard

**What the user sees:**
A personalized home screen showing:
- Revenue card with total earnings, number of items sold, active listings, and average rating
- AI Insights section with actionable tips (e.g., "Tomato prices rising 18% — list more now")
- Quick action buttons: Sell Produce, AI Grade, Market Prices, My Orders

**How it works:**
- Dashboard data comes from `GET /api/v1/users/{id}/stats` which aggregates real data from the database
- Revenue is calculated from completed transactions
- AI Insights are generated from market trend data — if a crop the farmer grows is trending up, the app tells them

**Frontend:** `mobile/src/app/index.tsx`
- Role-based dashboards (farmer, buyer, transporter each see different cards)
- Revenue header with wallet icon, formatted KSh amount, and inline footer stats
- Stat cards with colored icon circles for each metric
- Quick action grid with navigation to key screens
- Pull-to-refresh to reload data

**Backend:** `GET /api/v1/users/{id}/stats`
- Counts active listings from `ProduceListing` table
- Sums revenue from `Transaction` table where status = COMPLETED
- Calculates average rating from buyer reviews
- All queries hit the real PostgreSQL database

**In simple terms:** The dashboard is the farmer's home base. Everything they see — revenue, listings, ratings — comes from actual data in the database. Nothing is hardcoded.

---

### 3.3 AI Quality Grading

**What the user sees:**
The farmer takes a photo of their produce. After a few seconds, the AI returns:
- A quality grade: **Premium**, **Grade A**, **Grade B**, or **Reject**
- A confidence percentage (e.g., 87%)
- Detected defects specific to the crop type (e.g., "cracking", "sunscald" for tomatoes)
- A suggested price based on the grade

**How it works — the full chain:**

```
Farmer takes photo
       |
       v
Mobile app sends image to backend
  POST /api/v1/produce/grade
       |
       v
Backend checks: Is ML server running?
       |
  YES--+--NO
  |         |
  v         v
Flask ML Server          Heuristic Fallback
(Trained MobileNetV2     (Analyzes image pixels:
 Keras model)             color, brightness,
  |                       saturation, uniformity)
  v                       |
Returns grade +           v
confidence +          Returns grade +
defects               confidence +
       |              defects
       v
Backend adds price prediction
(from market data + grade)
       |
       v
Returns full result to app
```

**The trained ML model:**
- Architecture: **MobileNetV2** (a lightweight CNN designed by Google for mobile devices)
- Training method: **Transfer learning** — we took a model pre-trained on millions of images (ImageNet) and fine-tuned it on agricultural produce images
- Input: 224x224 pixel RGB image
- Output: Probability distribution across 4 grades
- The model runs on a Flask server, processing images in ~200ms

**The heuristic fallback** (used when ML server is down):
- Resizes image to 64x64 pixels using `sharp` library
- Analyzes every pixel for brightness, saturation, and color
- Checks if the dominant color matches what fresh produce of that type should look like (e.g., tomatoes should be red, not brown)
- Scores uniformity (consistent color = fewer defects)
- Combines scores: color match (35%) + saturation (25%) + brightness (20%) + uniformity (20%)
- Not as accurate as the CNN but it actually looks at the image — it's not random

**Crop-specific defect detection:**

| Crop | Possible Defects |
|------|-----------------|
| Tomatoes | Cracking, sunscald, blossom end rot, catfacing |
| Mangoes | Anthracnose, latex burn, stem-end rot, lenticel spotting |
| Potatoes | Greening, scab, growth cracks, hollow heart |
| Onions | Neck rot, black mold, splitting, sunburn |
| Cabbage | Black rot, tip burn, insect damage, splitting |
| Kale | Aphid damage, leaf spot, yellowing, wilting |
| Avocado | Anthracnose, stem-end rot, lenticel damage, chilling injury |
| Bananas | Crown rot, finger drop, bruising, cigar-end rot |

**Frontend:** `mobile/src/app/sell.tsx` (Step 2) and `mobile/src/app/grade.tsx`
- Camera capture or gallery picker (up to 4 photos)
- Sends first photo to `POST /api/v1/produce/grade`
- Displays grade badge, confidence bar, defect list, and suggested price
- "Use this price" button auto-fills the listing price

**Backend:** `POST /api/v1/produce/grade` (`backend/src/routes/produce.routes.ts`)
- Accepts multipart form upload (image + cropType)
- Calls ML server first, falls back to heuristic analysis
- Saves grading result to `GradingResult` table with image hash, model version, and inference time
- Returns grade, confidence, defects, suggested price, price range, trend, and demand level

**In simple terms:** The farmer takes a photo, our AI model examines it the same way a quality inspector would — checking color, consistency, and defects — and tells the farmer what grade their produce is. The grade then determines the price.

---

### 3.4 AI Price Intelligence

**What the user sees:**
When creating a listing, the farmer sees:
- A recommended price per kg
- A fair price range (min–max)
- The current market average
- Whether prices are rising, falling, or stable
- A demand level indicator
- Human-readable reasoning (e.g., "Premium grade: +25% above market average", "Nairobi county: +15% urban demand premium")

**How it works:**

The price prediction algorithm combines 5 factors:

```
Recommended Price = Base Price
  x Grade Multiplier      (Premium: 1.25, Grade A: 1.0, Grade B: 0.8, Reject: 0.5)
  x County Demand          (Nairobi: 1.15, Mombasa: 1.10, Kisumu: 1.05, others: 1.0)
  x Quantity Factor         (>500kg: 0.95 bulk discount, <20kg: 1.05 small lot premium)
  x Trend Adjustment        (Rising: 1.05, Falling: 0.95, Stable: 1.0)
  x Weather Factor          (Heavy rain: 1.08 supply disruption, Good rain: 0.98)
```

- **Base Price** comes from querying the last 7 days of real market data in the `PriceHistory` table (47,000+ records across 2 years)
- **Weather Factor** fetches real-time weather from the **Open-Meteo API** for the farmer's county
- Predictions are cached in Redis for 24 hours to avoid redundant calculations
- Each prediction is also saved to the `PricePrediction` table for analytics

**Frontend:** `mobile/src/components/AIPriceSuggestion.tsx`
- Appears in the sell flow when crop and quantity are filled
- Shows recommended price prominently with "Use this price" button
- Displays fair range, market average, trend arrow, demand badge
- Lists reasoning bullets explaining each factor

**Backend:** `POST /api/v1/market/predict-price` (`backend/src/services/pricePredictor.ts`)
- Queries `PriceHistory` table for current and historical prices
- Queries `WeatherData` table (or fetches from Open-Meteo if missing)
- Applies all 5 multipliers
- Returns `recommendedPrice`, `priceRangeMin`, `priceRangeMax`, `confidence`, `trend`, `demandLevel`, `reasoning[]`

**In simple terms:** Instead of guessing what price to set, the farmer gets an AI-calculated suggestion based on what similar produce is actually selling for in Kenyan markets right now, adjusted for their specific grade, location, and current weather conditions.

---

### 3.5 Sell Flow (Listing Creation)

**What the user sees:**
A 4-step guided flow:

1. **Basic Info** — Select crop type, enter quantity (kg), set price (with AI suggestion), add description
2. **Photos & AI Grading** — Take or upload up to 4 photos, tap "Run AI Grading" to get quality grade
3. **Harvest Details** — Set harvest date, shelf life (days available), storage conditions
4. **Pickup & Review** — Set pickup location (manual or GPS), review everything, see success estimate, submit

**How it works:**
- Step 1 triggers the `AIPriceSuggestion` component as soon as crop and quantity are entered
- Step 2 sends the photo to `POST /api/v1/produce/grade` for real AI grading
- Step 4 shows the `SuccessEstimate` component (predicted days to sell)
- On submit, calls `POST /api/v1/produce/listings` to create the listing in the database

**Success Estimation** (shown in Step 4):
- Predicts how many days the listing will take to sell
- Based on 500 historical sale records in the `ListingSaleData` table
- Factors: price competitiveness (vs market), grade, trend, quantity
- Returns: estimated days, probability, category (fast/normal/slow/unlikely), suggestions

**Frontend:** `mobile/src/app/sell.tsx`
- 4-step wizard with progress indicator
- Each step validates before allowing progression
- GPS location via `expo-location` with reverse geocoding
- Integrates `AIPriceSuggestion` and `SuccessEstimate` components

**Backend:** `POST /api/v1/produce/listings` (`backend/src/routes/produce.routes.ts`)
- Creates a `ProduceListing` record with all fields
- Sets status to `ACTIVE`
- Links to the farmer's user ID
- Returns the created listing with ID

**In simple terms:** The sell flow guides the farmer through listing their produce step by step. At each step, AI helps — suggesting the price, grading the quality, and predicting how fast it will sell.

---

### 3.6 Marketplace

**What the user sees:**
- A scrolling price ticker at the top showing live wholesale prices for major crops
- A search bar to find specific produce
- Filter chips to filter by crop type
- A grid of listing cards, each showing: crop photo, name, price, quantity, location, quality grade badge, farmer's trust score
- Tapping a listing opens a detail modal with full description and "Make Offer" button

**How it works:**
- Market prices come from `GET /api/v1/market/prices` which queries the `MarketPrice` table
- Listings come from `GET /api/v1/produce/listings` with optional crop/county/grade filters
- Each listing card shows the farmer's trust score badge (calculated from real transaction data)
- The price ticker scrolls horizontally showing crop names, prices, and trend arrows

**Frontend:** `mobile/src/app/market.tsx`
- `FlatList` with `ListHeaderComponent` containing prices ticker, search, and filters (all scroll together — not sticky)
- Listing cards with Unsplash crop images, formatted prices, grade badges
- Detail modal with farmer info, description, "Make Offer" button
- Pull-to-refresh

**Backend:**
- `GET /api/v1/market/prices` — returns current wholesale/retail prices per crop with trend and % change
- `GET /api/v1/produce/listings` — returns paginated listings with farmer name and location
- Both endpoints query PostgreSQL and cache results in Redis

**In simple terms:** The marketplace is like an online market where buyers can browse all available produce, see the quality grade and price, and contact the farmer directly — no middleman needed.

---

### 3.7 Offers & Transaction Lifecycle

**What the user sees:**
- Buyer taps "Make Offer" on a listing, enters their offered price and quantity
- Farmer gets a notification, can accept or reject
- Once accepted, the transaction flows through: Pending → Accepted → Paid → In Transit → Delivered → Completed
- Both parties rate each other after completion

**How it works — the complete lifecycle:**

```
Buyer makes offer
  POST /api/v1/offers
       |
       v
Transaction created (status: PENDING)
       |
Farmer accepts ──→ status: ACCEPTED, listing: RESERVED
       |
Buyer pays via M-Pesa ──→ status: PAID (payment ref stored)
       |
Transporter picks up ──→ status: IN_TRANSIT
       |
Delivered to buyer ──→ status: DELIVERED
       |
Both parties rate ──→ status: COMPLETED (ratings stored)
```

**Frontend:** `mobile/src/app/orders.tsx`
- Shows all transactions for the current user (as buyer or seller)
- Status badges with colors (green = completed, yellow = pending, blue = in transit)
- Action buttons change based on status (Accept/Reject for farmer, Pay for buyer, etc.)

**Backend:** `backend/src/routes/offers.routes.ts`
- `POST /api/v1/offers` — creates a transaction with PENDING status
- `PUT /api/v1/offers/:id/accept` — sets ACCEPTED, reserves the listing
- `PUT /api/v1/offers/:id/pay` — records M-Pesa payment reference
- `PUT /api/v1/offers/:id/deliver` — marks as delivered
- `PUT /api/v1/offers/:id/complete` — finalizes, stores ratings
- Each status change creates a notification for the other party

**In simple terms:** When a buyer wants to purchase, they make an offer. If the farmer agrees, the produce is reserved. Payment happens via M-Pesa, then a transporter delivers it. Both sides rate each other, which builds their reputation on the platform.

---

### 3.8 Delivery Management

**What the user sees (Transporter):**
- Available delivery jobs in their area
- Active deliveries with pickup/dropoff details
- Delivery history with ratings received

**How it works:**
- Transporters can see and claim available delivery jobs
- Each delivery is linked to a transaction
- The transporter is assigned when the buyer pays
- Status updates flow to both farmer and buyer as notifications

**Frontend:** `mobile/src/app/deliveries.tsx`
- List of delivery jobs with status, pickup/dropoff locations
- Action buttons to update delivery status
- Map-ready (location data stored)

**Backend:** `backend/src/routes/delivery.routes.ts`
- `GET /api/v1/deliveries` — list available and assigned deliveries
- `PUT /api/v1/deliveries/:id/claim` — transporter claims a job
- `PUT /api/v1/deliveries/:id/status` — update delivery progress

**In simple terms:** Transporters are the third piece of the puzzle. They connect farmers to buyers by handling the physical delivery. The app matches them with delivery jobs in their area.

---

### 3.9 Market Intelligence Dashboard

**What the user sees:**
A dedicated intelligence screen showing:
- Market sentiment badge (Bullish/Bearish/Neutral)
- Counts of rising, falling, and stable crops
- AI-generated insights (text advice)
- "High Demand" section listing hot crops
- Per-crop price cards with: current price, week-ago price, month-ago price, trend arrow, % change, average days to sell
- Tap to expand: 7-day price forecast and "Best Time to Sell" recommendation

**How it works:**
- `GET /api/v1/market/intelligence` aggregates trend data across all crops
- For each crop, it calculates: current price (7-day average from PriceHistory), week-ago price, month-ago price, trend direction, % change
- Hot crops = crops with RISING trend
- Cold crops = crops with FALLING trend
- Market sentiment = based on ratio of rising vs falling crops
- 7-day forecast = linear projection from recent trend

**Frontend:** `mobile/src/app/intelligence.tsx`
- Summary card with sentiment badge and trend counts
- AI insights text section
- Hot crops badges with up-arrow indicators
- Expandable crop cards with detailed price history and forecast
- Pull-to-refresh

**Backend:** `GET /api/v1/market/intelligence` (`backend/src/routes/market.routes.ts`)
- Queries `PriceHistory` table for all crops
- Calls `calculateTrends()` for each crop (aggregates daily prices over 30 days)
- Computes sentiment, hot/cold crops, and text insights
- Response cached in Redis (TTL: 30 minutes)

**In simple terms:** This screen gives farmers and buyers a bird's-eye view of the whole market — which crops are in demand, where prices are heading, and when to sell for the best return.

---

### 3.10 Trust Score System

**What the user sees:**
- A trust score badge on their profile (e.g., "85/100 — Trusted")
- Detailed breakdown of how the score is calculated
- Other users see a summary badge (not the full details)

**How the score is calculated:**

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Transaction completion rate | 40% | How often deals are completed successfully |
| Average rating from others | 25% | Star ratings from buyers/sellers |
| Account age | 10% | How long they've been on the platform |
| Verification status | 10% | Whether their identity is verified |
| Response time | 10% | How fast they respond to offers |
| Dispute rate | 5% | How often transactions end in disputes |

**Frontend:** `mobile/src/components/TrustScoreBadge.tsx`
- Color-coded badge: green (80+), yellow (60-79), orange (40-59), red (<40)
- Shows score number and label (Excellent/Good/Fair/Poor)

**Backend:** `GET /api/v1/trust-score/:userId` (`backend/src/routes/trustScore.routes.ts`)
- Queries `Transaction` table for completion rates and counts
- Queries `User` table for ratings and account age
- Applies weighted formula
- Returns full breakdown (for own profile) or summary only (for others — DPA 2019 compliance)

**In simple terms:** Trust Score is like a credit score for the marketplace. It tells buyers "this farmer delivers on their promises" and tells farmers "this buyer pays on time." It's built from real behavior on the platform, not self-reported.

---

### 3.11 SACCO (Cooperative Savings)

**What the user sees:**
- Their SACCO group name and details
- Total savings balance
- Contribution history with dates and amounts
- Group statistics (total members, total balance)
- Option to make a new contribution via M-Pesa

**How it works:**
- SACCOs (Savings and Credit Cooperative Organizations) are a key part of Kenyan rural finance
- Users can join a SACCO group in their county
- Monthly contributions are tracked with M-Pesa payment references
- The savings balance is the foundation for future credit scoring

**Frontend:** `mobile/src/app/sacco.tsx`
- Group info card with name, county, contribution amount
- Savings balance display
- Contribution history list with status badges (Confirmed/Pending)
- "Contribute" button

**Backend:** `backend/src/routes/sacco.routes.ts`
- `GET /api/v1/sacco/groups` — list available SACCO groups
- `GET /api/v1/sacco/membership` — get user's membership and savings
- `GET /api/v1/sacco/balance` — current savings balance
- `GET /api/v1/sacco/transactions` — contribution history
- `POST /api/v1/sacco/contribute` — make a new contribution

**Database:** Three tables: `SaccoGroup` (group details), `SaccoMembership` (user-group link with savings), `SaccoContribution` (individual payments)

**In simple terms:** SACCO is like a savings club. Farmers contribute monthly, building up savings together. This savings history will eventually power credit scoring — proving to banks that these farmers are financially responsible, even without traditional credit history.

---

### 3.12 SMS Access (NLP)

**What the user sees (on a basic phone):**
They send a text message like:
- `"Bei ya nyanya Nairobi"` (Swahili: "Price of tomatoes Nairobi") → Gets current market prices
- `"Nina nyanya 50kg Embu"` (Swahili: "I have 50kg tomatoes in Embu") → Creates a basic listing
- `"Msaada"` (Swahili: "Help") → Gets help text

**How it works:**

```
Farmer sends SMS
       |
       v
Africa's Talking webhook
  POST /api/v1/sms/incoming
       |
       v
NLP Intent Parser
  - Detects language (EN/SW)
  - Classifies intent (price_check, list_produce, find_buyer, check_order, help)
  - Extracts entities (crop name, quantity, location)
       |
       v
Route to handler
  - price_check → query MarketPrice table
  - list_produce → create ProduceListing
  - help → return help text
       |
       v
Send SMS reply via Africa's Talking
```

**Supported intents:**

| Intent | Example Messages | Response |
|--------|-----------------|----------|
| `price_check` | "bei nyanya", "price potato Nairobi" | Current wholesale price, trend, suggestion |
| `list_produce` | "nina nyanya 50kg Embu", "sell mango 30kg Mombasa" | Confirms listing creation |
| `find_buyer` | "nunua nyanya", "buy tomato" | Lists active buyers |
| `check_order` | "hali", "order status" | Current order status |
| `help` | "msaada", "help" | Available commands |

**Backend:** `backend/src/routes/sms.routes.ts`
- `POST /api/v1/sms/incoming` — webhook for Africa's Talking
- `GET /api/v1/sms/test` — test endpoint for development
- Intent classification uses keyword matching with Swahili and English patterns
- Entity extraction parses crop names, quantities (with "kg" suffix), and location names

**In simple terms:** 70% of Kenyan smallholder farmers don't have smartphones. SMS access means they can still use the platform — check prices, list produce, and find buyers — all from a basic phone with no internet needed. The NLP understands both English and Swahili.

---

### 3.13 Notifications

**What the user sees:**
- A notification bell icon with unread count badge
- List of notifications: offer received, offer accepted, payment confirmed, delivery started, delivery completed, price alerts
- Tap to mark as read

**How it works:**
- Notifications are created server-side whenever a significant event occurs (offer, payment, delivery, etc.)
- Each notification has: type, title, message, data payload, read/unread status
- The frontend polls for new notifications and shows the unread count

**Frontend:** `mobile/src/app/notifications.tsx` + `mobile/src/context/NotificationContext.tsx`
- Notification list with type-based icons and colors
- Unread indicator on the navigation tab
- Mark as read on tap

**Backend:** `backend/src/routes/notification.routes.ts` + `backend/src/services/notificationService.ts`
- `GET /api/v1/notifications` — list user's notifications
- `PUT /api/v1/notifications/:id/read` — mark as read
- Service functions to create notifications for each event type

**In simple terms:** Users never miss important updates — when someone makes an offer on their produce, when payment comes through, or when prices change significantly.

---

### 3.14 User Profile & Settings

**What the user sees:**
- Profile card with name, role, county, member since date
- Trust Score badge
- Recent activity (last 5 transactions)
- Account settings: Edit Profile, Change PIN, Language, Notifications
- Support: Help Center, Contact Support, About
- Privacy: Privacy Policy, Data Export, Delete Account
- Verification status with upgrade option

**How it works:**
- Profile data from `GET /api/v1/users/{id}/stats`
- Edit Profile shows current info (in the future: editable fields)
- Change PIN explains the SMS-based reset process
- Help Center has 4 built-in FAQs
- Contact Support shows phone, SMS, email, and business hours
- About shows app description, features list, and DPA compliance info

**Frontend:** `mobile/src/app/profile.tsx`
- Profile header with avatar placeholder and role badge
- Trust Score badge component
- Settings sections with icons and navigation
- All buttons have real handlers (no "coming soon" dead-ends)

**Backend:**
- `GET /api/v1/users/:id/stats` — profile with transaction counts, revenue, rating
- `GET /api/v1/users/:id/public-profile` — limited public view (no phone, no precise location)
- `PUT /api/v1/users/:id` — update profile fields

**In simple terms:** The profile is the user's identity on the platform. It shows their track record, lets them manage their account, and provides access to support.

---

### 3.15 Bilingual Support (English/Swahili)

**What the user sees:**
Every screen, every label, every button works in both English and Swahili. Toggle from Profile → Language.

**How it works:**
- `LanguageContext` manages the current language (EN or SW) using React Context
- The `t()` function looks up translation keys and returns the correct string
- Language preference is persisted in AsyncStorage
- All screens use `t('key')` instead of hardcoded strings

**Frontend:** `mobile/src/context/LanguageContext.tsx`
- Translation dictionaries for EN and SW
- `t(key)` function returns translated string
- `setLanguage()` switches language and persists choice
- Language preference saved to device storage

**In simple terms:** A farmer in rural Kenya who speaks Swahili sees the entire app in their language. Switch is instant, no restart needed.

---

### 3.16 Privacy & Data Protection (Kenya DPA 2019)

**What we implemented:**

| DPA 2019 Requirement | Our Implementation |
|---------------------|-------------------|
| **Explicit consent** | `consentGivenAt` and `consentVersion` fields on every user record. Consent recorded at registration |
| **Right to access** | Users can see all their data through the profile. Data export available |
| **Right to erasure** | Users can request account deletion. Phone replaced with `deleted_{timestamp}`, 30-day processing window |
| **Data minimization** | Public profiles show only: name, county, role, rating. Phone/PIN/precise location are private |
| **Audit trail** | `AuditLog` table records: who accessed what, when, from which IP address |
| **Purpose limitation** | Trust Score details visible only to the user. Others see summary badge only |

**Frontend:** `mobile/src/app/privacy.tsx`
- Privacy policy display
- Data export request
- Account deletion request with confirmation

**Backend:** `AuditLog` model in database, consent tracking on User model, data anonymization in delete handler

**In simple terms:** We follow Kenya's Data Protection Act. Users control their own data — they can see it, export it, or delete it. We never show private information (like phone numbers) to strangers.

---

## 4. The 5 AI Capabilities

| # | Capability | Status | Technology | Data Source |
|---|-----------|--------|-----------|-------------|
| 1 | **Computer Vision Quality Grading** | Fully implemented | MobileNetV2 (transfer learning), TFLite converted | Trained on agricultural produce images |
| 2 | **NLP for SMS Access** | Fully implemented | Intent classification + entity extraction | Keyword patterns in EN and SW |
| 3 | **Price Discovery & Market Intelligence** | Fully implemented | Weighted algorithm with 5 factors | 47,000+ price records, Open-Meteo weather API |
| 4 | **Intelligent Matching** | Implemented (basic) | Location + quality + volume matching | Marketplace listings and buyer preferences |
| 5 | **Credit Scoring** | Foundation built | Trust Score algorithm | Transaction history, ratings, SACCO savings |

### How each AI capability helps farmers:

1. **Quality Grading** — No more guessing if your produce is "good enough." The AI tells you exactly what grade it is, what defects to watch for, and what price that grade commands.

2. **SMS Access** — Can't afford a smartphone? Text "bei nyanya" and get today's tomato price. Text "nina nyanya 50kg Embu" and your tomatoes are listed for sale.

3. **Price Intelligence** — Stop getting cheated by middlemen. See what your produce is actually worth in Nairobi, Mombasa, and Kisumu — not what a middleman tells you.

4. **Intelligent Matching** — Buyers looking for Grade A tomatoes in Nairobi see your listing first if you're nearby with the right quality.

5. **Credit Scoring** — Your transaction history on the platform becomes your credit history. Complete deals reliably, pay on time, and you build a score that can unlock loans through SACCO cooperatives.

---

## 5. Database Design

**16 tables** in PostgreSQL, managed by Prisma ORM:

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `User` | All platform users | phone, pin (hashed), name, role, county, rating, consentGivenAt |
| `ProduceListing` | Items for sale | farmerId, cropType, quantity, price, qualityGrade, status, images |
| `Transaction` | Buy/sell deals | listingId, buyerId, agreedPrice, status, paymentMethod, paymentRef |
| `GradingResult` | AI grading history | userId, imageHash, cropType, grade, confidence, defects, modelVersion |

### Market Data Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `PriceHistory` | 2 years of daily prices | cropType, market, county, price, supplyLevel, date, source |
| `MarketPrice` | Current snapshot prices | crop, market, wholesale, retail, trend, source |
| `WeatherData` | Climate data per county | county, temperature, rainfall, humidity, date, source |
| `PricePrediction` | Cached AI predictions | cropType, grade, county, recommendedPrice, confidence |
| `ListingSaleData` | ML training data | cropType, grade, askingPrice, marketPrice, sold, daysToSell |

### User Engagement Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `Notification` | User notifications | userId, type, title, message, isRead |
| `SmsLog` | SMS interaction history | userId, phone, message, intent, language |

### SACCO Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `SaccoGroup` | Cooperative groups | name, county, contributionAmount, memberCount, totalBalance |
| `SaccoMembership` | User-group link | userId, groupId, role, savings |
| `SaccoContribution` | Individual payments | membershipId, amount, paymentRef, status |
| `SaccoLoan` | Loan records | membershipId, amount, interestRate, status |

### System Table

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `AuditLog` | Compliance trail | userId, action, resource, ipAddress, timestamp |

### Key Relationships

```
User ──< ProduceListing (farmer has many listings)
User ──< Transaction (buyer has many purchases)
User ──< GradingResult (user has many gradings)
User ──< SaccoMembership ──< SaccoContribution
ProduceListing ──< Transaction (listing has many offers)
SaccoGroup ──< SaccoMembership (group has many members)
```

**Total seeded data:**
- 22 users (3 demo + 19 sample)
- 37 produce listings with crop images
- 6+ completed transactions with full lifecycle
- 47,000+ price history records
- 10,950+ weather records
- 500 listing sale records (ML training)
- 5 SACCO groups with memberships and contributions

---

## 6. ML Pipeline

### Training Process

```
Raw produce images
       |
       v
Data preparation (train/val/test splits)
       |
       v
Phase 1: Train classification head (base frozen)
  - MobileNetV2 backbone from ImageNet
  - Custom head: GlobalAvgPool → Dense(256) → Dense(128) → Dense(4)
  - Up to 50 epochs, early stopping on val_loss
       |
       v
Phase 2: Fine-tune last 30 layers
  - Unfreezes last 30 MobileNetV2 layers
  - Lower learning rate (0.0001)
  - Up to 20 more epochs
       |
       v
Export: Keras model + TFLite (float16 quantized)
       |
       v
Evaluation: Confusion matrix, per-class metrics, per-crop accuracy
       |
       v
Bias Testing: 5 fairness tests
  - Crop accuracy parity
  - Reject rate parity (4/5ths rule)
  - False positive rate parity
  - Confidence distribution by crop
  - Misclassification pattern analysis
       |
       v
Deploy to Flask server
```

### Model Files

| File | Purpose | Size |
|------|---------|------|
| `finetuned_model_20260208-220932.keras` | Best fine-tuned model | Full Keras |
| `best_model_20260208-220932.keras` | Best Phase 1 model | Full Keras |
| `quality_grading_latest.tflite` | Mobile-ready model | Float16 quantized |
| `bias_report_20260209-195535.json` | Fairness test results | JSON |

### Data Augmentation

During training, images are randomly:
- Flipped horizontally and vertically
- Rotated up to ~30 degrees
- Zoomed up to 20%
- Brightness adjusted up to 20%
- Contrast adjusted up to 20%

This prevents the model from memorizing specific photos and makes it work better on real-world images with different lighting and angles.

### Class Imbalance Handling

Not all grades have the same number of training images. To prevent the model from being biased toward the most common grade, we compute **class weights** — grades with fewer images get higher weight during training so the model pays equal attention to all grades.

---

## 7. Infrastructure

### Docker Compose (4 Services)

```yaml
services:
  postgres:     # PostgreSQL 15 - Database
  redis:        # Redis 7 - Cache
  backend:      # Node.js/Express - API server
  ml-server:    # Flask/TensorFlow - AI model server
```

**One command to start everything:** `docker-compose up -d`

The backend waits for PostgreSQL to be healthy before starting. All services communicate through Docker's internal network. Data persists in named volumes.

### Local Development

For development without Docker:

```bash
# Terminal 1: ML Server (AI model)
cd ml && python server.py

# Terminal 2: Backend API
cd backend && npm run dev

# Terminal 3: Mobile App
cd mobile && npx expo start
```

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (required) |
| `JWT_SECRET` | Token signing key | `dev-secret-change-in-prod` |
| `ML_SERVER_URL` | Flask ML server | `http://localhost:5000` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `AFRICAS_TALKING_API_KEY` | SMS gateway | (optional) |

---

## 8. Testing

### End-to-End Tests (`backend/scripts/e2eTest.ts`)

Tests the complete happy path across 9 areas:

| Test Area | What It Tests |
|-----------|--------------|
| Registration | Create farmer, buyer, transporter accounts |
| Authentication | Login, token verification, unauthorized rejection |
| Quality Grading | Image upload, grade response, valid grade values |
| Marketplace | Create listing, browse, filter by crop and county |
| Offers & Transactions | Full lifecycle: offer → accept → pay → deliver → complete → rate |
| Market Intelligence | Prices, predictions, trends, forecasts, weather |
| SMS Service | 8 intent tests in English and Swahili |
| User & Trust Score | Stats, trust score calculation, profile updates |
| Grading Dispute | Submit dispute, verify flagged |

### Load Tests (`backend/scripts/loadTest.ts`)

| Test | What It Measures |
|------|-----------------|
| Response Time Benchmarks | 20 iterations per endpoint, reports avg/min/max/p95 |
| Concurrent Requests | 10, 25, 50 simultaneous requests |
| Rate Limiter | Verifies 429 responses after threshold |
| Payload Limits | Rejects oversized uploads (>5MB image, >10MB JSON) |

### ML Bias Tests (`ml/training/quality_grading/bias_test.py`)

5 fairness tests to ensure the AI doesn't discriminate:

| Test | What It Checks |
|------|---------------|
| Crop Accuracy Parity | No crop's accuracy is >15% below average |
| Reject Rate Parity | No crop is rejected at >2x the average rate |
| False Positive Rate Parity | FPR gap between grades is <10% |
| Confidence Distribution | No crop's confidence is >15% below average |
| Misclassification Patterns | No systematic misclassification >50% for any group |

---

## 9. Security

| Measure | Implementation |
|---------|---------------|
| **Authentication** | JWT tokens, 7-day expiry, bcrypt-hashed PINs |
| **Rate Limiting** | 5 auth attempts per 15 min, general API rate limits |
| **HTTP Security** | Helmet middleware (XSS protection, content security policy, etc.) |
| **Input Validation** | Request validation on all endpoints |
| **File Upload** | 5MB limit, image-only MIME types |
| **CORS** | Restricted to configured origins |
| **Data Privacy** | DPA 2019 compliant, consent tracking, audit logging |
| **Public vs Private** | Public profiles hide phone, PIN, precise location |

---

## API Endpoint Summary

### Authentication (2 endpoints)
- `POST /api/v1/auth/register` — Create account
- `POST /api/v1/auth/login` — Get JWT token

### Produce & Listings (4 endpoints)
- `POST /api/v1/produce/grade` — AI quality grading
- `POST /api/v1/produce/listings` — Create listing
- `GET /api/v1/produce/listings` — Browse/filter listings
- `GET /api/v1/produce/listings/:id` — Listing detail

### Offers & Transactions (5+ endpoints)
- `POST /api/v1/offers` — Make offer
- `PUT /api/v1/offers/:id/accept` — Accept offer
- `PUT /api/v1/offers/:id/pay` — Record payment
- `PUT /api/v1/offers/:id/deliver` — Mark delivered
- `PUT /api/v1/offers/:id/complete` — Complete with rating

### Market Intelligence (6 endpoints)
- `GET /api/v1/market/prices` — Current market prices
- `POST /api/v1/market/predict-price` — AI price prediction
- `POST /api/v1/market/success-estimate` — Sales prediction
- `GET /api/v1/market/trends` — Price trends with forecast
- `GET /api/v1/market/intelligence` — Full market dashboard
- `GET /api/v1/market/weather` — Weather data

### Users & Trust (4 endpoints)
- `GET /api/v1/users/:id/stats` — User statistics
- `GET /api/v1/users/:id/public-profile` — Public profile
- `GET /api/v1/trust-score/:id` — Full trust score
- `GET /api/v1/trust-score/:id/summary` — Trust summary

### SACCO (5 endpoints)
- `GET /api/v1/sacco/groups` — Available groups
- `GET /api/v1/sacco/membership` — User membership
- `GET /api/v1/sacco/balance` — Savings balance
- `GET /api/v1/sacco/transactions` — Contribution history
- `POST /api/v1/sacco/contribute` — New contribution

### SMS (2 endpoints)
- `POST /api/v1/sms/incoming` — Africa's Talking webhook
- `GET /api/v1/sms/test` — Test SMS parsing

### Notifications (2 endpoints)
- `GET /api/v1/notifications` — List notifications
- `PUT /api/v1/notifications/:id/read` — Mark as read

### Deliveries (3 endpoints)
- `GET /api/v1/deliveries` — List deliveries
- `PUT /api/v1/deliveries/:id/claim` — Claim delivery job
- `PUT /api/v1/deliveries/:id/status` — Update status

**Total: 35+ API endpoints across 10 route modules**

---

*This documentation covers the complete SunHarvest Connect system as of February 2026.*
