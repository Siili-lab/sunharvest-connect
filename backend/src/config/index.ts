import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

// Fail fast in production if JWT_SECRET is missing
if (!process.env.JWT_SECRET && nodeEnv === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production');
}

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv,
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:8081'],
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL,

  // ML Grading Server
  mlServerUrl: process.env.ML_SERVER_URL || '',

  // M-Pesa (Safaricom Daraja API)
  mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || '',
  mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  mpesaShortcode: process.env.MPESA_SHORTCODE || '',
  mpesaPasskey: process.env.MPESA_PASSKEY || '',
  mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || 'https://yourdomain.com/api/v1/mpesa/callback',
  mpesaEnvironment: (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
};
