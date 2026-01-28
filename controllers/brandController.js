import Brand from '../models/brandModel.js';

import ApiFeatures from '../utils/ApiFeatures.js';
import AppError from '../utils/AppError.js';

export const getBrands = async (req, res) => {
  const features = new ApiFeatures(
    Brand.find({ user: req.user._id }),
    req.query
  ).filter();

  const totalDocuments = await Brand.countDocuments(features.query.getFilter());

  features.paginate();

  const brands = await features.query;

  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalDocuments / limit);

  res.status(200).json({
    status: 'success',
    results: brands.length,
    totalDocuments,
    totalPages,
    data: {
      brands,
    },
  });
};

export const getBrandOptions = async (req, res, next) => {
  const brands = await Brand.find({ user: req.user._id })
    .select('_id name')
    .sort({ name: 1 });

  res.status(200).json({
    status: 'success',
    results: brands.length,
    data: brands,
  });
};

export const createBrand = async (req, res) => {
  const newBrand = new Brand(req.body);
  newBrand.user = req.user._id;
  await newBrand.save();

  res.status(201).json({
    status: 'success',
    message: 'brand berhasil dibuat',
    data: {
      newBrand,
    },
  });
};

export const deleteBrand = async (req, res) => {
  const brand = await Brand.findById(req.params.id);

  if (!brand) throw new AppError('tidak ada brand dengan id tersebut', 404);

  if (!brand.user.equals(req.user._id))
    throw new AppError('anda tidak berhak menghapus brand tersebut', 403);

  await brand.deleteOne();

  res.status(200).json({
    status: 'success',
    message: 'brand berhasil dihapus',
    data: null,
  });
};

export const updateBrand = async (req, res) => {
  const brand = await Brand.findById(req.params.id);

  if (!brand) {
    throw new AppError('Tidak ada kategori dengan Id tersebut', 404);
  }
  if (!brand.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak mengupdate kategori ini', 403);
  }

  brand.set(req.body);

  await brand.save();

  res.status(200).json({
    status: 'success',
    message: 'brand berhasil diperbarui',
    data: {
      brand,
    },
  });
};
