import express from 'express';

import {
  createExpense,
  getAllExpenses,
  getExpense,
} from '../controllers/expenseController.js';

import { protect } from '../controllers/authController.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getAllExpenses).post(createExpense);

router.route('/:id').get(getExpense);

export default router;
