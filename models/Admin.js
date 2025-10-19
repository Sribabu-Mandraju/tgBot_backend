// ============================================================================
// ADMIN MODEL
// ============================================================================

import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  role: {
    type: String,
    enum: ["admin", "masteradmin"],
    required: true,
    default: "admin",
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update the updatedAt field before saving
adminSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Static methods
adminSchema.statics.findByUserId = function (userId) {
  return this.findOne({ userId: userId.toString() });
};

adminSchema.statics.findMasterAdmin = function () {
  return this.findOne({ role: "masteradmin" });
};

adminSchema.statics.findAllAdmins = function () {
  return this.find({}).sort({ createdAt: 1 });
};

adminSchema.statics.isAdmin = async function (userId) {
  const admin = await this.findByUserId(userId);
  return !!admin;
};

adminSchema.statics.isMasterAdmin = async function (userId) {
  const admin = await this.findByUserId(userId);
  return admin && admin.role === "masteradmin";
};

const Admin = mongoose.model("Admin", adminSchema);

export default Admin;
