import mongoose from 'mongoose';

import Product from './productModel.js';

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    uppercase: true,
    trim: true,
    maxlength: 100,
    required: [true, 'Tolong berikan nama kategori'],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'kategori harus memiliki user'],
  },
});

categorySchema.index({ user: 1, name: 1 }, { unique: true });

categorySchema.post(
  'deleteOne',
  { document: true, query: false },
  async function () {
    await Product.updateMany(
      { category: this._id },
      { $unset: { category: '' } }
    );
  }
);

export default mongoose.model('Category', categorySchema);
