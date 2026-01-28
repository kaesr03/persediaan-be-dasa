import Sale from '../models/saleModel.js';
import Product from '../models/productModel.js';

import AppError from '../utils/AppError.js';
import ApiFeatures from '../utils/ApiFeatures.js';

export const getAllSales = async (req, res) => {
  const features = new ApiFeatures(Sale.find({ user: req.user._id }), req.query)
    .filter()
    .sort()
    .limitField();

  const totalDocuments = await Sale.countDocuments(features.query.getFilter());

  features.paginate();

  const sales = await features.query;

  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalDocuments / limit);

  res.status(200).json({
    status: 'success',
    results: sales.length,
    totalDocuments,
    totalPages,
    data: {
      sales,
    },
  });
};

export const getSale = async (req, res) => {
  const sale = await Sale.findById(req.params.id);

  if (!sale) {
    throw new AppError('Tidak ada penjualan dengan Id tersebut', 404);
  }

  res.status(200).json({
    status: 'success',
    data: {
      sale: sale,
    },
  });
};

export const createSale = async (req, res, next) => {
  const { products } = req.body;

  if (!products || !Array.isArray(products)) {
    throw new AppError('Products harus berupa array', 400);
  }

  const productIds = products.map((item) => item.productId);

  const productDocs = await Product.find({ _id: { $in: productIds } });

  const stockError = products.find((item) => {
    const product = productDocs.find(
      (p) => p._id.toString() === item.productId
    );

    if (!product) {
      return new AppError(`Produk ${product.name} tidak ditemukan`, 404);
    }

    if (product.quantity < item.quantity) {
      return new AppError(`Stok ${product.name} tidak cukup`, 400);
    }

    return null;
  });

  if (stockError instanceof AppError) {
    throw stockError;
  }

  const sale = new Sale(req.body);
  sale.user = req.user._id;
  const savedSale = await sale.save();

  await Promise.all(
    products.map((item) =>
      Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: -item.quantity } },
        { new: true }
      )
    )
  );

  res.status(201).json({
    status: 'success',
    message: 'Penjualan berhasil dicatat',
    submitId: Date.now(),
    data: {
      sale: savedSale,
    },
  });
};

export const updateSaleStatus = async (req, res) => {
  const { status, paidAt } = req.body;
  const sale = await Sale.findById(req.params.id);

  if (!sale) {
    throw new AppError('Tidak ada penjualan dengan Id tersebut', 404);
  }

  if (!sale.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak mengedit status penjualan ini', 404);
  }

  sale.status = status;
  sale.paidAt = paidAt;
  sale.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Status penjualan berhasil diubah',
    data: {
      sale,
    },
  });
};
