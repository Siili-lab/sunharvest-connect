/**
 * Quality Grading API Service
 *
 * Server-side fallback for quality grading when on-device
 * inference is unavailable.
 */

import { Platform } from 'react-native';
import { QualityGrade } from '../types';

const getApiUrl = () => {
  if (__DEV__) {
    if (Platform.OS === 'web') return 'http://localhost:3000/api/v1';
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:3000/api/v1'
      : 'http://localhost:3000/api/v1';
  }
  return 'https://api.sunharvest.com/api/v1';
};

const API_URL = getApiUrl();

interface GradeAPIResult {
  grade: QualityGrade;
  confidence: number;
}

export async function gradeProduceAPI(imageUri: string): Promise<GradeAPIResult> {
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'produce.jpg',
  } as any);

  const response = await fetch(`${API_URL}/produce/grade`, {
    method: 'POST',
    body: formData,
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  if (!response.ok) {
    throw new Error(`Grading API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    grade: data.grade,
    confidence: data.confidence,
  };
}
