/**
 * End-to-End Integration Test
 *
 * Run: npx ts-node scripts/e2eTest.ts
 *
 * Tests the full flow:
 *   register → login → grade produce → create listing → browse →
 *   make offer → accept → pay → deliver → complete →
 *   SMS (price check, list produce, find buyer, check order) →
 *   market intelligence → weather → trust score
 *
 * Requires the backend to be running on localhost:3000
 */

import axios from 'axios';

const API = process.env.TEST_URL || 'http://localhost:3000/api/v1';
const BASE = API.replace('/api/v1', '');

// Unique phone numbers for each test run (avoids duplicate conflicts)
const suffix = Date.now().toString().slice(-6);
const FARMER_PHONE = `+2547${suffix}01`;
const BUYER_PHONE = `+2547${suffix}02`;
const TRANSPORTER_PHONE = `+2547${suffix}03`;

let farmerToken = '';
let buyerToken = '';
let transporterToken = '';
let farmerId = '';
let buyerId = '';
let transporterId = '';
let gradingId = '';
let listingId = '';
let offerId = '';
let transactionId = '';

let passed = 0;
let failed = 0;
const failures: string[] = [];

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  \x1b[32mPASS\x1b[0m  ${name}`);
    passed++;
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}`);
    console.log(`        ${msg}`);
    failures.push(`${name}: ${msg}`);
    failed++;
  }
}

// Minimal valid JPEG buffer (1x1 pixel)
function createTestJpeg(): Buffer {
  return Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
    0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
    0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
    0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
    0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7B, 0x94,
    0x11, 0x00, 0x00, 0x00, 0x00, 0xFF, 0xD9,
  ]);
}

async function run() {
  console.log('=== SunHarvest Connect E2E Integration Test ===\n');
  console.log(`API: ${API}`);
  console.log(`Test phones: farmer=${FARMER_PHONE}, buyer=${BUYER_PHONE}\n`);

  // Check backend is running
  try {
    const health = await axios.get(`${BASE}/health`);
    console.log(`Backend: ${health.data.status} (${BASE})\n`);
  } catch {
    console.log(`ERROR: Backend not running on ${BASE}`);
    console.log('Start it with: cd backend && npx ts-node src/server.ts');
    process.exit(1);
  }

  // =============================================
  // 1. REGISTRATION
  // =============================================
  console.log('1. Registration');

  await test('Register farmer', async () => {
    const res = await axios.post(`${API}/auth/register`, {
      name: 'E2E Test Farmer',
      phone: FARMER_PHONE,
      pin: '1234',
      location: 'Kiambu',
      userType: 'farmer',
    });
    farmerToken = res.data.data.token;
    farmerId = res.data.data.user.id;
    if (!farmerToken) throw new Error('No token returned');
  });

  await test('Register buyer', async () => {
    const res = await axios.post(`${API}/auth/register`, {
      name: 'E2E Test Buyer',
      phone: BUYER_PHONE,
      pin: '5678',
      location: 'Nairobi',
      userType: 'buyer',
    });
    buyerToken = res.data.data.token;
    buyerId = res.data.data.user.id;
    if (!buyerToken) throw new Error('No token returned');
  });

  await test('Register transporter', async () => {
    const res = await axios.post(`${API}/auth/register`, {
      name: 'E2E Test Transporter',
      phone: TRANSPORTER_PHONE,
      pin: '9012',
      location: 'Nairobi',
      userType: 'transporter',
    });
    transporterToken = res.data.data.token;
    transporterId = res.data.data.user.id;
    if (!transporterToken) throw new Error('No token returned');
  });

  // =============================================
  // 2. AUTHENTICATION
  // =============================================
  console.log('\n2. Authentication');

  await test('Farmer login', async () => {
    const res = await axios.post(`${API}/auth/login`, {
      phone: FARMER_PHONE,
      pin: '1234',
    });
    farmerToken = res.data.data.token; // Refresh token
    if (!farmerToken) throw new Error('No token returned');
  });

  await test('Get farmer profile (auth/me)', async () => {
    const res = await axios.get(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    if (!res.data.data.name) throw new Error('No name in profile');
  });

  await test('Reject request without token', async () => {
    try {
      await axios.get(`${API}/auth/me`);
      throw new Error('Should have been rejected');
    } catch (err: any) {
      if (err.response?.status !== 401) throw new Error(`Expected 401, got ${err.response?.status}`);
    }
  });

  // =============================================
  // 3. QUALITY GRADING
  // =============================================
  console.log('\n3. Quality Grading');

  await test('Grade produce image', async () => {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('image', createTestJpeg(), { filename: 'test.jpg', contentType: 'image/jpeg' });
    form.append('cropType', 'tomato');
    form.append('county', 'Kiambu');

    const res = await axios.post(`${API}/produce/grade`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${farmerToken}`,
      },
    });

    gradingId = res.data.data.id;
    const data = res.data.data;
    if (!data.grade) throw new Error('No grade returned');
    if (!data.suggestedPrice) throw new Error('No suggested price');
    if (!data.confidence) throw new Error('No confidence score');
    if (typeof data.defects === 'undefined') throw new Error('No defects array');
  });

  await test('Grade returns valid grade value', async () => {
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('image', createTestJpeg(), { filename: 'test2.jpg', contentType: 'image/jpeg' });
    form.append('cropType', 'mango');

    const res = await axios.post(`${API}/produce/grade`, form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${farmerToken}`,
      },
    });

    const validGrades = ['Premium', 'Grade A', 'Grade B', 'Reject'];
    if (!validGrades.includes(res.data.data.grade)) {
      throw new Error(`Invalid grade: ${res.data.data.grade}`);
    }
  });

  // =============================================
  // 4. MARKETPLACE LISTINGS
  // =============================================
  console.log('\n4. Marketplace Listings');

  await test('Create listing (farmer)', async () => {
    const res = await axios.post(`${API}/produce/listings`, {
      cropType: 'tomato',
      grade: 'Grade A',
      price: 95,
      quantity: 100,
      county: 'Kiambu',
      description: 'Fresh tomatoes from E2E test',
    }, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });

    listingId = res.data.data.id;
    if (!listingId) throw new Error('No listing ID returned');
  });

  await test('Browse listings (public)', async () => {
    const res = await axios.get(`${API}/produce/listings?limit=10`);
    if (!Array.isArray(res.data.data)) throw new Error('Data is not an array');
    if (res.data.data.length === 0) throw new Error('No listings found');
  });

  await test('Filter listings by crop and county', async () => {
    const res = await axios.get(`${API}/produce/listings?crop=tomato&county=Kiambu`);
    if (!res.data.success) throw new Error('Filter failed');
  });

  // =============================================
  // 5. OFFERS & TRANSACTION LIFECYCLE
  // =============================================
  console.log('\n5. Offers & Transaction Lifecycle');

  await test('Create offer (buyer)', async () => {
    const res = await axios.post(`${API}/offers`, {
      listingId,
      quantity: 50,
      price: 90,
      message: 'E2E test offer - want 50kg',
    }, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });

    offerId = res.data.data?.id || res.data.offer?.id;
    if (!offerId) throw new Error('No offer ID returned');
  });

  await test('Accept offer (farmer)', async () => {
    const res = await axios.put(`${API}/offers/${offerId}/accept`, {}, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    if (!res.data.success) throw new Error('Accept failed');
  });

  await test('Pay offer (buyer via M-Pesa)', async () => {
    const res = await axios.put(`${API}/offers/${offerId}/pay`, {
      paymentRef: 'QKE2ETEST001',
      paymentMethod: 'MPESA',
    }, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    if (!res.data.success) throw new Error('Payment failed');
  });

  await test('Mark as delivered (transporter/farmer)', async () => {
    const res = await axios.put(`${API}/offers/${offerId}/deliver`, {}, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    if (!res.data.success) throw new Error('Delivery marking failed');
  });

  await test('Complete transaction (buyer confirms receipt)', async () => {
    const res = await axios.put(`${API}/offers/${offerId}/complete`, {
      rating: 5,
    }, {
      headers: { Authorization: `Bearer ${buyerToken}` },
    });
    if (!res.data.success) throw new Error('Completion failed');
  });

  // =============================================
  // 6. MARKET INTELLIGENCE
  // =============================================
  console.log('\n6. Market Intelligence');

  await test('Get market prices (all crops)', async () => {
    const res = await axios.get(`${API}/market/prices`);
    if (!res.data.success) throw new Error('Failed to get prices');
    if (!Array.isArray(res.data.data)) throw new Error('Expected array of prices');
  });

  await test('Get price for specific crop', async () => {
    const res = await axios.get(`${API}/market/prices?crop=tomato`);
    if (!res.data.data.wholesale) throw new Error('No wholesale price');
  });

  await test('AI price prediction', async () => {
    const res = await axios.post(`${API}/market/predict-price`, {
      crop: 'tomato',
      grade: 'Grade A',
      quantity: 100,
      county: 'Kiambu',
    }, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    if (!res.data.data.recommendedPrice) throw new Error('No recommended price');
    if (!res.data.data.reasoning) throw new Error('No reasoning provided');
  });

  await test('Success estimation (time to sell)', async () => {
    const res = await axios.post(`${API}/market/success-estimate`, {
      crop: 'tomato',
      grade: 'Grade A',
      price: 95,
      quantity: 100,
      county: 'Kiambu',
    }, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    if (typeof res.data.data.probability !== 'number') throw new Error('No probability');
    if (typeof res.data.data.estimatedDays !== 'number') throw new Error('No estimatedDays');
  });

  await test('Market trends with history and forecast', async () => {
    const res = await axios.get(`${API}/market/trends?crop=tomato`);
    if (!res.data.data.trend) throw new Error('No trend');
    if (!res.data.data.forecast) throw new Error('No forecast');
  });

  await test('Market intelligence dashboard', async () => {
    const res = await axios.get(`${API}/market/intelligence`);
    if (!res.data.data.crops) throw new Error('No crop data');
    if (!res.data.data.summary) throw new Error('No market summary');
  });

  await test('Weather data for county', async () => {
    const res = await axios.get(`${API}/market/weather?county=Nairobi`);
    if (!res.data.data.farmingOutlook) throw new Error('No farming outlook');
    if (!res.data.data.advice) throw new Error('No farming advice');
  });

  // =============================================
  // 7. SMS SERVICE
  // =============================================
  console.log('\n7. SMS Service');

  await test('SMS: price check (bei nyanya)', async () => {
    const res = await axios.get(`${API}/sms/test?message=bei%20nyanya`);
    if (res.data.data.intent !== 'price_check') throw new Error(`Wrong intent: ${res.data.data.intent}`);
    if (res.data.data.entities.crop !== 'tomato') throw new Error('Wrong crop');
    if (!res.data.data.response.includes('KSh')) throw new Error('No price in response');
  });

  await test('SMS: help (msaada)', async () => {
    const res = await axios.get(`${API}/sms/test?message=msaada`);
    if (res.data.data.intent !== 'help') throw new Error(`Wrong intent: ${res.data.data.intent}`);
    if (res.data.data.lang !== 'sw') throw new Error('Should detect Swahili');
  });

  await test('SMS: list produce (nina nyanya 50kg Embu)', async () => {
    const res = await axios.get(`${API}/sms/test?message=nina%20nyanya%2050kg%20Embu`);
    if (res.data.data.intent !== 'list_produce') throw new Error(`Wrong intent: ${res.data.data.intent}`);
    if (res.data.data.entities.crop !== 'tomato') throw new Error('Wrong crop');
    if (res.data.data.entities.quantity !== 50) throw new Error('Wrong quantity');
    if (res.data.data.entities.location !== 'Embu') throw new Error('Wrong location');
  });

  await test('SMS: sell in English (sell mango 30kg Mombasa)', async () => {
    const res = await axios.get(`${API}/sms/test?message=sell%20mango%2030kg%20Mombasa`);
    if (res.data.data.intent !== 'list_produce') throw new Error(`Wrong intent: ${res.data.data.intent}`);
    if (res.data.data.entities.crop !== 'mango') throw new Error('Wrong crop');
    if (res.data.data.entities.quantity !== 30) throw new Error('Wrong quantity');
  });

  await test('SMS: find buyer (nunua nyanya)', async () => {
    const res = await axios.get(`${API}/sms/test?message=nunua%20nyanya`);
    if (res.data.data.intent !== 'find_buyer') throw new Error(`Wrong intent: ${res.data.data.intent}`);
  });

  await test('SMS: check order (hali)', async () => {
    const res = await axios.get(`${API}/sms/test?message=hali`);
    if (res.data.data.intent !== 'check_order') throw new Error(`Wrong intent: ${res.data.data.intent}`);
  });

  await test('SMS: English price check (price potato)', async () => {
    const res = await axios.get(`${API}/sms/test?message=price%20potato`);
    if (res.data.data.intent !== 'price_check') throw new Error(`Wrong intent: ${res.data.data.intent}`);
    if (res.data.data.lang !== 'en') throw new Error('Should detect English');
  });

  await test('SMS webhook (simulated incoming)', async () => {
    const res = await axios.post(`${API}/sms/incoming`, {
      from: FARMER_PHONE,
      text: 'bei vitunguu',
      to: '20880',
    });
    if (!res.data.success) throw new Error('Webhook failed');
    if (res.data.data.intent !== 'price_check') throw new Error('Wrong intent from webhook');
  });

  // =============================================
  // 8. USER & TRUST SCORE
  // =============================================
  console.log('\n8. User & Trust Score');

  await test('Get user stats', async () => {
    const res = await axios.get(`${API}/users/${farmerId}/stats`, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    if (!res.data.data.role) throw new Error('No role returned');
  });

  await test('Get trust score', async () => {
    const res = await axios.get(`${BASE}/api/trust-score/${farmerId}`);
    if (typeof res.data.score !== 'number') throw new Error('No score returned');
  });

  await test('Get trust score summary', async () => {
    const res = await axios.get(`${BASE}/api/trust-score/${farmerId}/summary`);
    if (!res.data.level) throw new Error('No trust level returned');
  });

  await test('Update user profile', async () => {
    const res = await axios.put(`${API}/users/${farmerId}`, {
      county: 'Nakuru',
      language: 'SW',
    }, {
      headers: { Authorization: `Bearer ${farmerToken}` },
    });
    if (!res.data.success) throw new Error('Profile update failed');
  });

  // =============================================
  // 9. GRADING DISPUTE (Human-in-the-loop)
  // =============================================
  console.log('\n9. Grading Dispute Flow');

  if (gradingId) {
    await test('Dispute a grade', async () => {
      const res = await axios.post(`${API}/grading/${gradingId}/dispute`, {
        reason: 'I believe this should be Premium grade',
      }, {
        headers: { Authorization: `Bearer ${farmerToken}` },
      });
      if (!res.data.data.isDisputed) throw new Error('Grade not marked as disputed');
    });
  }

  // =============================================
  // SUMMARY
  // =============================================
  console.log('\n' + '='.repeat(50));
  console.log(`\nRESULTS: \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m, ${passed + failed} total`);

  if (failures.length > 0) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  - ${f}`));
  }

  if (failed === 0) {
    console.log('\n\x1b[32mAll tests passed!\x1b[0m\n');
  } else {
    console.log(`\n\x1b[31m${failed} test(s) failed.\x1b[0m\n`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
