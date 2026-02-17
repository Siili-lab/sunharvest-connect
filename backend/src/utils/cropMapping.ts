import { CropType, QualityGrade } from '@prisma/client';

// Map user-friendly crop names to Prisma enum values
export function mapCropToEnum(crop: string): CropType {
  const mapping: Record<string, CropType> = {
    'tomato': 'TOMATOES',
    'tomatoes': 'TOMATOES',
    'mango': 'MANGOES',
    'mangoes': 'MANGOES',
    'onion': 'ONIONS',
    'onions': 'ONIONS',
    'potato': 'POTATOES',
    'potatoes': 'POTATOES',
    'cabbage': 'CABBAGE',
    'kale': 'KALE',
    'sukuma': 'KALE',
    'spinach': 'SPINACH',
    'avocado': 'AVOCADO',
    'banana': 'BANANAS',
    'bananas': 'BANANAS',
    'orange': 'ORANGES',
    'oranges': 'ORANGES',
    'pepper': 'PEPPERS',
    'peppers': 'PEPPERS',
    'carrot': 'CARROTS',
    'carrots': 'CARROTS',
    'maize': 'OTHER',
  };
  return mapping[crop.toLowerCase()] || 'OTHER';
}

// Map display grade strings to Prisma enum values
export function mapGradeToEnum(grade: string): QualityGrade {
  const mapping: Record<string, QualityGrade> = {
    'Premium': 'PREMIUM',
    'Grade A': 'GRADE_A',
    'Grade B': 'GRADE_B',
    'Reject': 'REJECT',
  };
  return mapping[grade] || 'GRADE_A';
}

// Reverse mapping: enum value to display string for API responses
export function gradeEnumToDisplay(grade: QualityGrade): string {
  const mapping: Record<QualityGrade, string> = {
    PREMIUM: 'Premium',
    GRADE_A: 'Grade A',
    GRADE_B: 'Grade B',
    REJECT: 'Reject',
  };
  return mapping[grade] || 'Grade A';
}
