import Category from '../models/categoryModel.js';

import ApiFeatures from '../utils/ApiFeatures.js';
import AppError from '../utils/AppError.js';

export const getAllCategory = async (req, res) => {
  const features = new ApiFeatures(
    Category.find({ user: req.user._id }),
    req.query
  ).filter();

  const totalDocuments = await Category.countDocuments(
    features.query.getFilter()
  );

  features.paginate();

  const categories = await features.query;

  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalDocuments / limit);

  res.status(200).json({
    status: 'success',
    results: categories.length,
    totalDocuments,
    totalPages,
    data: {
      categories: categories,
    },
  });
};

export const getCategoryOptions = async (req, res, next) => {
  const categories = await Category.find({ user: req.user._id })
    .select('_id name')
    .sort({ name: 1 });

  res.status(200).json({
    status: 'success',
    results: categories.length,
    data: categories,
  });
};

export const createCategory = async (req, res) => {
  const category = new Category(req.body);
  category.user = req.user._id;
  await category.save();

  res.status(201).json({
    status: 'success',
    results: category.length,
    message: 'kategori berhasil dibuat',
    data: {
      category,
    },
  });
};

export const deleteCategory = async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new AppError('Tidak ada kategori dengan Id tersebut', 404));
  }
  if (!category.user.equals(req.user._id)) {
    return next(new AppError('Anda tidak berhak menghapus kategori ini', 403));
  }

  await category.deleteOne();

  res.status(200).json({
    status: 'success',
    message: 'kategori berhasil dihapus',
    data: null,
  });
};

export const updateCategory = async (req, res) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    throw new AppError('Tidak ada kategori dengan Id tersebut', 404);
  }
  if (!category.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak mengupdate kategori ini', 403);
  }

  category.set(req.body);

  await category.save();

  res.status(200).json({
    status: 'success',
    message: 'kategori berhasil diperbarui',
    data: {
      category,
    },
  });
};
