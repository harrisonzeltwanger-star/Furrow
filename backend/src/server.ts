import * as Sentry from '@sentry/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';

// Initialize Sentry before anything else
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.2 : 1.0,
  });
}
import authRouter from './routes/auth';
import listingsRouter from './routes/listings';
import farmLocationsRouter from './routes/farmLocations';
import negotiationsRouter from './routes/negotiations';
import purchaseOrdersRouter from './routes/purchaseOrders';
import usersRouter from './routes/users';
import invoicesRouter from './routes/invoices';

const app = express();

// Trust proxy (Railway, Vercel, etc. sit behind a reverse proxy)
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// CORS — allow known web origins + mobile app (no origin header)
const allowedOrigins = [
  config.nodeEnv === 'development' && 'http://localhost:5173',
  config.nodeEnv === 'development' && 'http://127.0.0.1:5173',
  'https://furrowag.com',
  'https://www.furrowag.com',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Body parsing with size limit
app.use(express.json({ limit: '1mb' }));

// Rate limiting — general API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
});

// Rate limiting — strict for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many auth attempts, please try again later' } },
});

app.use('/api/', apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authLimiter, authRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/farm-locations', farmLocationsRouter);
app.use('/api/v1/negotiations', negotiationsRouter);
app.use('/api/v1/purchase-orders', purchaseOrdersRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/invoices', invoicesRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// Sentry error handler (must be before custom error handler)
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
});

// Only start listening when run directly (not imported by tests)
if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Hay Portal API running on http://localhost:${config.port}`);
    console.log(`Environment: ${config.nodeEnv}`);
  });
}

export default app;
