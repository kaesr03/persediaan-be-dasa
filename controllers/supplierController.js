import Supplier from '../models/supplierModel.js';

import ApiFeatures from '../utils/ApiFeatures.js';
import AppError from '../utils/AppError.js';

export const getAllSuppliers = async (req, res) => {
  const features = new ApiFeatures(
    Supplier.find({ user: req.user._id }),
    req.query
  ).filter();

  const totalDocuments = await Supplier.countDocuments(
    features.query.getFilter()
  );

  features.paginate();

  const suppliers = await features.query;

  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalDocuments / limit);

  res.status(200).json({
    status: 'success',
    results: suppliers.length,
    totalDocuments,
    totalPages,
    data: {
      suppliers: suppliers,
    },
  });
};

export const createSupplier = async (req, res) => {
  const supplier = new Supplier(req.body);
  supplier.user = req.user._id;
  await supplier.save();

  res.status(201).json({
    status: 'success',
    results: supplier.length,
    message: 'supplier berhasil dibuat',
    data: {
      supplier: supplier,
    },
  });
};

export const deleteSupplier = async (req, res, next) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    return next(new AppError('Tidak ada supplier dengan Id tersebut', 404));
  }
  if (!supplier.user.equals(req.user._id)) {
    return next(new AppError('Anda tidak berhak menghapus produk ini', 403));
  }

  await supplier.deleteOne();

  res.status(200).json({
    status: 'success',
    message: 'supplier berhasil dihapus',
    data: null,
  });
};

export const updateSupplier = async (req, res) => {
  const supplier = await Supplier.findById(req.params.id);

  if (!supplier) {
    throw new AppError('Tidak ada produk dengan Id tersebut', 404);
  }
  if (!supplier.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak mengupdate produk ini', 403);
  }

  supplier.set(req.body);

  await supplier.save();

  res.status(200).json({
    status: 'success',
    message: 'supplier berhasil diperbarui',
    data: {
      supplier,
    },
  });
};
