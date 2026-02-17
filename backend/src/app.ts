import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter, authLimiter, smsLimiter, sanitizeBody, securityHeaders } from './middleware/security';
import { authRouter } from './routes/auth.routes';
import { produceRouter } from './routes/produce.routes';
import { marketRouter } from './routes/market.routes';
import { smsRouter } from './routes/sms.routes';
import listingsRouter from './routes/listings.routes';
import offersRouter from './routes/offers.routes';
import trustScoreRouter from './routes/trustScore.routes';
import { deliveryRouter } from './routes/delivery.routes';
import { userRouter } from './routes/user.routes';
import { gradingRouter } from './routes/grading.routes';
import { mpesaRouter } from './routes/mpesa.routes';
import { saccoRouter } from './routes/sacco.routes';
import { notificationRouter } from './routes/notification.routes';
import { config } from './config';

const app: Application = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security
app.use(helmet());
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(requestLogger);

// Security middleware
app.use(securityHeaders);
app.use(sanitizeBody);
app.use('/api/v1', apiLimiter);

// Serve uploaded files
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (versioned) — auth and SMS get stricter rate limits
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/produce', produceRouter);
app.use('/api/v1/market', marketRouter);
app.use('/api/v1/sms', smsLimiter, smsRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/offers', offersRouter);
app.use('/api/v1/deliveries', deliveryRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/grading', gradingRouter);
app.use('/api/v1/mpesa', mpesaRouter);
app.use('/api/v1/sacco', saccoRouter);
app.use('/api/v1/notifications', notificationRouter);

// Short routes for mobile app compatibility
app.use('/listings', listingsRouter);
app.use('/offers', offersRouter);
app.use('/api/trust-score', trustScoreRouter);

// Error handling
app.use(errorHandler);

export { app };
