import mongoose from 'mongoose';

import Product from './productModel.js';

const supplierSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Supplier must have a name'],
  },
  contact: {
    type: String,
    required: [true, 'Supplier must have a contact'],
  },
  address: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'product harus memiliki user'],
  },
});

supplierSchema.index({ user: 1, name: 1 }, { unique: true });
supplierSchema.index({ user: 1, contact: 1 }, { unique: true });

supplierSchema.post(
  'deleteOne',
  { document: true, query: false },
  async function () {
    await Product.updateMany(
      { supplier: this._id },
      { $unset: { supplier: '' } }
    );
  }
);

export default mongoose.model('Supplier', supplierSchema);
