import express from 'express';

import {
  getAllSuppliers,
  createSupplier,
  deleteSupplier,
  updateSupplier,
} from '../controllers/supplierController.js';

import { protect } from '../controllers/authController.js';

const router = express.Router();

router.use(protect);

router.route('/').get(getAllSuppliers).post(createSupplier);

router.route('/:id').delete(deleteSupplier).patch(updateSupplier);

export default router;
