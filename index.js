// ============================================================================
// TELEGRAM PAYMENT BOT - MAIN ENTRY POINT
// ============================================================================

import express from "express";
import { Telegraf } from "telegraf";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

// Import configuration
import { SERVER_CONFIG, BOT_CONFIG, RATE_LIMIT_CONFIG } from "./config.js";

// Import utilities
import {
  createAdminManager,
  createProductManager,
  createDataStorage,
  createRateLimiter,
} from "./utils.js";

// Import handlers
import {
  handleStartCommand,
  handleHelpCommand,
  handleProductsCommand,
  handleBuyCommand,
  handlePayCommand,
  handleStatusCommand,
  handleRefreshStatusCommand,
  handleCancelCommand,
} from "./handlers/userCommands.js";

import {
  handleAddProductCommand,
  handleDeleteProductCommand,
  handleListProductsCommand,
  handleAddAdminCommand,
  handleRemoveAdminCommand,
  handleListAdminsCommand,
  requireAdminAccess,
  requireMasterAdminAccess,
} from "./handlers/adminCommands.js";

import {
  handleAddressCollection,
  handleProductCreation,
} from "./handlers/textHandlers.js";

// Import routes
import { createRoutes } from "./routes.js";

// ============================================================================
// INITIALIZATION
// ============================================================================

console.log("🚀 Starting Telegram Payment Bot...");

// Create Express app
const app = express();

// Initialize managers and storage
const adminManager = createAdminManager();
const productManager = createProductManager();
const dataStorage = createDataStorage();
const rateLimiter = createRateLimiter();

// Create bot instance
const bot = new Telegraf(BOT_CONFIG.TOKEN);

// ============================================================================
// MIDDLEWARE SETUP
// ============================================================================

// Security middleware
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW,
  max: RATE_LIMIT_CONFIG.MAX_REQUESTS,
  message: {
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ============================================================================
// BOT COMMAND HANDLERS
// ============================================================================

// User commands
bot.start((ctx) => handleStartCommand(ctx, adminManager));
bot.help((ctx) => handleHelpCommand(ctx, adminManager));
bot.command("products", (ctx) => handleProductsCommand(ctx, productManager));
bot.command("buy", (ctx) => handleBuyCommand(ctx, productManager, dataStorage));
bot.command("pay", (ctx) => handlePayCommand(ctx, dataStorage));
bot.command("status", (ctx) => handleStatusCommand(ctx, dataStorage));
bot.command("refresh", (ctx) => handleRefreshStatusCommand(ctx, dataStorage));
bot.command("cancel", (ctx) => handleCancelCommand(ctx, dataStorage));

// Admin status check commands
bot.command("adminstatus", (ctx) => {
  const userId = ctx.from.id;
  const isAdmin = adminManager.isAdmin(userId);
  const isMasterAdmin = adminManager.isMasterAdmin(userId);

  let message = `🔍 **Admin Status Check**\n\n`;
  message += `🆔 Your User ID: ${userId}\n`;
  message += `🔐 Admin Status: ${isAdmin ? "✅ Yes" : "❌ No"}\n`;
  message += `👑 Master Admin: ${isMasterAdmin ? "✅ Yes" : "❌ No"}\n\n`;

  if (isMasterAdmin) {
    message += `🎯 **Master Admin Commands:**\n`;
    message += `• /addadmin <user_id> - Add admin\n`;
    message += `• /removeadmin <user_id> - Remove admin\n`;
    message += `• /listadmins - List all admins\n`;
    message += `• /addproduct - Add product\n`;
    message += `• /deleteproduct <id> - Delete product\n`;
    message += `• /listproducts - List products (admin view)\n`;
  } else if (isAdmin) {
    message += `🎯 **Admin Commands:**\n`;
    message += `• /addproduct - Add product\n`;
    message += `• /deleteproduct <id> - Delete product\n`;
    message += `• /listproducts - List products (admin view)\n`;
    message += `• /listadmins - List all admins\n`;
  } else {
    message += `❌ You don't have admin privileges.\n`;
    message += `Contact the master admin for access.\n\n`;
    message += `👑 Master Admin ID: ${adminManager.getMasterAdminId()}`;
  }

  ctx.reply(message);
});

// Quick admin check command
bot.command("checkadmin", (ctx) => {
  const userId = ctx.from.id;
  const isAdmin = adminManager.isAdmin(userId);
  const isMaster = adminManager.isMasterAdmin(userId);

  let message = `🔍 **Quick Admin Check**\n\n`;
  message += `🆔 User ID: ${userId}\n`;
  message += `✅ Admin: ${isAdmin ? "Yes" : "No"}\n`;
  message += `👑 Master: ${isMaster ? "Yes" : "No"}\n`;

  if (isAdmin) {
    message += `\n🎯 You have admin privileges!`;
  } else {
    message += `\n❌ No admin privileges.`;
  }

  ctx.reply(message);
});

// Debug admin status command
bot.command("debugadmin", (ctx) => {
  const userId = ctx.from.id;
  const masterAdminId = adminManager.getMasterAdminId();
  const allAdmins = adminManager.getAllAdmins();

  let message = `🔧 **Debug Admin Status**\n\n`;
  message += `🆔 Your User ID: ${userId} (type: ${typeof userId})\n`;
  message += `👑 Master Admin ID: ${masterAdminId} (type: ${typeof masterAdminId})\n`;
  message += `🔍 String comparison: ${
    userId.toString() === masterAdminId.toString()
  }\n`;
  message += `🔍 Direct comparison: ${userId === masterAdminId}\n`;
  message += `✅ Is Admin: ${adminManager.isAdmin(userId)}\n`;
  message += `👑 Is Master Admin: ${adminManager.isMasterAdmin(userId)}\n\n`;
  message += `📋 All Admins: ${allAdmins.join(", ")}\n`;

  ctx.reply(message);
});

// Admin commands (with access control)
bot.command(
  "addproduct",
  requireAdminAccess(
    (ctx) => handleAddProductCommand(ctx, dataStorage),
    adminManager
  )
);
bot.command(
  "deleteproduct",
  requireAdminAccess(
    (ctx) => handleDeleteProductCommand(ctx, productManager),
    adminManager
  )
);
bot.command(
  "listproducts",
  requireAdminAccess(
    (ctx) => handleListProductsCommand(ctx, productManager),
    adminManager
  )
);

// Master admin commands (with access control)
bot.command(
  "addadmin",
  requireMasterAdminAccess(
    (ctx) => handleAddAdminCommand(ctx, adminManager),
    adminManager
  )
);
bot.command(
  "removeadmin",
  requireMasterAdminAccess(
    (ctx) => handleRemoveAdminCommand(ctx, adminManager),
    adminManager
  )
);
bot.command(
  "listadmins",
  requireMasterAdminAccess(
    (ctx) => handleListAdminsCommand(ctx, adminManager),
    adminManager
  )
);

// ============================================================================
// TEXT MESSAGE HANDLERS
// ============================================================================

bot.on("text", (ctx) => {
  const userId = ctx.from.id;
  const text = ctx.message.text;

  console.log(`Text message from user ${userId}: ${text}`);

  // Check if user is in address collection mode
  if (dataStorage.userAddressCollection.has(userId)) {
    const addressData = dataStorage.userAddressCollection.get(userId);
    handleAddressCollection(ctx, userId, text, addressData, dataStorage);
    return;
  }

  // Check if user is in product creation mode (admin only)
  if (
    dataStorage.userProductSelection.has(userId) &&
    adminManager.isAdmin(userId)
  ) {
    const productData = dataStorage.userProductSelection.get(userId);
    handleProductCreation(ctx, userId, text, productData);
    return;
  }

  // Default response for unrecognized text
  ctx.reply(
    "❓ I didn't understand that message.\n\n" +
      "Use /help to see available commands or /start to begin."
  );
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// Bot error handling
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply(
    "❌ An error occurred. Please try again later.\n" +
      "If the problem persists, contact support."
  );
});

// Express error handling
app.use((err, req, res, next) => {
  console.error("Express error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred",
  });
});

// ============================================================================
// ROUTES SETUP
// ============================================================================

// Create and setup routes
const routes = createRoutes(bot, dataStorage, productManager, adminManager);
app.use("/", routes);

// ============================================================================
// SERVER STARTUP
// ============================================================================

// Start Express server
const server = app.listen(SERVER_CONFIG.PORT, () => {
  console.log(`🌐 Server running on port ${SERVER_CONFIG.PORT}`);
  console.log(`📊 Environment: ${SERVER_CONFIG.NODE_ENV}`);
  console.log(`🔗 Base URL: ${SERVER_CONFIG.BASE_URL}`);
});

// Start bot based on environment
if (SERVER_CONFIG.NODE_ENV === "production") {
  // Production: Use webhook with Express server
  console.log("🔗 Setting up webhook for production...");

  // Set webhook URL
  bot.telegram
    .setWebhook(`${SERVER_CONFIG.BASE_URL}/webhook/telegram`)
    .then(() => {
      console.log("✅ Bot webhook set successfully");
    })
    .catch((error) => {
      console.error("❌ Failed to set webhook:", error);
      process.exit(1);
    });
} else {
  // Development: Use polling
  console.log("🔄 Starting bot with polling...");
  bot
    .launch()
    .then(() => {
      console.log("✅ Bot started successfully with polling");
    })
    .catch((error) => {
      console.error("❌ Failed to start bot:", error);
      process.exit(1);
    });
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down gracefully...");
  bot.stop("SIGINT");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Shutting down gracefully...");
  bot.stop("SIGTERM");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

// ============================================================================
// STARTUP LOGS
// ============================================================================

console.log("✅ Bot initialization complete!");
console.log(`👑 Master Admin ID: ${adminManager.getMasterAdminId()}`);
console.log(`👥 Total Admins: ${adminManager.getAllAdmins().length}`);
console.log(`📦 Total Products: ${productManager.getProductCount()}`);
console.log(`🎯 Bot is ready to receive messages!`);
