// ============================================================================
// USER COMMAND HANDLERS
// ============================================================================

import {
  validateAmount,
  validateCurrency,
  formatProductListMessage,
  formatPaymentStatusMessage,
} from "../utils.js";
import { createPaymentSession } from "../ragapay.js";
import { ERROR_MESSAGES } from "../config.js";

// ============================================================================
// PRODUCT COMMANDS
// ============================================================================

export function handleProductsCommand(ctx, productManager) {
  console.log(`User ${ctx.from.id} requested products list`);
  const productList = productManager.getAllProducts();

  const message = formatProductListMessage(productList);
  ctx.reply(message);
}

export function handleBuyCommand(ctx, productManager, dataStorage) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  console.log(`User ${userId} initiated product purchase with args:`, args);

  if (args.length !== 1) {
    return ctx.reply(
      "❌ Invalid format. Use: /buy <product_id>\nExample: /buy 1"
    );
  }

  const productId = parseInt(args[0]);
  const product = productManager.getProduct(productId);

  if (!product) {
    return ctx.reply(
      "❌ Product not found. Use /products to see available products."
    );
  }

  // Store product selection and start address collection
  dataStorage.userAddressCollection.set(userId, {
    amount: product.price,
    currency: product.currency,
    productId: product.id,
    productName: product.name,
    step: "country",
    address: {},
  });

  console.log(
    `Starting address collection for user ${userId}, product: ${product.name}`
  );

  ctx.reply(
    `🛒 **Product Selected:**\n\n` +
      `📝 **Name:** ${product.name}\n` +
      `💰 **Price:** ${product.price} ${product.currency}\n` +
      `📄 **Description:** ${product.description}\n\n` +
      `📍 **Please provide your billing address:**\n\n` +
      `**Step 1/6: Country**\n` +
      `Please enter your country (e.g., US, UK, CA):`
  );
}

// ============================================================================
// PAYMENT COMMANDS
// ============================================================================

export function handlePayCommand(ctx, dataStorage) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  console.log(`User ${userId} initiated direct payment with args:`, args);

  if (args.length !== 2) {
    return ctx.reply(
      "❌ Invalid format. Use: /pay <amount> <currency>\nExample: /pay 100 USD"
    );
  }

  const [amountStr, currency] = args;

  // Validate amount
  if (!validateAmount(amountStr)) {
    return ctx.reply(ERROR_MESSAGES.INVALID_AMOUNT);
  }

  // Validate currency
  if (!validateCurrency(currency)) {
    return ctx.reply(ERROR_MESSAGES.UNSUPPORTED_CURRENCY);
  }

  const amount = parseFloat(amountStr);
  const currencyUpper = currency.toUpperCase();

  // Store payment info and start address collection
  dataStorage.userAddressCollection.set(userId, {
    amount,
    currency: currencyUpper,
    step: "country",
    address: {},
  });

  console.log(
    `Starting address collection for user ${userId}, amount: ${amount} ${currencyUpper}`
  );

  ctx.reply(
    `💳 **Direct Payment:** ${amount} ${currencyUpper}\n\n` +
      `📍 **Please provide your billing address:**\n\n` +
      `**Step 1/6: Country**\n` +
      `Please enter your country (e.g., US, UK, CA):`
  );
}

export function handleStatusCommand(ctx, dataStorage) {
  const userId = ctx.from.id;
  const session = dataStorage.userSessions.get(userId);

  console.log(`User ${userId} checked status`);

  if (!session) {
    return ctx.reply(
      "📋 No active payment sessions found.\n" +
        "Use /pay <amount> <currency> or /buy <product_id> to create a new payment."
    );
  }

  const message = formatPaymentStatusMessage(session);
  ctx.reply(message);
}

export function handleRefreshStatusCommand(ctx, dataStorage) {
  const userId = ctx.from.id;
  const session = dataStorage.userSessions.get(userId);

  console.log(`User ${userId} requested status refresh`);

  if (!session) {
    return ctx.reply(
      "📋 No active payment sessions found.\n" +
        "Use /pay <amount> <currency> or /buy <product_id> to create a new payment."
    );
  }

  // Show current status with webhook info
  const message =
    formatPaymentStatusMessage(session) +
    "\n\n🔄 **Status Updates:**\n" +
    "• Status updates automatically via webhooks\n" +
    "• If payment completed but shows pending, webhook may be delayed\n" +
    "• You can check payment status directly on Ragapay checkout page\n\n" +
    "💡 **Note:** Payment status should update within a few minutes of completion.";

  ctx.reply(message);
}

export function handleCancelCommand(ctx, dataStorage) {
  const userId = ctx.from.id;

  if (dataStorage.userAddressCollection.has(userId)) {
    dataStorage.userAddressCollection.delete(userId);
    ctx.reply(
      "❌ Address collection cancelled.\n\n" +
        "Use /pay <amount> <currency> or /buy <product_id> to start a new payment."
    );
  } else {
    ctx.reply(
      "ℹ️ No active processes to cancel.\n\n" +
        "Use /pay <amount> <currency> or /buy <product_id> to start a payment."
    );
  }
}

// ============================================================================
// HELP COMMANDS
// ============================================================================

export function handleStartCommand(ctx, adminManager) {
  console.log(`User ${ctx.from.id} started the bot`);
  const userId = ctx.from.id;

  let welcomeMessage = `🤖 Welcome to the Payment Bot!\n\n`;

  if (adminManager.isMasterAdmin(userId)) {
    welcomeMessage += `👑 **Master Admin Access**\n\n`;
  } else if (adminManager.isAdmin(userId)) {
    welcomeMessage += `🔧 **Admin Access**\n\n`;
  }

  welcomeMessage +=
    `I can help you process payments securely using Ragapay.\n\n` +
    `Available commands:\n` +
    `• /help - Show help message\n` +
    `• /products - View available products\n` +
    `• /buy <product_id> - Buy a product\n` +
    `• /pay <amount> <currency> - Direct payment\n` +
    `• /status - Check payment status\n` +
    `• /refresh - Refresh payment status\n` +
    `• /cancel - Cancel current process\n\n`;

  if (adminManager.isAdmin(userId)) {
    welcomeMessage +=
      `**Admin Commands:**\n` +
      `• /addproduct - Add new product\n` +
      `• /deleteproduct <id> - Delete product\n` +
      `• /listproducts - List all products\n\n`;
  }

  if (adminManager.isMasterAdmin(userId)) {
    welcomeMessage +=
      `**Master Admin Commands:**\n` +
      `• /addadmin <user_id> - Add admin\n` +
      `• /removeadmin <user_id> - Remove admin\n` +
      `• /listadmins - List all admins\n\n`;
  }

  welcomeMessage +=
    `Example: /buy 1 or /pay 100 USD\n\n` +
    `💡 **Payment Process:**\n` +
    `1. Choose product or direct payment\n` +
    `2. Provide billing address (6 steps)\n` +
    `3. Complete payment on checkout page`;

  ctx.reply(welcomeMessage);
}

export function handleHelpCommand(ctx, adminManager) {
  console.log(`User ${ctx.from.id} requested help`);
  const userId = ctx.from.id;

  let helpMessage =
    `📖 Payment Bot Help\n\n` +
    `**User Commands:**\n` +
    `• /start - Welcome message\n` +
    `• /help - Show this help\n` +
    `• /products - View available products\n` +
    `• /buy <product_id> - Buy a product\n` +
    `• /pay <amount> <currency> - Direct payment\n` +
    `• /status - Check payment status\n` +
    `• /refresh - Refresh payment status\n` +
    `• /cancel - Cancel current process\n\n` +
    `Supported currencies: USD, EUR, GBP, INR\n` +
    `Amount range: 1 to 1,000,000\n\n` +
    `Examples:\n` +
    `• /buy 1\n` +
    `• /pay 50 USD\n\n`;

  if (adminManager.isAdmin(userId)) {
    helpMessage +=
      `**Admin Commands:**\n` +
      `• /addproduct - Add new product\n` +
      `• /deleteproduct <id> - Delete product\n` +
      `• /listproducts - List all products\n\n`;
  }

  if (adminManager.isMasterAdmin(userId)) {
    helpMessage +=
      `**Master Admin Commands:**\n` +
      `• /addadmin <user_id> - Add admin\n` +
      `• /removeadmin <user_id> - Remove admin\n` +
      `• /listadmins - List all admins\n\n`;
  }

  helpMessage +=
    `💡 **Payment Process:**\n` +
    `1. Choose product or direct payment\n` +
    `2. Provide billing address (6 steps)\n` +
    `3. Complete payment on checkout page`;

  ctx.reply(helpMessage);
}
