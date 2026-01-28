import mongoose from 'mongoose';

const salesSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
  },
  total: {
    type: Number,
    required: [true, 'Tolong input total penjualan'],
  },
  buyerName: {
    type: String,
    required: [true, 'Berikan nama pembeli'],
  },

  status: {
    type: String,
    enum: ['PAID', 'UNPAID'],
    default: 'UNPAID',
  },

  paidAt: {
    type: Date,
  },
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
      sellingPrice: {
        type: Number,
        required: true,
      },
    },
  ],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

export default mongoose.model('Sale', salesSchema);
