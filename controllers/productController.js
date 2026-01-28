import Product from '../models/productModel.js';
import Expense from '../models/expenseModel.js';

import ApiFeatures from '../utils/ApiFeatures.js';
import AppError from '../utils/AppError.js';

import { cloudinary } from '../cloudinary/index.js';

const filterObj = (obj, ...allowedFields) => {
  const newObj = {};
  Object.keys(obj).forEach((key) => {
    if (allowedFields.includes(key)) newObj[key] = obj[key];
  });
  return newObj;
};

export const getAllProducts = async (req, res) => {
  const features = new ApiFeatures(
    Product.find({ user: req.user._id })
      .populate('supplier')
      .populate('category')
      .populate('brand'),
    req.query
  ).filter();

  const totalDocuments = await Product.countDocuments(
    features.query.getFilter()
  );

  features.paginate();

  const products = await features.query;

  const limit = req.query.limit * 1;
  const totalPages = Math.ceil(totalDocuments / limit);

  res.status(200).json({
    status: 'success',
    results: products.length,
    totalDocuments,
    totalPages,
    data: {
      products: products,
    },
  });
};

export const getProductOptions = async (req, res, next) => {
  const products = await Product.find({ user: req.user._id })
    .select('_id name sellingPrice purchasePrice quantity')
    .sort({ name: 1 });

  res.status(200).json({
    status: 'success',
    results: products.length,
    data: {
      products: products,
    },
  });
};

export const getLowStockProducts = async (req, res) => {
  const lowStock = await Product.aggregate([
    {
      $match: {
        user: req.user._id,
        quantity: { $lt: 6 },
      },
    },
    {
      $project: {
        name: 1,
        quantity: 1,
      },
    },
  ]);

  res.status(200).json({
    status: 'success',
    results: lowStock.length,
    data: {
      lowStock,
    },
  });
};

export const createProduct = async (req, res) => {
  const { name, quantity, purchasePrice, date } = req.body;
  const product = new Product(req.body);
  product.user = req.user._id;
  if (req.file) {
    product.image = { url: req.file.path, filename: req.file.filename };
  }

  await product.save();

  const expenseAmount = quantity * purchasePrice;
  await Expense.create({
    user: req.user._id,
    products: [
      {
        productId: product._id,
        name: product.name,
        quantity,
        purchasePrice,
      },
    ],
    amount: expenseAmount,
    category: product.category,
    date,
    description: `membeli ${name} sebanyak ${quantity}`,
  });

  res.status(201).json({
    status: 'success',
    results: product.length,
    message: 'produk berhasil dibuat',
    data: {
      product: product,
    },
  });
};

export const addStock = async (req, res) => {
  const { quantity, date } = req.body;

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Tidak ada produk dengan Id tersebut', 404);
  }
  if (!product.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak menambah stock produk ini', 403);
  }

  product.quantity += quantity * 1;
  const expenseAmount = quantity * product.purchasePrice;
  await product.save({ validateBeforeSave: false });

  const expense = await Expense.create({
    user: req.user._id,
    products: [
      {
        productId: product._id,
        name: product.name,
        quantity,
        purchasePrice: product.purchasePrice,
      },
    ],
    amount: expenseAmount,
    category: product.category,
    date,
    description: `membeli ${product.name} sebanyak ${quantity}`,
  });

  res.status(200).json({
    status: 'success',
    results: product.length,
    message: 'stock produk berhasil ditambahkan',
    data: {
      expense,
    },
  });
};

export const updateProduct = async (req, res) => {
  if (req?.body?.quantity) {
    throw new AppError('Route ini hanya untuk update informasi produk', 400);
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Tidak ada produk dengan Id tersebut', 404);
  }
  if (!product.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak mengupdate produk ini', 403);
  }

  const allowed = filterObj(
    req.body,
    'name',
    'sku',
    'purchasePrice',
    'sellingPrice',
    'category',
    'supplier',
    'brand'
  );

  product.set(allowed);
  if (req.file) {
    if (product.image && product.image.filename) {
      await cloudinary.uploader.destroy(product.image.filename);
    }
    product.image = { url: req.file.path, filename: req.file.filename };
  }

  await product.save();

  res.status(200).json({
    status: 'success',
    message: 'produk berhasil diperbarui',
    data: {
      product,
    },
  });
};

export const deleteProduct = async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    throw new AppError('Tidak ada produk dengan Id tersebut', 404);
  }
  if (!product.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak menghapus produk ini', 403);
  }

  if (product.image?.filename) {
    await cloudinary.uploader.destroy(product.image.filename);
  }

  await product.deleteOne();

  res.status(200).json({
    status: 'success',
    message: 'produk berhasil dihapus',
    data: null,
  });
};
