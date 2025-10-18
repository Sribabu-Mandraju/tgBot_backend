// Telegram Payment Bot with Ragapay Integration
import express from "express";
import { Telegraf } from "telegraf";
import axios from "axios";
import CryptoJS from "crypto-js";
import bodyParser from "body-parser";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL =
  process.env.BASE_URL || "https://tgbot-backend-ycwm.onrender.com";

// Initialize Telegram bot
const bot = new Telegraf(
  process.env.TELEGRAM_BOT_TOKEN ||
    "8414140800:AAGD3rLf9xNqxr_Ps08HIsoByMDV4wwNxBE"
);

// Ragapay configuration
const RAGAPAY_CONFIG = {
  key: process.env.RAGAPAY_TEST_KEY || "63027294-a04c-11f0-a710-0ee5bf94a9b3",
  password: process.env.RAGAPAY_PASSWORD || "62f0c985b6dd21945ded2f0aba81f21f",
  endpoint:
    process.env.RAGAPAY_ENDPOINT ||
    "https://checkout.ragapay.com/api/v1/session",
};

// In-memory storage for demo (replace with database in production)
const userSessions = new Map();

// Middleware
app.use(bodyParser.json());
app.use(express.static("public"));

// Trust proxy for production deployment (Render, Heroku, etc.)
app.set("trust proxy", 1);

// CORS for production
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Security headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  next();
});

// Rate limiting (simple implementation)
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimit.get(ip) || [];

  // Remove old requests outside the window
  const validRequests = userRequests.filter(
    (time) => now - time < RATE_LIMIT_WINDOW
  );

  if (validRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  validRequests.push(now);
  rateLimit.set(ip, validRequests);
  return true;
}

// Helper: Generate HMAC-SHA256 hash for Ragapay
function generateHash(payload) {
  try {
    if (!RAGAPAY_CONFIG.password) {
      throw new Error("Ragapay password is not configured");
    }

    const stringified = JSON.stringify(payload);
    const hash = CryptoJS.HmacSHA256(stringified, RAGAPAY_CONFIG.password);

    if (!hash || !hash.sigBytes) {
      throw new Error("Failed to generate hash");
    }

    return hash.toString(CryptoJS.enc.Hex);
  } catch (error) {
    console.error("Hash generation error:", error);
    throw new Error(`Hash generation failed: ${error.message}`);
  }
}

// Helper: Validate amount
function validateAmount(amount) {
  const numAmount = parseFloat(amount);
  return !isNaN(numAmount) && numAmount >= 1 && numAmount <= 1000000;
}

// Helper: Validate currency
function validateCurrency(currency) {
  const supportedCurrencies = ["USD", "EUR", "GBP", "INR"];
  return supportedCurrencies.includes(currency.toUpperCase());
}

// Telegram Bot Commands

// Start command
bot.start((ctx) => {
  console.log(`User ${ctx.from.id} started the bot`);
  ctx.reply(
    `🤖 Welcome to the Payment Bot!\n\n` +
      `I can help you process payments securely using Ragapay.\n\n` +
      `Available commands:\n` +
      `• /help - Show this help message\n` +
      `• /pay <amount> <currency> - Create a payment session\n` +
      `• /status - Check your payment status\n\n` +
      `Example: /pay 100 USD`
  );
});

// Help command
bot.help((ctx) => {
  console.log(`User ${ctx.from.id} requested help`);
  ctx.reply(
    `📖 Payment Bot Help\n\n` +
      `Commands:\n` +
      `• /start - Welcome message\n` +
      `• /help - Show this help\n` +
      `• /pay <amount> <currency> - Create payment\n` +
      `• /status - Check payment status\n\n` +
      `Supported currencies: USD, EUR, GBP, INR\n` +
      `Amount range: 1 to 1,000,000\n\n` +
      `Examples:\n` +
      `• /pay 50 USD\n` +
      `• /pay 100 EUR\n` +
      `• /pay 5000 INR`
  );
});

// Pay command
bot.command("pay", async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  console.log(`User ${userId} initiated payment with args:`, args);

  if (args.length !== 2) {
    return ctx.reply(
      "❌ Invalid format. Use: /pay <amount> <currency>\n" +
        "Example: /pay 100 USD"
    );
  }

  const [amountStr, currency] = args;

  // Validate amount
  if (!validateAmount(amountStr)) {
    return ctx.reply(
      "❌ Invalid amount. Please enter a number between 1 and 1,000,000."
    );
  }

  // Validate currency
  if (!validateCurrency(currency)) {
    return ctx.reply("❌ Unsupported currency. Supported: USD, EUR, GBP, INR");
  }

  const amount = parseFloat(amountStr);
  const currencyUpper = currency.toUpperCase();

  try {
    // Create payment session
    const orderNumber = `TG_${userId}_${Date.now()}`;

    console.log(`Ragapay config check:`, {
      key: RAGAPAY_CONFIG.key ? "present" : "missing",
      password: RAGAPAY_CONFIG.password ? "present" : "missing",
      endpoint: RAGAPAY_CONFIG.endpoint,
    });

    const payload = {
      merchant_key: RAGAPAY_CONFIG.key,
      operation: "purchase",
      methods: ["card"],
      order: {
        number: orderNumber,
        amount: amount.toFixed(2),
        currency: currencyUpper,
        description: `Telegram Payment - ${amount} ${currencyUpper}`,
      },
      cancel_url: `${BASE_URL}/payment/cancel`,
      success_url: `${BASE_URL}/payment/success`,
      customer: {
        name: ctx.from.first_name || "Telegram User",
        email: "user@telegram.com",
      },
      billing_address: {
        country: "US",
        state: "",
        city: "",
        address: "",
        zip: "",
        phone: "",
      },
      parameters: {
        telegram_user_id: userId,
        telegram_chat_id: ctx.chat.id,
      },
      hash: "",
    };

    // Generate hash
    payload.hash = generateHash({ ...payload, hash: "" });

    console.log(
      `Creating payment session for user ${userId}, order: ${orderNumber}`
    );

    const response = await axios.post(RAGAPAY_CONFIG.endpoint, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    // Store session info
    userSessions.set(userId, {
      orderNumber,
      amount,
      currency: currencyUpper,
      status: "pending",
      checkoutUrl: response.data.checkout_url,
      createdAt: new Date(),
    });

    console.log(
      `Payment session created for user ${userId}: ${response.data.checkout_url}`
    );

    ctx.reply(
      `💳 Payment Session Created!\n\n` +
        `Amount: ${amount} ${currencyUpper}\n` +
        `Order: ${orderNumber}\n\n` +
        `Click the link below to complete your payment:\n` +
        `${response.data.checkout_url}\n\n` +
        `Use /status to check your payment status.`
    );
  } catch (error) {
    console.error(
      `Payment creation failed for user ${userId}:`,
      error.response?.data || error.message
    );

    ctx.reply(
      "❌ Failed to create payment session. Please try again later.\n" +
        "If the problem persists, contact support."
    );
  }
});

// Status command
bot.command("status", (ctx) => {
  const userId = ctx.from.id;
  const session = userSessions.get(userId);

  console.log(`User ${userId} checked status`);

  if (!session) {
    return ctx.reply(
      "📋 No active payment sessions found.\n" +
        "Use /pay to create a new payment."
    );
  }

  const statusEmoji = {
    pending: "⏳",
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
  };

  ctx.reply(
    `📋 Payment Status\n\n` +
      `Order: ${session.orderNumber}\n` +
      `Amount: ${session.amount} ${session.currency}\n` +
      `Status: ${statusEmoji[session.status] || "❓"} ${session.status}\n` +
      `Created: ${session.createdAt.toLocaleString()}\n\n` +
      `${
        session.status === "pending"
          ? "Payment is still pending. Complete it using the link sent earlier."
          : ""
      }`
  );
});

// Handle any other text messages
bot.on("text", (ctx) => {
  console.log(`User ${ctx.from.id} sent text: ${ctx.message.text}`);
  ctx.reply(
    "🤖 I only respond to commands. Use /help to see available commands."
  );
});

// Error handling
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ An error occurred. Please try again.");
});

// Express Routes

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Payment success page
app.get("/payment/success", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Success</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .success { color: #28a745; font-size: 24px; }
        .message { margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="success">✅ Payment Successful!</div>
      <div class="message">Your payment has been processed successfully.</div>
      <div class="message">You can close this window and return to Telegram.</div>
    </body>
    </html>
  `);
});

// Payment cancel page
app.get("/payment/cancel", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled</title>
      <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .cancel { color: #dc3545; font-size: 24px; }
        .message { margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="cancel">❌ Payment Cancelled</div>
      <div class="message">Your payment was cancelled.</div>
      <div class="message">You can close this window and return to Telegram.</div>
    </body>
    </html>
  `);
});

// Ragapay webhook endpoint
app.post("/webhook/ragapay", (req, res) => {
  const ip = req.ip || req.connection.remoteAddress;

  // Rate limiting
  if (!checkRateLimit(ip)) {
    console.log(`Rate limit exceeded for IP: ${ip}`);
    return res.status(429).json({ error: "Rate limit exceeded" });
  }

  const { status, order_number, transaction_id } = req.body;

  console.log(
    `Webhook received: Order ${order_number}, Status: ${status}, Transaction: ${transaction_id}`
  );

  // Find user by order number
  for (const [userId, session] of userSessions.entries()) {
    if (session.orderNumber === order_number) {
      // Update session status
      session.status = status.toLowerCase();
      session.transactionId = transaction_id;
      session.updatedAt = new Date();

      console.log(`Updated session for user ${userId}: ${status}`);

      // Notify user via Telegram
      bot.telegram
        .sendMessage(
          userId,
          `📢 Payment Update\n\n` +
            `Order: ${order_number}\n` +
            `Status: ${status}\n` +
            `Transaction ID: ${transaction_id}\n\n` +
            `${
              status.toLowerCase() === "completed"
                ? "✅ Payment successful!"
                : status.toLowerCase() === "failed"
                ? "❌ Payment failed!"
                : "📋 Payment status updated."
            }`
        )
        .catch((err) => {
          console.error(`Failed to notify user ${userId}:`, err);
        });

      break;
    }
  }

  res.status(200).json({ status: "OK" });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Telegram bot started`);
  console.log(`🔗 Webhook URL: ${BASE_URL}/webhook/ragapay`);
  console.log(`🌐 Production URL: ${BASE_URL}`);
});

// Start bot
bot
  .launch()
  .then(() => {
    console.log("🤖 Telegram bot is running!");
  })
  .catch((err) => {
    console.error("❌ Failed to start Telegram bot:", err);
    process.exit(1);
  });

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
