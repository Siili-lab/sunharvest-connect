/**
 * Grading Service
 *
 * Handles AI-powered quality grading of produce.
 * Integrates with ML model serving infrastructure.
 */

import { MLClient } from '../../infrastructure/ml/client';
import { PricingService } from '../market/pricing.service';
import { GradingRepository } from './grading.repository';
import { GradingResult, QualityGrade } from './produce.types';

export class GradingService {
  constructor(
    private mlClient: MLClient,
    private pricingService: PricingService,
    private gradingRepository: GradingRepository
  ) {}

  /**
   * Grade produce image using CV model
   */
  async gradeImage(
    imageBase64: string,
    cropType: string,
    userId: string
  ): Promise<GradingResult> {
    // Call ML model for inference
    const prediction = await this.mlClient.predict({
      model: 'quality-grading',
      input: {
        image: imageBase64,
        cropType,
      },
    });

    const grade = this.mapPredictionToGrade(prediction.class, prediction.confidence);

    // Get suggested price based on grade and current market
    const suggestedPrice = await this.pricingService.getSuggestedPrice(
      cropType,
      grade,
      'KES'
    );

    const result: GradingResult = {
      grade: grade,
      confidence: prediction.confidence,
      suggestedPrice,
      defects: prediction.defects || [],
      modelVersion: prediction.modelVersion,
      timestamp: new Date(),
    };

    // Store grading result for audit trail
    await this.gradingRepository.save({
      userId,
      cropType,
      result,
      imageHash: this.hashImage(imageBase64),
    });

    return result;
  }

  /**
   * Request human review for disputed grade
   */
  async requestHumanReview(
    gradingId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.gradingRepository.flagForReview(gradingId, userId, reason);
    // Notify admin for manual review (human-in-the-loop)
  }

  private mapPredictionToGrade(
    predictedClass: number,
    confidence: number
  ): QualityGrade {
    // Require higher confidence for premium grade
    if (predictedClass === 0 && confidence > 0.85) return 'PREMIUM';
    if (predictedClass === 0 && confidence <= 0.85) return 'GRADE_A';
    if (predictedClass === 1) return 'GRADE_A';
    if (predictedClass === 2) return 'GRADE_B';
    return 'REJECT';
  }

  private hashImage(base64: string): string {
    // Simple hash for deduplication
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(base64).digest('hex').slice(0, 16);
  }
}
