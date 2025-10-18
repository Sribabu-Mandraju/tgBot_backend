// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

import { VALIDATION_CONFIG, ERROR_MESSAGES } from "./config.js";

// ============================================================================
// ADMIN MANAGEMENT FUNCTIONS
// ============================================================================

export function createAdminManager() {
  const MASTER_ADMIN_ID = process.env.MASTER_ADMIN_ID || "1360354055";
  const admins = new Set([MASTER_ADMIN_ID]);

  return {
    isMasterAdmin: (userId) => userId === MASTER_ADMIN_ID,
    isAdmin: (userId) => admins.has(userId),
    addAdmin: (userId) => admins.add(userId),
    removeAdmin: (userId) => {
      if (userId !== MASTER_ADMIN_ID) {
        admins.delete(userId);
      }
    },
    getAllAdmins: () => Array.from(admins),
    getMasterAdminId: () => MASTER_ADMIN_ID,
  };
}

// ============================================================================
// PRODUCT MANAGEMENT FUNCTIONS
// ============================================================================

export function createProductManager() {
  const products = new Map();
  let nextProductId = 1;

  return {
    createProduct: (name, description, price, currency, createdBy) => {
      const productId = nextProductId++;
      products.set(productId, {
        id: productId,
        name,
        description,
        price: parseFloat(price),
        currency: currency.toUpperCase(),
        createdBy,
        createdAt: new Date(),
      });
      return productId;
    },
    getProduct: (productId) => products.get(parseInt(productId)),
    getAllProducts: () => Array.from(products.values()),
    deleteProduct: (productId) => products.delete(parseInt(productId)),
    getProductCount: () => products.size,
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
    userSessions: new Map(),
    userAddressCollection: new Map(),
    userProductSelection: new Map(),
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
    `🆔 **ID:** ${product.id}\n` +
    `📝 **Name:** ${product.name}\n` +
    `💰 **Price:** ${product.price} ${product.currency}\n` +
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
      `🆔 **ID:** ${product.id}\n` +
      `📝 **Name:** ${product.name}\n` +
      `💰 **Price:** ${product.price} ${product.currency}\n` +
      `📄 **Description:** ${product.description}\n` +
      `👤 **Created By:** ${product.createdBy}\n` +
      `📅 **Created:** ${product.createdAt.toLocaleString()}\n\n`;
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
