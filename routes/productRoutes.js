import express from 'express';
import multer from 'multer';

import {
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  addStock,
  getLowStockProducts,
  getProductOptions,
} from '../controllers/productController.js';
import { protect } from '../controllers/authController.js';

import { storage } from '../cloudinary/index.js';
import AppError from '../utils/AppError.js';

const multerFilter = (req, file, cb) => {
  if (
    file.mimetype === 'image/jpeg' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'image/jpg'
  ) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Hanya gambar format JPG, JPEG, dan PNG yang diperbolehkan',
        400
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: multerFilter,
});
const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(getAllProducts)
  .post(upload.single('image'), createProduct);

router.route('/low-stock').get(getLowStockProducts);
router.route('/options').get(getProductOptions);

router.route('/:id/add').patch(addStock);

router
  .route('/:id')
  .patch(upload.single('image'), updateProduct)
  .delete(deleteProduct);

export default router;
