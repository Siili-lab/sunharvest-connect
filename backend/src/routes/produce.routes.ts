import { Router, Request, Response } from 'express';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Quality grades with pricing
const gradeInfo = {
  Premium: { minPrice: 110, maxPrice: 130, description: 'Excellent quality, no defects' },
  'Grade A': { minPrice: 85, maxPrice: 110, description: 'Good quality, minor blemishes' },
  'Grade B': { minPrice: 50, maxPrice: 85, description: 'Acceptable quality, some defects' },
  Reject: { minPrice: 0, maxPrice: 30, description: 'Below market standard' },
};

// POST /api/v1/produce/grade
router.post('/grade', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: { code: 'NO_IMAGE', message: 'Image is required' },
      });
    }

    const cropType = req.body.cropType || 'tomato';

    // Mock ML grading - will be replaced with TFLite inference
    const grades = ['Premium', 'Grade A', 'Grade B'] as const;
    const grade = grades[Math.floor(Math.random() * grades.length)];
    const confidence = 0.75 + Math.random() * 0.2;
    const info = gradeInfo[grade];
    const suggestedPrice = Math.round(
      info.minPrice + Math.random() * (info.maxPrice - info.minPrice)
    );

    res.json({
      success: true,
      data: {
        grade,
        confidence: Math.round(confidence * 100) / 100,
        suggestedPrice,
        currency: 'KSh',
        unit: 'kg',
        cropType,
        defects: grade === 'Premium' ? [] : ['Minor surface blemishes'],
        gradedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: { code: 'GRADING_FAILED', message: 'Failed to grade image' },
    });
  }
});

// GET /api/v1/produce/listings
router.get('/listings', async (req: Request, res: Response) => {
  // Mock listings - will come from database
  const listings = [
    { id: '1', crop: 'Tomatoes', grade: 'Grade A', price: 100, quantity: 50, farmer: 'John M.', location: 'Kiambu' },
    { id: '2', crop: 'Potatoes', grade: 'Premium', price: 80, quantity: 100, farmer: 'Mary W.', location: 'Nakuru' },
    { id: '3', crop: 'Onions', grade: 'Grade B', price: 60, quantity: 30, farmer: 'Peter K.', location: 'Nairobi' },
  ];

  res.json({ success: true, data: listings });
});

// POST /api/v1/produce/listings
router.post('/listings', async (req: Request, res: Response) => {
  const { cropType, grade, price, quantity } = req.body;

  // TODO: Save to database
  res.status(201).json({
    success: true,
    data: {
      id: 'listing_' + Date.now(),
      cropType,
      grade,
      price,
      quantity,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  });
});

export { router as produceRouter };
