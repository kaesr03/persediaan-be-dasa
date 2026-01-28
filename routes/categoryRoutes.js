import express from 'express';

import {
  createCategory,
  deleteCategory,
  getAllCategory,
  updateCategory,
  getCategoryOptions,
} from '../controllers/categoryController.js';

import { protect } from '../controllers/authController.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getAllCategory).post(createCategory);

router.route('/options').get(getCategoryOptions);

router.route('/:id').delete(deleteCategory).patch(updateCategory);

export default router;
