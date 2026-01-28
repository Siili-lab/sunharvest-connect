/**
 * Produce Controller
 *
 * Handles HTTP requests for produce-related operations.
 * Delegates business logic to service layer.
 */

import { Request, Response, NextFunction } from 'express';
import { ProduceService } from './produce.service';
import { GradingService } from './grading.service';
import { validateGradeRequest, validateListingRequest } from './produce.validators';
import { ApiResponse } from '../../shared/types';

export class ProduceController {
  constructor(
    private produceService: ProduceService,
    private gradingService: GradingService
  ) {}

  /**
   * Grade produce from uploaded image
   * POST /api/v1/produce/grade
   */
  async gradeImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error } = validateGradeRequest(req.body);
      if (error) {
        res.status(400).json({ success: false, error: error.details });
        return;
      }

      const { imageBase64, cropType } = req.body;
      const userId = req.user!.id;

      const result = await this.gradingService.gradeImage(imageBase64, cropType, userId);

      const response: ApiResponse = {
        success: true,
        data: result,
        meta: { timestamp: new Date().toISOString() },
      };

      res.json(response);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Create new produce listing
   * POST /api/v1/produce/listings
   */
  async createListing(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error } = validateListingRequest(req.body);
      if (error) {
        res.status(400).json({ success: false, error: error.details });
        return;
      }

      const userId = req.user!.id;
      const listing = await this.produceService.createListing(req.body, userId);

      res.status(201).json({
        success: true,
        data: listing,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all listings with filters
   * GET /api/v1/produce/listings
   */
  async getListings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = {
        cropType: req.query.crop as string,
        location: req.query.location as string,
        minPrice: req.query.minPrice ? Number(req.query.minPrice) : undefined,
        maxPrice: req.query.maxPrice ? Number(req.query.maxPrice) : undefined,
        grade: req.query.grade as string,
        page: Number(req.query.page) || 1,
        limit: Number(req.query.limit) || 20,
      };

      const { listings, total } = await this.produceService.getListings(filters);

      res.json({
        success: true,
        data: listings,
        meta: {
          total,
          page: filters.page,
          limit: filters.limit,
          pages: Math.ceil(total / filters.limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
