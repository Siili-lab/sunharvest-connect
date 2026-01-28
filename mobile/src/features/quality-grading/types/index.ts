/**
 * Quality Grading Types
 */

export type QualityGrade = 'PREMIUM' | 'GRADE_A' | 'GRADE_B' | 'REJECT';

export interface GradingResult {
  grade: QualityGrade;
  confidence: number;
  suggestedPrice: PriceRange;
  defects: Defect[];
  timestamp: Date;
}

export interface PriceRange {
  min: number;
  max: number;
  currency: 'KES';
  unit: 'kg' | 'piece' | 'bunch';
}

export interface Defect {
  type: DefectType;
  severity: 'low' | 'medium' | 'high';
  location: string;
}

export type DefectType =
  | 'bruise'
  | 'rot'
  | 'discoloration'
  | 'pest_damage'
  | 'size_irregular'
  | 'ripeness_uneven';

export interface GradingHistoryItem {
  id: string;
  imageUri: string;
  result: GradingResult;
  cropType: string;
  createdAt: Date;
  synced: boolean;
}
