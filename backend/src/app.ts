import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { authRouter } from './routes/auth.routes';
import { produceRouter } from './routes/produce.routes';
import { marketRouter } from './routes/market.routes';
import { smsRouter } from './routes/sms.routes';
import listingsRouter from './routes/listings.routes';
import offersRouter from './routes/offers.routes';
import trustScoreRouter from './routes/trustScore.routes';
import { config } from './config';

const app: Application = express();

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes (versioned)
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/produce', produceRouter);
app.use('/api/v1/market', marketRouter);
app.use('/api/v1/sms', smsRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/offers', offersRouter);

// Short routes for mobile app compatibility
app.use('/listings', listingsRouter);
app.use('/offers', offersRouter);
app.use('/api/trust-score', trustScoreRouter);

// Error handling
app.use(errorHandler);

export { app };
