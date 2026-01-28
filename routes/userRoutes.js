import express from 'express';
import multer from 'multer';

import {
  login,
  signup,
  forgotPassword,
  resetPassword,
  protect,
  updatePassword,
  logout,
} from '../controllers/authController.js';

import { updateMe, deleteMe, getMe } from '../controllers/userController.js';

import { storage } from '../cloudinary/index.js';
import AppError from '../utils/AppError.js';

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image')) {
    cb(null, true);
  } else {
    cb(
      new AppError('Tolong hanya upload gambar pada kolom gambar!', 400),
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

router.route('/signup').post(signup);
router.route('/login').post(login);
router.route('/logout').post(logout);

router.route('/updateMyPassword').patch(protect, updatePassword);

router.route('/getMe').get(protect, getMe);
router.route('/updateMe').patch(protect, upload.single('photo'), updateMe);
router.route('/deleteMe').delete(protect, deleteMe);

router.route('/forgotPassword').post(forgotPassword);
router.route('/resetPassword/:token').post(resetPassword);

export default router;
