import User from '../models/userModel.js';

import AppError from '../utils/AppError.js';

import { cloudinary } from '../cloudinary/index.js';

export const getMe = async (req, res, next) => {
  const user = await User.findOne({ _id: req.user._id });

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
};

export const updateMe = async (req, res, next) => {
  if (req.body.password || req.body.passwordConfirm) {
    throw new AppError(
      'This route is not for password updates. Please use /updateMyPassword',
      400
    );
  }

  const user = await User.findOne({ _id: req.user._id });

  if (!user) {
    throw new AppError('Tidak ada profil dengan Id tersebut', 404);
  }
  if (!user._id.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak mengupdate profil ini', 403);
  }

  user.set(req.body);

  if (req.file) {
    if (user.photo && user.photo?.filename) {
      await cloudinary.uploader.destroy(user.photo.filename);
    }
    user.photo = { url: req.file.path, filename: req.file.filename };
  }

  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    data: {
      user,
    },
  });
};

export const deleteMe = async (req, res, next) => {
  await User.findByIdAndUpdate(req.user._id, { active: false });

  res.status(204).json({
    status: 'success',
    data: null,
  });
};
