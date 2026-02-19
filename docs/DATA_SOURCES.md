# SunHarvest Connect — Data Sources Documentation

## Overview

SunHarvest Connect's database is populated with realistic agricultural market data modelled on actual Kenyan wholesale market patterns. This document describes each data source, its origin, volume, and how it is used within the platform.

---

## 1. Market Price Data

| Attribute | Detail |
|-----------|--------|
| **Source type** | Synthetic, modelled on FAO and Kenya National Bureau of Statistics (KNBS) wholesale price patterns |
| **Crops covered** | 13 — Tomatoes, Mangoes, Onions, Potatoes, Cabbage, Kale, Spinach, Avocado, Bananas, Oranges, Peppers, Carrots, Other |
| **Markets covered** | 5 major Kenyan wholesale markets |
| **Time span** | 2 years of daily records |
| **Total records** | ~47,450 (13 crops × 5 markets × 730 days) |
| **Storage** | `PriceHistory` table in PostgreSQL |
| **Source field** | `SYNTHETIC` (enum: `FAO`, `GOVERNMENT`, `PLATFORM`, `SYNTHETIC`) |

### Markets

| Market | County |
|--------|--------|
| Wakulima Market | Nairobi |
| Marikiti Market | Nairobi |
| Kongowea Market | Mombasa |
| Kibuye Market | Kisumu |
| Nakuru Municipal Market | Nakuru |

### Base Prices (KES/kg)

Derived from 2024 Kenya wholesale market price ranges:

| Crop | Min | Avg | Max |
|------|-----|-----|-----|
| Tomatoes | 40 | 90 | 160 |
| Mangoes | 30 | 60 | 120 |
| Onions | 50 | 85 | 150 |
| Potatoes | 35 | 55 | 100 |
| Cabbage | 20 | 40 | 80 |
| Kale | 25 | 45 | 70 |
| Spinach | 30 | 50 | 80 |
| Avocado | 40 | 80 | 150 |
| Bananas | 20 | 35 | 60 |
| Oranges | 30 | 55 | 100 |
| Peppers | 80 | 140 | 250 |
| Carrots | 40 | 70 | 120 |

### Seasonal Modelling

Price generation incorporates Kenya's bimodal rainfall pattern:

- **Long rains:** March – May
- **Short rains:** October – December
- **Harvest periods:** Crop-specific (e.g., mangoes peak Nov–Feb, avocados Mar–Aug)

Price formula factors:
1. **Seasonal multiplier** — lower prices during harvest (0.7–0.9×), higher in dry season (1.0–1.3×)
2. **Market multiplier** — Nairobi prices 10% above other markets (urban demand premium)
3. **Daily variation** — ±10% random noise for realistic fluctuation
4. **Year-over-year inflation** — ~5% annual increase reflecting Kenya's agricultural inflation

### Reference

- FAO FAOSTAT: [fao.org/faostat](https://www.fao.org/faostat)
- Kenya National Bureau of Statistics: [knbs.or.ke](https://www.knbs.or.ke)
- Kenya National Farmers Information Service (NAFIS)

---

## 2. Weather Data

| Attribute | Detail |
|-----------|--------|
| **Historical source** | Synthetic, modelled on Kenya Meteorological Department climate normals |
| **Real-time source** | Open-Meteo API (free, no API key required) |
| **Counties covered** | 15 agricultural counties |
| **Time span** | 2 years historical + daily live sync |
| **Total records** | ~10,950 historical + daily updates |
| **Storage** | `WeatherData` table in PostgreSQL |
| **Variables** | Temperature (°C), Rainfall (mm), Humidity (%) |

### Counties

Kiambu, Nakuru, Nairobi, Mombasa, Kisumu, Uasin Gishu, Trans Nzoia, Nyandarua, Meru, Embu, Machakos, Kajiado, Nyeri, Murang'a, Kirinyaga

### Open-Meteo Integration

Real-time weather is fetched daily from the Open-Meteo API:

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude={lat}&longitude={lon}
  &current=temperature_2m,relative_humidity_2m,precipitation
```

- **API provider:** [Open-Meteo](https://open-meteo.com) — free, open-source weather API
- **Authentication:** None required
- **Rate limits:** Fair use (no hard limit for reasonable usage)
- **Data updates:** Synced on each seed run and available via scheduled cron

### Climate Modelling

Historical weather generation follows Kenya climate patterns:
- **Temperature:** 15–30°C depending on altitude (Nairobi baseline 20°C, coastal/lowland 25°C)
- **Rainfall:** 5–25mm/day during rainy seasons, 0–5mm/day during dry seasons
- **Humidity:** 60–90% during rains, 40–60% during dry periods

---

## 3. Listing Sale Data (ML Training)

| Attribute | Detail |
|-----------|--------|
| **Source** | Synthetic, generated to train the price success prediction model |
| **Records** | 500 sample listings |
| **Storage** | `ListingSaleData` table in PostgreSQL |
| **Sell rate** | 80% sold, 20% expired (realistic marketplace conversion) |

### Features per record

| Field | Description |
|-------|-------------|
| `cropType` | One of 13 crop types |
| `grade` | PREMIUM, GRADE_A, GRADE_B, or REJECT |
| `county` | One of 15 Kenyan counties |
| `quantity` | 10–210 kg |
| `askingPrice` | Farmer's listed price (KES/kg) |
| `marketPrice` | Current wholesale price at time of listing |
| `priceRatio` | askingPrice / marketPrice (0.7–1.3) |
| `sold` | Whether the listing resulted in a sale |
| `daysToSell` | Days from listing to sale (if sold) |
| `finalPrice` | Actual transaction price (95–105% of asking) |

### Modelling logic

- **Competitive pricing** (ratio < 0.85): sells in 1–3 days
- **Fair pricing** (ratio 0.85–1.15): sells in 2–11 days
- **Overpriced** (ratio > 1.15): sells in 7–21 days or expires
- **Grade impact:** Premium sells 30% faster, Reject 50% slower

---

## 4. Transaction Data

| Attribute | Detail |
|-----------|--------|
| **Source** | Seeded demo data representing realistic marketplace transactions |
| **Records** | 6+ completed transactions across 3 demo accounts |
| **Storage** | `Transaction` table in PostgreSQL |
| **Payment method** | M-Pesa (simulated with realistic reference codes) |

### Transaction lifecycle

`PENDING → ACCEPTED → PAYMENT_PENDING → PAID → IN_TRANSIT → DELIVERED → COMPLETED`

Each transaction includes: agreed price, quantity, payment reference, pickup/delivery dates, buyer/seller ratings, and transporter assignment.

---

## 5. User & Demo Account Data

| Attribute | Detail |
|-----------|--------|
| **Demo accounts** | 3 personas (Farmer, Buyer, Transporter) |
| **Total users** | 22 seeded users |
| **Listings** | 37 active produce listings with Unsplash crop images |
| **Notifications** | 12+ across all demo accounts |

### Demo personas

| Role | Name | County | Phone |
|------|------|--------|-------|
| Farmer | John Mwangi | Kiambu | +254712345678 |
| Buyer | Sarah Ochieng | Nairobi | +254723456789 |
| Transporter | James Kiprop | Nakuru | +254734567890 |

---

## 6. SACCO Cooperative Data

| Attribute | Detail |
|-----------|--------|
| **Groups** | 1+ SACCO cooperative (Kiambu Farmers Cooperative) |
| **Memberships** | Farmer and Buyer accounts enrolled |
| **Contributions** | Monthly M-Pesa contributions (KSh 2,000/month) |
| **Storage** | `SaccoGroup`, `SaccoMembership`, `SaccoContribution` tables |

---

## Data Pipeline

```
Seed Script (npx ts-node prisma/seed.ts)
  │
  ├── generateHistoricalPriceData()    → 47,450 PriceHistory records
  ├── generateHistoricalWeatherData()  → 10,950 WeatherData records
  ├── generateListingSaleData()        → 500 ListingSaleData records
  ├── syncRealWeatherData()            → Live Open-Meteo fetch for 15 counties
  ├── seedMarketPriceSnapshots()       → Current MarketPrice snapshots
  ├── seedCompletedTransactions()      → Demo transaction lifecycle data
  └── seedSaccoData()                  → SACCO memberships & contributions

Supplemental Scripts:
  ├── seedDemoAccounts.ts              → Buyer/transporter data + listing images
  └── seedTransactions.ts              → Standalone transaction seeder
```

---

## Data Protection (Kenya DPA 2019)

- All synthetic data follows DPA 2019 guidelines
- No real personal data is used in seeding
- Demo phone numbers are fictional (+254 7XX format)
- Public API endpoints expose only: name, county, role, rating, verification status
- Private data (phone, PIN, precise location) requires authentication
- Consent tracking fields (`consentGivenAt`, `consentVersion`) on all user records
- `AuditLog` model records all data access events

---

## Reproducing the Data

```bash
# Full seed (all data from scratch)
cd backend
npx ts-node prisma/seed.ts

# Demo accounts only (buyer, transporter, images)
npx ts-node prisma/seedDemoAccounts.ts

# Transactions only (without re-seeding market data)
npx ts-node prisma/seedTransactions.ts
```

All seed scripts are idempotent — they use `upsert` operations and check for existing data before creating duplicates.
