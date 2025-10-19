// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import { VALIDATION_CONFIG, ERROR_MESSAGES } from "./config.js";
import { Admin, Product, Payment } from "./models/index.js";

// ============================================================================
// ADMIN MANAGEMENT FUNCTIONS
// ============================================================================

export function createAdminManager() {
  return {
    async isMasterAdmin(userId) {
      try {
        const admin = await Admin.findByUserId(userId);
        return admin && admin.role === "masteradmin";
      } catch (error) {
        console.error("Error checking master admin status:", error);
        return false;
      }
    },

    async isAdmin(userId) {
      try {
        return await Admin.isAdmin(userId);
      } catch (error) {
        console.error("Error checking admin status:", error);
        return false;
      }
    },

    async addAdmin(userId, name = "Admin User") {
      try {
        const existingAdmin = await Admin.findByUserId(userId);
        if (existingAdmin) {
          throw new Error("Admin already exists");
        }

        const admin = new Admin({
          userId: userId.toString(),
          role: "admin",
          name: name,
        });

        await admin.save();
        console.log(`Admin added: ${userId} (${name})`);
        return admin;
      } catch (error) {
        console.error("Error adding admin:", error);
        throw error;
      }
    },

    async removeAdmin(userId) {
      try {
        const admin = await Admin.findByUserId(userId);
        if (!admin) {
          throw new Error("Admin not found");
        }

        if (admin.role === "masteradmin") {
          throw new Error("Cannot remove master admin");
        }

        await Admin.findOneAndDelete({ userId: userId.toString() });
        console.log(`Admin removed: ${userId}`);
        return true;
      } catch (error) {
        console.error("Error removing admin:", error);
        throw error;
      }
    },

    async getAllAdmins() {
      try {
        const admins = await Admin.findAllAdmins();
        return admins.map((admin) => admin.userId);
      } catch (error) {
        console.error("Error getting all admins:", error);
        return [];
      }
    },

    async getMasterAdminId() {
      try {
        const masterAdmin = await Admin.findMasterAdmin();
        return masterAdmin ? masterAdmin.userId : null;
      } catch (error) {
        console.error("Error getting master admin ID:", error);
        return null;
      }
    },

    async initializeMasterAdmin() {
      try {
        const masterAdminId = process.env.MASTER_ADMIN_ID || "1360354055";
        const existingMaster = await Admin.findMasterAdmin();

        if (!existingMaster) {
          const masterAdmin = new Admin({
            userId: masterAdminId,
            role: "masteradmin",
            name: "Master Admin",
          });

          await masterAdmin.save();
          console.log(`Master admin initialized: ${masterAdminId}`);
        }
      } catch (error) {
        console.error("Error initializing master admin:", error);
      }
    },
  };
}

// ============================================================================
// PRODUCT MANAGEMENT FUNCTIONS
// ============================================================================

export function createProductManager() {
  return {
    async createProduct(name, description, price, currency, createdBy) {
      try {
        const product = new Product({
          title: name,
          description: description,
          amount: parseFloat(price),
          currency: currency.toUpperCase(),
          createdBy: createdBy.toString(),
        });

        await product.save();
        console.log(`Product created: ${name} by ${createdBy}`);
        return product._id;
      } catch (error) {
        console.error("Error creating product:", error);
        throw error;
      }
    },

    async getProduct(productId) {
      try {
        return await Product.findProductById(productId);
      } catch (error) {
        console.error("Error getting product:", error);
        return null;
      }
    },

    async getAllProducts() {
      try {
        return await Product.findActiveProducts();
      } catch (error) {
        console.error("Error getting all products:", error);
        return [];
      }
    },

    async getAllProductsForAdmin() {
      try {
        return await Product.findAllProducts();
      } catch (error) {
        console.error("Error getting all products for admin:", error);
        return [];
      }
    },

    async deleteProduct(productId) {
      try {
        const product = await Product.findById(productId);
        if (!product) {
          throw new Error("Product not found");
        }

        await Product.softDeleteProduct(productId);
        console.log(`Product deleted: ${productId}`);
        return true;
      } catch (error) {
        console.error("Error deleting product:", error);
        throw error;
      }
    },

    async getProductCount() {
      try {
        return await Product.countDocuments({ isActive: true });
      } catch (error) {
        console.error("Error getting product count:", error);
        return 0;
      }
    },

    async getProductsByAdmin(adminId) {
      try {
        return await Product.findProductsByAdmin(adminId);
      } catch (error) {
        console.error("Error getting products by admin:", error);
        return [];
      }
    },
  };
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

export function validateAmount(amount) {
  const numAmount = parseFloat(amount);
  return (
    !isNaN(numAmount) &&
    numAmount >= VALIDATION_CONFIG.MIN_AMOUNT &&
    numAmount <= VALIDATION_CONFIG.MAX_AMOUNT
  );
}

export function validateCurrency(currency) {
  return VALIDATION_CONFIG.SUPPORTED_CURRENCIES.includes(
    currency.toUpperCase()
  );
}

export function validateAddressField(value, fieldName) {
  if (!value || value.trim().length < VALIDATION_CONFIG.MIN_FIELD_LENGTH) {
    return `${fieldName} must be at least ${VALIDATION_CONFIG.MIN_FIELD_LENGTH} characters long`;
  }
  return null;
}

export function validatePhone(phone) {
  if (
    !phone ||
    !VALIDATION_CONFIG.PHONE_REGEX.test(phone.replace(/[\s\-\(\)]/g, ""))
  ) {
    return "Please enter a valid phone number (e.g., +1234567890)";
  }
  return null;
}

export function validateZip(zip) {
  if (!zip || zip.trim().length < VALIDATION_CONFIG.MIN_FIELD_LENGTH) {
    return "ZIP code must be at least 2 characters long";
  }
  return null;
}

// ============================================================================
// RATE LIMITING FUNCTIONS
// ============================================================================

export function createRateLimiter() {
  const rateLimit = new Map();
  const RATE_LIMIT_WINDOW = 60000; // 1 minute
  const RATE_LIMIT_MAX_REQUESTS = 10;

  return {
    checkRateLimit: (ip) => {
      const now = Date.now();
      const userRequests = rateLimit.get(ip) || [];
      const validRequests = userRequests.filter(
        (time) => now - time < RATE_LIMIT_WINDOW
      );

      if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
      }

      validRequests.push(now);
      rateLimit.set(ip, validRequests);
      return true;
    },
  };
}

// ============================================================================
// DATA STORAGE FUNCTIONS
// ============================================================================

export function createDataStorage() {
  return {
    // User sessions for active payments
    userSessions: new Map(),

    // Address collection for ongoing processes
    userAddressCollection: new Map(),

    // Product creation for ongoing processes
    userProductSelection: new Map(),

    // Payment management functions
    async createPaymentSession(paymentData) {
      try {
        const payment = new Payment(paymentData);
        await payment.save();

        // Also store in memory for quick access
        this.userSessions.set(paymentData.userId, {
          orderNumber: payment.orderNumber,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          checkoutUrl: payment.checkoutUrl,
          productId: payment.productId,
          productName: payment.productName,
          createdAt: payment.createdAt,
          _id: payment._id,
        });

        console.log(`Payment session created: ${payment.orderNumber}`);
        return payment;
      } catch (error) {
        console.error("Error creating payment session:", error);
        throw error;
      }
    },

    async updatePaymentStatus(
      orderNumber,
      status,
      transactionId = null,
      paymentId = null
    ) {
      try {
        const payment = await Payment.updatePaymentStatus(
          orderNumber,
          status,
          transactionId,
          paymentId
        );

        if (payment) {
          // Update in-memory session
          for (const [userId, session] of this.userSessions.entries()) {
            if (session.orderNumber === orderNumber) {
              session.status = status;
              if (transactionId) session.transactionId = transactionId;
              if (paymentId) session.paymentId = paymentId;
              session.updatedAt = new Date();
              break;
            }
          }
        }

        return payment;
      } catch (error) {
        console.error("Error updating payment status:", error);
        throw error;
      }
    },

    async getPaymentByOrderNumber(orderNumber) {
      try {
        return await Payment.findByOrderNumber(orderNumber);
      } catch (error) {
        console.error("Error getting payment by order number:", error);
        return null;
      }
    },

    async getUserPayments(userId) {
      try {
        return await Payment.findByUserId(userId);
      } catch (error) {
        console.error("Error getting user payments:", error);
        return [];
      }
    },

    async getActiveUserPayment(userId) {
      try {
        return await Payment.findActiveByUserId(userId);
      } catch (error) {
        console.error("Error getting active user payment:", error);
        return null;
      }
    },

    async getPaymentStats() {
      try {
        return await Payment.getPaymentStats();
      } catch (error) {
        console.error("Error getting payment stats:", error);
        return [];
      }
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function formatCurrency(amount, currency) {
  return `${amount} ${currency}`;
}

export function formatDate(date) {
  return date.toLocaleString();
}

export function generateOrderNumber(userId) {
  return `TG_${userId}_${Date.now()}`;
}

export function sanitizeInput(input) {
  return input.trim();
}

export function isValidUserId(userId) {
  return /^\d+$/.test(userId);
}

// ============================================================================
// MESSAGE FORMATTING FUNCTIONS
// ============================================================================

export function formatProductMessage(product) {
  return (
    `🆔 **ID:** ${product._id}\n` +
    `📝 **Name:** ${product.title}\n` +
    `💰 **Price:** ${product.amount} ${product.currency}\n` +
    `📄 **Description:** ${product.description}`
  );
}

export function formatProductListMessage(products) {
  if (products.length === 0) {
    return "📦 No products available at the moment.\n\nContact an admin to add products.";
  }

  let message = "📦 **Available Products:**\n\n";
  products.forEach((product) => {
    message += formatProductMessage(product) + "\n\n";
  });

  message +=
    `💡 **To buy a product, use:** /buy <product_id>\n` + `Example: /buy 1`;

  return message;
}

export function formatAdminProductListMessage(products) {
  if (products.length === 0) {
    return "📦 No products found.";
  }

  let message = "📦 **All Products (Admin View):**\n\n";
  products.forEach((product) => {
    message +=
      `🆔 **ID:** ${product._id}\n` +
      `📝 **Name:** ${product.title}\n` +
      `💰 **Price:** ${product.amount} ${product.currency}\n` +
      `📄 **Description:** ${product.description}\n` +
      `👤 **Created By:** ${product.createdBy}\n` +
      `📅 **Created:** ${product.createdAt.toLocaleString()}\n` +
      `🔄 **Status:** ${product.isActive ? "Active" : "Inactive"}\n\n`;
  });

  return message;
}

export function formatAdminListMessage(admins, masterAdminId) {
  let message = "👑 **Admin List:**\n\n";

  admins.forEach((adminId) => {
    const isMaster = adminId === masterAdminId;
    message += `${isMaster ? "👑" : "🔧"} **${adminId}** ${
      isMaster ? "(Master Admin)" : "(Admin)"
    }\n`;
  });

  return message;
}

export function formatPaymentStatusMessage(session) {
  const statusEmojis = {
    pending: "⏳",
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
  };

  const statusEmoji = statusEmojis[session.status] || "❓";

  let message =
    `📋 **Payment Status**\n\n` +
    `Order: ${session.orderNumber}\n` +
    `Amount: ${session.amount} ${session.currency}\n` +
    `Status: ${statusEmoji} ${session.status}\n` +
    `Created: ${session.createdAt.toLocaleString()}\n\n`;

  if (session.productName) {
    message += `Product: ${session.productName}\n\n`;
  }

  if (session.status === "pending") {
    message +=
      "Payment is still pending. Complete it using the link sent earlier.";
  }

  return message;
}

export function updatePaymentStatus(
  dataStorage,
  orderNumber,
  newStatus,
  transactionId = null
) {
  // Find the user session by order number
  for (const [userId, session] of dataStorage.userSessions.entries()) {
    if (session.orderNumber === orderNumber) {
      session.status = newStatus.toLowerCase();
      if (transactionId) {
        session.transactionId = transactionId;
      }
      session.updatedAt = new Date();
      return { userId, session };
    }
  }
  return null;
}
