/**
 * Mock ML Grading Model
 *
 * Crop-aware mock that simulates realistic quality grading predictions.
 * When the real TFLite model is ready, create tfliteGradingModel.ts with the
 * same interface and toggle via USE_REAL_ML env flag.
 */

type GradeLabel = 'Premium' | 'Grade A' | 'Grade B' | 'Reject';

export interface GradingPrediction {
  grade: GradeLabel;
  confidence: number;
  defects: string[];
}

// Crop-specific defect pools
const CROP_DEFECTS: Record<string, string[]> = {
  tomato: ['cracking', 'sunscald', 'blossom end rot', 'catfacing'],
  tomatoes: ['cracking', 'sunscald', 'blossom end rot', 'catfacing'],
  mango: ['anthracnose', 'latex burn', 'stem-end rot', 'lenticel spotting'],
  mangoes: ['anthracnose', 'latex burn', 'stem-end rot', 'lenticel spotting'],
  potato: ['greening', 'scab', 'growth cracks', 'hollow heart'],
  potatoes: ['greening', 'scab', 'growth cracks', 'hollow heart'],
  onion: ['neck rot', 'black mold', 'splitting', 'sunburn'],
  onions: ['neck rot', 'black mold', 'splitting', 'sunburn'],
  cabbage: ['black rot', 'tip burn', 'insect damage', 'splitting'],
  kale: ['aphid damage', 'leaf spot', 'yellowing', 'wilting'],
  spinach: ['leaf miner trails', 'downy mildew', 'yellowing', 'bolting damage'],
  avocado: ['anthracnose', 'stem-end rot', 'lenticel damage', 'chilling injury'],
  banana: ['crown rot', 'finger drop', 'bruising', 'cigar-end rot'],
  bananas: ['crown rot', 'finger drop', 'bruising', 'cigar-end rot'],
  orange: ['citrus canker', 'wind scarring', 'oil spotting', 'stem-end rot'],
  oranges: ['citrus canker', 'wind scarring', 'oil spotting', 'stem-end rot'],
  pepper: ['blossom end rot', 'sunscald', 'cracking', 'anthracnose'],
  peppers: ['blossom end rot', 'sunscald', 'cracking', 'anthracnose'],
  carrot: ['forking', 'cracking', 'green shoulder', 'cavity spot'],
  carrots: ['forking', 'cracking', 'green shoulder', 'cavity spot'],
  maize: ['ear rot', 'kernel damage', 'insect boring', 'husk discoloration'],
};

const DEFAULT_DEFECTS = ['minor surface blemishes', 'slight discoloration', 'small bruise', 'cosmetic imperfection'];

// Weighted grade distribution: ~25% Premium, ~60% Grade A, ~12% Grade B, ~3% Reject
const GRADE_THRESHOLDS: { grade: GradeLabel; cumulative: number }[] = [
  { grade: 'Premium', cumulative: 0.25 },
  { grade: 'Grade A', cumulative: 0.85 },
  { grade: 'Grade B', cumulative: 0.97 },
  { grade: 'Reject', cumulative: 1.0 },
];

function pickGrade(): GradeLabel {
  const roll = Math.random();
  for (const { grade, cumulative } of GRADE_THRESHOLDS) {
    if (roll < cumulative) return grade;
  }
  return 'Grade A';
}

// Confidence varies by grade — extremes (Premium/Reject) get higher confidence
function pickConfidence(grade: GradeLabel): number {
  switch (grade) {
    case 'Premium': return 0.88 + Math.random() * 0.10;  // 0.88–0.98
    case 'Grade A':  return 0.75 + Math.random() * 0.15;  // 0.75–0.90
    case 'Grade B':  return 0.70 + Math.random() * 0.15;  // 0.70–0.85
    case 'Reject':   return 0.85 + Math.random() * 0.12;  // 0.85–0.97
  }
}

function pickDefects(cropType: string, grade: GradeLabel): string[] {
  if (grade === 'Premium') return [];

  const pool = CROP_DEFECTS[cropType.toLowerCase()] || DEFAULT_DEFECTS;
  const count = grade === 'Grade A' ? 1 : grade === 'Grade B' ? 2 : 3;

  // Shuffle and take `count` items
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Simulate ML inference on a produce image.
 *
 * // SWAP: replace with real model — create tfliteGradingModel.ts with the same
 * // GradingPrediction interface, then conditionally import based on USE_REAL_ML env.
 */
export async function gradeProduce(
  _imageBuffer: Buffer,
  cropType: string,
): Promise<GradingPrediction> {
  // Simulate ~200ms inference latency
  await new Promise((resolve) => setTimeout(resolve, 180 + Math.random() * 40));

  const grade = pickGrade();
  const confidence = Math.round(pickConfidence(grade) * 100) / 100;
  const defects = pickDefects(cropType, grade);

  return { grade, confidence, defects };
}
