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

// Import database connection
import { connectToDatabase, disconnectFromDatabase } from "./models/index.js";

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

// Initialize database connection
async function initializeApp() {
  try {
    // Connect to MongoDB
    await connectToDatabase();

    // Initialize managers and storage
    const adminManager = createAdminManager();
    const productManager = createProductManager();
    const dataStorage = createDataStorage();
    const rateLimiter = createRateLimiter();

    // Initialize master admin
    await adminManager.initializeMasterAdmin();

    // Create bot instance
    const bot = new Telegraf(BOT_CONFIG.TOKEN);

    // Create Express app
    const app = express();

    // Setup middleware and routes
    setupMiddleware(app);
    setupBotHandlers(bot, adminManager, productManager, dataStorage);
    setupRoutes(app, bot, dataStorage, productManager, adminManager);

    // Start server
    const server = app.listen(SERVER_CONFIG.PORT, () => {
      console.log(`🌐 Server running on port ${SERVER_CONFIG.PORT}`);
      console.log(`📊 Environment: ${SERVER_CONFIG.NODE_ENV}`);
      console.log(`🔗 Base URL: ${SERVER_CONFIG.BASE_URL}`);
    });

    // Start bot based on environment
    await startBot(bot);

    // Setup graceful shutdown
    setupGracefulShutdown(bot, server);

    // Add global error handlers to prevent crashes
    process.on("uncaughtException", (error) => {
      console.error("💥 Uncaught Exception:", error);
      // Don't exit immediately, let the graceful shutdown handle it
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
      // Don't exit immediately, let the graceful shutdown handle it
    });

    console.log("✅ Bot initialization complete!");
    console.log(`👑 Master Admin ID: ${await adminManager.getMasterAdminId()}`);
    console.log(
      `👥 Total Admins: ${(await adminManager.getAllAdmins()).length}`
    );
    console.log(`📦 Total Products: ${await productManager.getProductCount()}`);
    console.log(`🎯 Bot is ready to receive messages!`);
  } catch (error) {
    console.error("❌ Failed to initialize app:", error);
    process.exit(1);
  }
}

// Setup middleware
function setupMiddleware(app) {
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
}

// Setup bot handlers
function setupBotHandlers(bot, adminManager, productManager, dataStorage) {
  // User commands
  bot.start((ctx) => handleStartCommand(ctx, adminManager));
  bot.help((ctx) => handleHelpCommand(ctx, adminManager));
  bot.command("products", (ctx) => handleProductsCommand(ctx, productManager));
  bot.command("buy", (ctx) =>
    handleBuyCommand(ctx, productManager, dataStorage)
  );
  bot.command("pay", (ctx) => handlePayCommand(ctx, dataStorage));
  bot.command("status", (ctx) => handleStatusCommand(ctx, dataStorage));
  bot.command("refresh", (ctx) => handleRefreshStatusCommand(ctx, dataStorage));
  bot.command("cancel", (ctx) => handleCancelCommand(ctx, dataStorage));

  // Admin status check commands
  bot.command("adminstatus", async (ctx) => {
    const userId = ctx.from.id;
    const isAdmin = await adminManager.isAdmin(userId);
    const isMasterAdmin = await adminManager.isMasterAdmin(userId);

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
      message += `👑 Master Admin ID: ${await adminManager.getMasterAdminId()}`;
    }

    ctx.reply(message);
  });

  // Quick admin check command
  bot.command("checkadmin", async (ctx) => {
    const userId = ctx.from.id;
    const isAdmin = await adminManager.isAdmin(userId);
    const isMaster = await adminManager.isMasterAdmin(userId);

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
  bot.command("debugadmin", async (ctx) => {
    const userId = ctx.from.id;
    const masterAdminId = await adminManager.getMasterAdminId();
    const allAdmins = await adminManager.getAllAdmins();

    let message = `🔧 **Debug Admin Status**\n\n`;
    message += `🆔 Your User ID: ${userId} (type: ${typeof userId})\n`;
    message += `👑 Master Admin ID: ${masterAdminId} (type: ${typeof masterAdminId})\n`;
    message += `🔍 String comparison: ${
      userId.toString() === masterAdminId.toString()
    }\n`;
    message += `🔍 Direct comparison: ${userId === masterAdminId}\n`;
    message += `✅ Is Admin: ${await adminManager.isAdmin(userId)}\n`;
    message += `👑 Is Master Admin: ${await adminManager.isMasterAdmin(
      userId
    )}\n\n`;
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

  // Text message handlers
  bot.on("text", async (ctx) => {
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
      (await adminManager.isAdmin(userId))
    ) {
      const productData = dataStorage.userProductSelection.get(userId);
      handleProductCreation(
        ctx,
        userId,
        text,
        productData,
        productManager,
        dataStorage
      );
      return;
    }

    // Default response for unrecognized text
    ctx.reply(
      "❓ I didn't understand that message.\n\n" +
        "Use /help to see available commands or /start to begin."
    );
  });

  // Bot error handling
  bot.catch((err, ctx) => {
    console.error("Bot error:", err);
    ctx.reply(
      "❌ An error occurred. Please try again later.\n" +
        "If the problem persists, contact support."
    );
  });
}

// Setup routes
function setupRoutes(app, bot, dataStorage, productManager, adminManager) {
  // Create and setup routes
  const routes = createRoutes(bot, dataStorage, productManager, adminManager);
  app.use("/", routes);

  // Express error handling
  app.use((err, req, res, next) => {
    console.error("Express error:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: "An unexpected error occurred",
    });
  });
}

// Start bot
async function startBot(bot) {
  try {
    if (SERVER_CONFIG.NODE_ENV === "production") {
      // Production: Use webhook with Express server
      console.log("🔗 Setting up webhook for production...");

      // Set webhook URL
      await bot.telegram.setWebhook(
        `${SERVER_CONFIG.BASE_URL}/webhook/telegram`
      );
      console.log("✅ Bot webhook set successfully");
    } else {
      // Development: Use polling
      console.log("🔄 Starting bot with polling...");
      await bot.launch();
      console.log("✅ Bot started successfully with polling");
    }
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    throw error; // Re-throw to be caught by initializeApp
  }
}

// Setup graceful shutdown
function setupGracefulShutdown(bot, server) {
  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down gracefully...");
    try {
      // Check if bot is running before stopping
      if (bot && typeof bot.stop === "function") {
        await bot.stop("SIGINT");
        console.log("✅ Bot stopped");
      }
    } catch (error) {
      console.log(
        "⚠️ Bot was already stopped or error stopping bot:",
        error.message
      );
    }

    server.close(async () => {
      try {
        await disconnectFromDatabase();
        console.log("✅ Database disconnected");
      } catch (error) {
        console.log("⚠️ Error disconnecting from database:", error.message);
      }
      console.log("✅ Server closed");
      process.exit(0);
    });
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Shutting down gracefully...");
    try {
      // Check if bot is running before stopping
      if (bot && typeof bot.stop === "function") {
        await bot.stop("SIGTERM");
        console.log("✅ Bot stopped");
      }
    } catch (error) {
      console.log(
        "⚠️ Bot was already stopped or error stopping bot:",
        error.message
      );
    }

    server.close(async () => {
      try {
        await disconnectFromDatabase();
        console.log("✅ Database disconnected");
      } catch (error) {
        console.log("⚠️ Error disconnecting from database:", error.message);
      }
      console.log("✅ Server closed");
      process.exit(0);
    });
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", async (error) => {
    console.error("💥 Uncaught Exception:", error);
    try {
      if (bot && typeof bot.stop === "function") {
        await bot.stop("uncaughtException");
      }
    } catch (stopError) {
      console.error(
        "Error stopping bot during uncaught exception:",
        stopError.message
      );
    }
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", async (reason, promise) => {
    console.error("💥 Unhandled Rejection at:", promise, "reason:", reason);
    try {
      if (bot && typeof bot.stop === "function") {
        await bot.stop("unhandledRejection");
      }
    } catch (stopError) {
      console.error(
        "Error stopping bot during unhandled rejection:",
        stopError.message
      );
    }
    process.exit(1);
  });
}

// Initialize the application
initializeApp();
