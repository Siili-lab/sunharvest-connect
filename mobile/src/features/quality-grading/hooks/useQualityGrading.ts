/**
 * Quality Grading Hook
 *
 * Manages the quality grading flow:
 * 1. On-device inference with TensorFlow Lite
 * 2. Fallback to server-side inference if needed
 * 3. Caching and offline support
 */

import { useState, useCallback } from 'react';
import { runOnDeviceInference } from '../services/tfLiteService';
import { gradeProduceAPI } from '../services/api';
import { QualityGrade } from '../types';

interface UseQualityGradingResult {
  grade: QualityGrade | null;
  confidence: number;
  isGrading: boolean;
  error: string | null;
  gradeImage: (imageUri: string) => Promise<void>;
  reset: () => void;
}

export const useQualityGrading = (): UseQualityGradingResult => {
  const [grade, setGrade] = useState<QualityGrade | null>(null);
  const [confidence, setConfidence] = useState<number>(0);
  const [isGrading, setIsGrading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const gradeImage = useCallback(async (imageUri: string) => {
    setIsGrading(true);
    setError(null);

    try {
      // Try on-device inference first (works offline)
      const result = await runOnDeviceInference(imageUri);
      setGrade(result.grade);
      setConfidence(result.confidence);
    } catch (onDeviceError) {
      // Fallback to server-side inference
      try {
        const result = await gradeProduceAPI(imageUri);
        setGrade(result.grade);
        setConfidence(result.confidence);
      } catch (apiError) {
        setError('Unable to grade produce. Please try again.');
      }
    } finally {
      setIsGrading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setGrade(null);
    setConfidence(0);
    setError(null);
  }, []);

  return { grade, confidence, isGrading, error, gradeImage, reset };
};
