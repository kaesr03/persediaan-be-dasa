import express from 'express';

import {
  getBrands,
  createBrand,
  deleteBrand,
  updateBrand,
  getBrandOptions,
} from '../controllers/brandController.js';

import { protect } from '../controllers/authController.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getBrands).post(createBrand);
router.route('/options').get(getBrandOptions);

router.route('/:id').delete(deleteBrand).patch(updateBrand);

export default router;
