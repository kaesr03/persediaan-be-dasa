import Expense from '../models/expenseModel.js';
import Product from '../models/productModel.js';

import ApiFeatures from '../utils/ApiFeatures.js';
import AppError from '../utils/AppError.js';

export const getAllExpenses = async (req, res) => {
  const features = new ApiFeatures(
    Expense.find({ user: req.user._id }),
    req.query
  )
    .filter()
    .sort()
    .limitField();

  const totalDocuments = await Expense.countDocuments(
    features.query.getFilter()
  );

  features.paginate();

  const expenses = await features.query;

  const limit = req.query.limit * 1 || 10;
  const totalPages = Math.ceil(totalDocuments / limit);

  res.status(200).json({
    status: 'success',
    results: expenses.length,
    totalDocuments,
    totalPages,
    data: {
      expenses: expenses,
    },
  });
};

export const getExpense = async (req, res, next) => {
  const expense = await Expense.findById(req.params.id);
  if (!expense) {
    return next(new AppError('Tidak ada expense dengan Id tersebut', 404));
  }

  if (!expense.user.equals(req.user._id)) {
    throw new AppError('Anda tidak berhak melihat expense ini', 403);
  }

  res.status(200).json({
    status: 'success',
    data: {
      expense: expense,
    },
  });
};

export const createExpense = async (req, res) => {
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

  const expense = new Expense(req.body);
  expense.user = req.user._id;
  await expense.save();

  await Promise.all(
    products.map((item) =>
      Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: +item.quantity } },
        { new: true }
      )
    )
  );

  res.status(201).json({
    status: 'success',
    results: expense.length,
    submitId: Date.now(),
    message: 'penjualan berhasil dibuat',
    data: {
      expense,
    },
  });
};
