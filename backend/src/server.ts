import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config/env';
import authRouter from './routes/auth';
import listingsRouter from './routes/listings';
import farmLocationsRouter from './routes/farmLocations';
import negotiationsRouter from './routes/negotiations';
import purchaseOrdersRouter from './routes/purchaseOrders';

const app = express();

// Middleware
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/listings', listingsRouter);
app.use('/api/v1/farm-locations', farmLocationsRouter);
app.use('/api/v1/negotiations', negotiationsRouter);
app.use('/api/v1/purchase-orders', purchaseOrdersRouter);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
  });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
});

app.listen(config.port, () => {
  console.log(`Hay Portal API running on http://localhost:${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
});

export default app;
