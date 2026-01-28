import express from 'express';

import {
  getAllSales,
  createSale,
  getSale,
  updateSaleStatus,
} from '../controllers/saleController.js';

import { protect } from '../controllers/authController.js';

const router = express.Router();

router.use(protect);

router.route('/').post(createSale).get(getAllSales);

router.route('/:id').get(getSale).patch(updateSaleStatus);

export default router;
