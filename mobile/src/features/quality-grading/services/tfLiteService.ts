/**
 * TensorFlow Lite Service Stub
 *
 * On-device inference for quality grading.
 * TODO: Integrate actual TFLite model when ready.
 */

import { QualityGrade } from '../types';

interface InferenceResult {
  grade: QualityGrade;
  confidence: number;
}

export async function runOnDeviceInference(_imageUri: string): Promise<InferenceResult> {
  // TODO: Replace with actual TFLite model inference
  throw new Error('On-device inference not yet available');
}
