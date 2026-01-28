import mongoose from 'mongoose';

import Product from './productModel.js';

const brandSchema = new mongoose.Schema({
  name: {
    type: String,
    uppercase: true,
    trim: true,
    required: [true, 'Tolong berikan nama kategori'],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'brand harus memiliki user'],
  },
});

brandSchema.index({ user: 1, name: 1 }, { unique: true });

brandSchema.post(
  'deleteOne',
  { document: true, query: false },
  async function () {
    await Product.updateMany({ brand: this._id }, { $unset: { brand: '' } });
  }
);

export default mongoose.model('Brand', brandSchema);
