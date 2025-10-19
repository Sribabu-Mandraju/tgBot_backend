// ============================================================================
// CONFIGURATION & CONSTANTS
// ============================================================================

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Server Configuration
export const SERVER_CONFIG = {
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || "https://tgbot-backend-ycwm.onrender.com",
  NODE_ENV: process.env.NODE_ENV || "development",
};

// MongoDB Configuration
export const MONGODB_CONFIG = {
  URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/telegram_payment_bot",
  OPTIONS: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
};

// Telegram Bot Configuration
export const BOT_CONFIG = {
  TOKEN:
    process.env.TELEGRAM_BOT_TOKEN ||
    "8414140800:AAGD3rLf9xNqxr_Ps08HIsoByMDV4wwNxBE",
};

// Ragapay Configuration
export const RAGAPAY_CONFIG = {
  key: process.env.RAGAPAY_TEST_KEY || "63027294-a04c-11f0-a710-0ee5bf94a9b3",
  password: process.env.RAGAPAY_PASSWORD || "62f0c985b6dd21945ded2f0aba81f21f",
  endpoint:
    process.env.RAGAPAY_ENDPOINT ||
    "https://checkout.ragapay.com/api/v1/session",
};

// Admin Configuration
export const ADMIN_CONFIG = {
  MASTER_ADMIN_ID: process.env.MASTER_ADMIN_ID || "1360354055",
};

// Rate Limiting Configuration
export const RATE_LIMIT_CONFIG = {
  WINDOW: 60000, // 1 minute
  MAX_REQUESTS: 10,
  PAYMENT_WINDOW: 300000, // 5 minutes for payment operations
  MAX_PAYMENT_REQUESTS: 3, // Max 3 payment attempts per 5 minutes
};

// Validation Constants
export const VALIDATION_CONFIG = {
  SUPPORTED_CURRENCIES: ["USD", "EUR", "GBP", "INR"],
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 1000000,
  MIN_FIELD_LENGTH: 2,
  MIN_DESCRIPTION_LENGTH: 5,
  PHONE_REGEX: /^[\+]?[1-9][\d]{0,15}$/,
};

// Payment Methods Configuration
export const PAYMENT_METHODS = {
  CARD: "card",
  APPLE_PAY: "applepay",
  GOOGLE_PAY: "googlepay",
  PAYPAL: "paypal",
  SUPPORTED_METHODS: ["card", "applepay"],
};

// Address Collection Steps
export const ADDRESS_STEPS = {
  COUNTRY: "country",
  STATE: "state",
  CITY: "city",
  ADDRESS: "address",
  ZIP: "zip",
  PHONE: "phone",
};

// Default Address Configuration
export const DEFAULT_ADDRESS = {
  country: "US",
  state: "CA",
  city: "Cupertino",
  address: "1 Infinite Loop",
  zip: "95014",
  phone: "+19035310488",
};

// Product Creation Steps
export const PRODUCT_STEPS = {
  NAME: "name",
  DESCRIPTION: "description",
  PRICE: "price",
  CURRENCY: "currency",
};

// Payment Status Emojis
export const STATUS_EMOJIS = {
  pending: "⏳",
  completed: "✅",
  failed: "❌",
  cancelled: "🚫",
};

// Error Messages
export const ERROR_MESSAGES = {
  ACCESS_DENIED: "❌ Access denied. Admin privileges required.",
  MASTER_ACCESS_DENIED: "❌ Access denied. Master admin privileges required.",
  INVALID_FORMAT: "❌ Invalid format.",
  PRODUCT_NOT_FOUND: "❌ Product not found.",
  INVALID_AMOUNT:
    "❌ Invalid amount. Please enter a number between 1 and 1,000,000.",
  UNSUPPORTED_CURRENCY:
    "❌ Unsupported currency. Supported: USD, EUR, GBP, INR",
  PAYMENT_FAILED:
    "❌ Failed to create payment session. Please try again later.",
};

// Success Messages
export const SUCCESS_MESSAGES = {
  PRODUCT_CREATED: "✅ Product Created Successfully!",
  PRODUCT_DELETED: "✅ Product has been deleted.",
  ADMIN_ADDED: "✅ User has been added as an admin.",
  ADMIN_REMOVED: "✅ User has been removed from admins.",
  PAYMENT_CREATED: "💳 Payment Session Created!",
};

// Security Configuration
export const SECURITY_CONFIG = {
  MAX_ORDER_NUMBER_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 1024,
  MAX_CUSTOMER_NAME_LENGTH: 100,
  MAX_ADDRESS_FIELD_LENGTH: 100,
  SIGNATURE_TIMEOUT: 300000, // 5 minutes
  WEBHOOK_TIMEOUT: 10000, // 10 seconds
  ALLOWED_ORDER_PREFIXES: ["TG_", "ORDER_", "PAY_"],
};
