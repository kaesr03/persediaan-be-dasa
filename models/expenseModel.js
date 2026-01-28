import mongoose from 'mongoose';

const expenseSchema = mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  amount: {
    type: Number,
    required: [true, 'Tolong berikan total pengeluaran'],
  },
  description: String,
  products: [
    {
      productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
      name: {
        type: String,
        required: [true, 'Berikan nama produk'],
      },
      quantity: {
        type: Number,
        required: true,
        min: 1,
      },
      purchasePrice: {
        type: Number,
        required: true,
      },
    },
  ],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'expense harus memiliki user'],
  },
});

export default mongoose.model('Expense', expenseSchema);
