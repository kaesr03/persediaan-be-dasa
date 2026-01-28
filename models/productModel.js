import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    trim: true,
    required: [true, 'A product must have sku'],
    maxlength: 100,
  },
  name: {
    type: String,
    trim: true,
    required: [true, 'A product must have a name'],
    maxlength: 100,
  },
  image: {
    url: {
      type: String,
      default: null,
      maxlength: 255,
    },
    filename: {
      type: String,
      default: null,
      maxlength: 255,
    },
  },
  purchasePrice: {
    type: Number,
    required: [true, 'A product must have purchase price'],
  },
  sellingPrice: {
    type: Number,
    required: [true, 'A product must have selling price'],
    validate: {
      validator: function (val) {
        return val > this.purchasePrice;
      },
      message: 'Selling price ({VALUE}) should be above purchase price',
    },
  },
  quantity: {
    type: Number,
    default: 1,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Produk harus memiliki kategori'],
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand',
    required: [true, 'Produk harus memiliki brand'],
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    required: [true, 'Produk harus memiliki supplier'],
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'product harus memiliki user'],
  },
});

// supplier: {
//   type: [
//     {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Supplier',
//     },
//   ],
//   required: true,
//   validate: {
//     validator: function (val) {
//       return val.length > 0;
//     },
//     message: 'product harus memiliki minimal satu supplier',
//   },
// }

productSchema.index({ user: 1, sku: 1 }, { unique: true });
productSchema.index({ user: 1, name: 1 }, { unique: true });

export default mongoose.model('Product', productSchema);
