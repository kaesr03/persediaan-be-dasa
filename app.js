import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import dashboardRoutes from './routes/dashboardRoutes.js';
import productRoutes from './routes/productRoutes.js';
import userRoutes from './routes/userRoutes.js';
import categoyRoutes from './routes/categoryRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import salesRoutes from './routes/saleRoutes.js';
import brandRoutes from './routes/brandRoutes.js';

import AppError from './utils/AppError.js';
import globalErrorController from './controllers/errorController.js';

import sanitizeV5 from './utils/mongoSanitizeV5.js';

const app = express();

const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

app.use(helmet());

const limiter = rateLimit({
  max: 1000,
  windowMs: 60 * 60 * 1000,
  handler: (req, res) => {
    res.status(429).json({
      status: 'fail',
      message: 'Too many requests from this IP, please try again in an hour!',
    });
  },
});
app.use(limiter);

app.set('query parser', 'extended');
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

app.use(sanitizeV5());

app.use(hpp());

app.use(compression());

app.use('/dashboard', dashboardRoutes);
app.use('/suppliers', supplierRoutes);
app.use('/categories', categoyRoutes);
app.use('/products', productRoutes);
app.use('/expenses', expenseRoutes);
app.use('/sales', salesRoutes);
app.use('/brands', brandRoutes);
app.use('/users', userRoutes);

app.all(/(.*)/, (req, res, next) => {
  next(new AppError(`Tidak dapan menemukan ${req.originalUrl}`, 404));
});

app.use(globalErrorController);

export default app;
