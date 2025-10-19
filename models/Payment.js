// ============================================================================
// PAYMENT MODEL
// ============================================================================

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  chatId: {
    type: String,
    required: true,
  },
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  currency: {
    type: String,
    required: true,
    enum: ["USD", "EUR", "GBP", "INR"],
    uppercase: true,
  },
  status: {
    type: String,
    enum: ["pending", "completed", "failed", "cancelled"],
    default: "pending",
    required: true,
  },
  checkoutUrl: {
    type: String,
    required: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    default: null,
  },
  productName: {
    type: String,
    default: null,
  },
  transactionId: {
    type: String,
    default: null,
  },
  paymentId: {
    type: String,
    default: null,
  },
  billingAddress: {
    country: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    zip: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
});

// Update the updatedAt field before saving
paymentSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  if (this.status === "completed" && !this.completedAt) {
    this.completedAt = Date.now();
  }
  next();
});

// Indexes for better query performance
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ orderNumber: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });

// Static methods
paymentSchema.statics.findByUserId = function (userId) {
  return this.find({ userId: userId.toString() }).sort({ createdAt: -1 });
};

paymentSchema.statics.findActiveByUserId = function (userId) {
  return this.findOne({ 
    userId: userId.toString(), 
    status: { $in: ["pending", "completed"] } 
  }).sort({ createdAt: -1 });
};

paymentSchema.statics.findByOrderNumber = function (orderNumber) {
  return this.findOne({ orderNumber });
};

paymentSchema.statics.updatePaymentStatus = function (orderNumber, status, transactionId = null, paymentId = null) {
  const updateData = { 
    status, 
    updatedAt: Date.now() 
  };
  
  if (transactionId) {
    updateData.transactionId = transactionId;
  }
  
  if (paymentId) {
    updateData.paymentId = paymentId;
  }
  
  if (status === "completed") {
    updateData.completedAt = Date.now();
  }
  
  return this.findOneAndUpdate(
    { orderNumber },
    updateData,
    { new: true }
  );
};

paymentSchema.statics.getPaymentStats = function () {
  return this.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" }
      }
    }
  ]);
};

paymentSchema.statics.getUserPaymentHistory = function (userId, limit = 10) {
  return this.find({ userId: userId.toString() })
    .populate("productId", "title description")
    .sort({ createdAt: -1 })
    .limit(limit);
};

const Payment = mongoose.model("Payment", paymentSchema);

export default Payment;

