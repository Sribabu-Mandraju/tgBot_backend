// ============================================================================
// PRODUCT MODEL
// ============================================================================

import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
  },
  description: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
    max: 1000000,
  },
  currency: {
    type: String,
    required: true,
    enum: ["USD", "EUR", "GBP", "INR"],
    uppercase: true,
  },
  createdBy: {
    type: String,
    required: true,
    ref: "Admin",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
});

// Update the updatedAt field before saving
productSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Static methods
productSchema.statics.findActiveProducts = function () {
  return this.find({ isActive: true }).sort({ createdAt: -1 });
};

productSchema.statics.findAllProducts = function () {
  return this.find({}).sort({ createdAt: -1 });
};

productSchema.statics.findProductById = function (productId) {
  return this.findOne({ _id: productId, isActive: true });
};

productSchema.statics.findProductsByAdmin = function (adminId) {
  return this.find({ createdBy: adminId }).sort({ createdAt: -1 });
};

productSchema.statics.softDeleteProduct = function (productId) {
  return this.findByIdAndUpdate(
    productId,
    { isActive: false, updatedAt: Date.now() },
    { new: true }
  );
};

const Product = mongoose.model("Product", productSchema);

export default Product;

