import axios from 'axios';
import { GradingPrediction } from './mockGradingModel';

const ML_SERVER_URL = process.env.ML_SERVER_URL; // e.g. http://localhost:5000

export async function gradeProduceML(
  imageBuffer: Buffer,
  cropType: string,
): Promise<GradingPrediction & { modelVersion?: string }> {
  if (!ML_SERVER_URL) {
    throw new Error('ML_SERVER_URL not configured');
  }

  // Send as base64 JSON — simpler than multipart when calling between services
  const resp = await axios.post(`${ML_SERVER_URL}/predict`, {
    image: imageBuffer.toString('base64'),
    cropType,
  }, {
    timeout: 30000,
    headers: { 'Content-Type': 'application/json' },
  });

  const data = resp.data;
  return {
    grade: data.grade,
    confidence: data.confidence,
    defects: data.defects || [],
    modelVersion: data.modelVersion,
  };
}

export function isMLServerConfigured(): boolean {
  return !!ML_SERVER_URL;
}
