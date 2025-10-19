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

export async function handleProductsCommand(ctx, productManager) {
  console.log(`User ${ctx.from.id} requested products list`);

  try {
    const productList = await productManager.getAllProducts();
    const message = formatProductListMessage(productList);
    ctx.reply(message);
  } catch (error) {
    console.error("Error getting products:", error);
    ctx.reply("❌ Failed to load products. Please try again later.");
  }
}

export async function handleModifyProductCommand(
  ctx,
  productManager,
  dataStorage,
  adminManager
) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  console.log(`User ${userId} initiated product modification with args:`, args);

  if (args.length === 0) {
    return ctx.reply(
      "❌ Invalid format. Use: /modifyproduct <product_name>\nExample: /modifyproduct Premium Plan\n\nUse /products to see available products."
    );
  }

  // Join all arguments to handle product names with spaces
  const productName = args.join(" ");

  try {
    // Find product by name (case-insensitive)
    const products = await productManager.getAllProducts();
    const product = products.find(
      (p) => p.title.toLowerCase() === productName.toLowerCase()
    );

    if (!product) {
      return ctx.reply(
        `❌ Product "${productName}" not found.\n\n` +
          `Use /products to see available products.\n` +
          `Note: Product names are case-insensitive.`
      );
    }

    // Check if user can modify this product
    const isMasterAdmin = await adminManager.isMasterAdmin(userId);
    const isProductCreator = product.createdBy === userId.toString();

    if (!isMasterAdmin && !isProductCreator) {
      return ctx.reply(
        `❌ **Access Denied**\n\n` +
          `You can only modify products you created or be a master admin.\n\n` +
          `📝 **Product Creator:** ${product.createdBy}\n` +
          `🆔 **Your ID:** ${userId}\n` +
          `👑 **Master Admin:** ${isMasterAdmin ? "Yes" : "No"}\n\n` +
          `Contact the master admin if you need to modify this product.`
      );
    }

    // Store product modification data
    dataStorage.userProductModification.set(userId, {
      productId: product._id,
      productName: product.title,
      step: "field",
      modifications: {},
    });

    console.log(
      `Starting product modification for user ${userId}, product: ${product.title}`
    );

    ctx.reply(
      `🔧 **Modify Product:**\n\n` +
        `📝 **Current Name:** ${product.title}\n` +
        `💰 **Current Price:** ${product.amount} ${product.currency}\n` +
        `📄 **Current Description:** ${product.description}\n\n` +
        `**What would you like to modify?**\n` +
        `• Type "name" to change the product name\n` +
        `• Type "description" to change the description\n` +
        `• Type "price" to change the price\n` +
        `• Type "currency" to change the currency\n` +
        `• Type "done" when finished\n\n` +
        `**Current Step:** Choose field to modify`
    );
  } catch (error) {
    console.error("Error processing modify command:", error);
    ctx.reply("❌ Failed to process modification. Please try again later.");
  }
}

export async function handleBuyCommand(ctx, productManager, dataStorage) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  console.log(`User ${userId} initiated product purchase with args:`, args);

  if (args.length === 0) {
    return ctx.reply(
      "❌ Invalid format. Use: /buy <product_name>\nExample: /buy Premium Plan\n\nUse /products to see available products."
    );
  }

  // Join all arguments to handle product names with spaces
  const productName = args.join(" ");

  try {
    // Find product by name (case-insensitive)
    const products = await productManager.getAllProducts();
    const product = products.find(
      (p) => p.title.toLowerCase() === productName.toLowerCase()
    );

    if (!product) {
      return ctx.reply(
        `❌ Product "${productName}" not found.\n\n` +
          `Use /products to see available products.\n` +
          `Note: Product names are case-insensitive.`
      );
    }

    // Store product selection and start address collection
    dataStorage.userAddressCollection.set(userId, {
      amount: product.amount,
      currency: product.currency,
      productId: product._id,
      productName: product.title,
      productDescription: product.description,
      step: "country",
      address: {},
    });

    console.log(
      `Starting address collection for user ${userId}, product: ${product.title}`
    );

    ctx.reply(
      `🛒 **Product Selected:**\n\n` +
        `📝 **Name:** ${product.title}\n` +
        `💰 **Price:** ${product.amount} ${product.currency}\n` +
        `📄 **Description:** ${product.description}\n\n` +
        `📍 **Please provide your billing address:**\n\n` +
        `**Step 1/6: Country**\n` +
        `Please enter your country (e.g., US, UK, CA):`
    );
  } catch (error) {
    console.error("Error processing buy command:", error);
    ctx.reply("❌ Failed to process purchase. Please try again later.");
  }
}

// ============================================================================
// PAYMENT COMMANDS
// ============================================================================

export async function handlePayCommand(ctx, dataStorage) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  console.log(`User ${userId} initiated direct payment with args:`, args);

  if (args.length < 2) {
    return ctx.reply(
      "❌ Invalid format. Use: /pay <amount> <currency> [description]\n" +
        "Examples:\n" +
        "• /pay 100 USD\n" +
        '• /pay 50 EUR "Website development services"\n' +
        '• /pay 25 GBP "Consulting fee"'
    );
  }

  const [amountStr, currency, ...descriptionParts] = args;
  const description =
    descriptionParts.length > 0 ? descriptionParts.join(" ") : null;

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
    description: description,
    step: "country",
    address: {},
  });

  console.log(
    `Starting address collection for user ${userId}, amount: ${amount} ${currencyUpper}${
      description ? `, description: "${description}"` : ""
    }`
  );

  const message =
    `💳 **Direct Payment:** ${amount} ${currencyUpper}\n` +
    (description ? `📝 **Description:** ${description}\n` : "") +
    `\n📍 **Please provide your billing address:**\n\n` +
    `**Step 1/6: Country**\n` +
    `Please enter your country (e.g., US, UK, CA):`;

  ctx.reply(message);
}

export async function handleStatusCommand(ctx, dataStorage) {
  const userId = ctx.from.id;

  console.log(`User ${userId} checked status`);

  try {
    const session = dataStorage.userSessions.get(userId);

    if (!session) {
      return ctx.reply(
        "📋 No active payment sessions found.\n" +
          "Use /pay <amount> <currency> or /buy <product_name> to create a new payment."
      );
    }

    const message = formatPaymentStatusMessage(session);
    ctx.reply(message);
  } catch (error) {
    console.error("Error checking status:", error);
    ctx.reply("❌ Failed to check status. Please try again later.");
  }
}

export async function handleRefreshStatusCommand(ctx, dataStorage) {
  const userId = ctx.from.id;

  console.log(`User ${userId} requested status refresh`);

  try {
    const session = dataStorage.userSessions.get(userId);

    if (!session) {
      return ctx.reply(
        "📋 No active payment sessions found.\n" +
          "Use /pay <amount> <currency> or /buy <product_name> to create a new payment."
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
  } catch (error) {
    console.error("Error refreshing status:", error);
    ctx.reply("❌ Failed to refresh status. Please try again later.");
  }
}

export function handleCancelCommand(ctx, dataStorage) {
  const userId = ctx.from.id;

  // Check for any active processes to cancel
  let cancelled = false;
  let message = "ℹ️ No active processes to cancel.\n\n";

  if (dataStorage.userAddressCollection.has(userId)) {
    dataStorage.userAddressCollection.delete(userId);
    cancelled = true;
    message = "❌ Address collection cancelled.\n\n";
  }

  if (dataStorage.userProductSelection.has(userId)) {
    dataStorage.userProductSelection.delete(userId);
    cancelled = true;
    message = "❌ Product creation cancelled.\n\n";
  }

  if (dataStorage.userProductModification.has(userId)) {
    dataStorage.userProductModification.delete(userId);
    cancelled = true;
    message = "❌ Product modification cancelled.\n\n";
  }

  message +=
    "Use /pay <amount> <currency> or /buy <product_name> to start a new payment.";
  ctx.reply(message);
}

// ============================================================================
// HELP COMMANDS
// ============================================================================

export async function handleStartCommand(ctx, adminManager) {
  console.log(`User ${ctx.from.id} started the bot`);
  const userId = ctx.from.id;

  try {
    let welcomeMessage = `🤖 Welcome to the Payment Bot!\n\n`;

    const isMasterAdmin = await adminManager.isMasterAdmin(userId);
    const isAdmin = await adminManager.isAdmin(userId);

    if (isMasterAdmin) {
      welcomeMessage += `👑 **Master Admin Access**\n\n`;
    } else if (isAdmin) {
      welcomeMessage += `🔧 **Admin Access**\n\n`;
    }

    welcomeMessage +=
      `I can help you process payments securely using Ragapay.\n\n` +
      `Available commands:\n` +
      `• /help - Show help message\n` +
      `• /products - View available products\n` +
      `• /buy <product_name> - Buy a product by name\n` +
      `• /pay <amount> <currency> [description] - Direct payment\n` +
      `• /status - Check payment status\n` +
      `• /refresh - Refresh payment status\n` +
      `• /cancel - Cancel current process\n\n`;

    if (isAdmin) {
      welcomeMessage +=
        `**Admin Commands:**\n` +
        `• /addproduct - Add new product\n` +
        `• /modifyproduct <product_name> - Modify product name, description, or price\n` +
        `• /deleteproduct <product_name> - Delete product by name\n` +
        `• /listproducts - List all products\n\n`;
    }

    if (isMasterAdmin) {
      welcomeMessage +=
        `**Master Admin Commands:**\n` +
        `• /addadmin <user_id> - Add admin\n` +
        `• /removeadmin <user_id> - Remove admin\n` +
        `• /listadmins - List all admins\n\n`;
    }

    welcomeMessage +=
      `Examples: /buy Premium Plan or /pay 100 USD "Service fee"\n\n` +
      `💡 **Payment Process:**\n` +
      `1. Choose product or direct payment\n` +
      `2. Provide billing address (6 steps)\n` +
      `3. Complete payment on checkout page\n\n` +
      `📝 **Note:** Product names are case-insensitive!`;

    ctx.reply(welcomeMessage);
  } catch (error) {
    console.error("Error in start command:", error);
    ctx.reply("❌ Failed to load welcome message. Please try again later.");
  }
}

export async function handleHelpCommand(ctx, adminManager) {
  console.log(`User ${ctx.from.id} requested help`);
  const userId = ctx.from.id;

  try {
    const isMasterAdmin = await adminManager.isMasterAdmin(userId);
    const isAdmin = await adminManager.isAdmin(userId);

    let helpMessage =
      `📖 Payment Bot Help\n\n` +
      `**User Commands:**\n` +
      `• /start - Welcome message\n` +
      `• /help - Show this help\n` +
      `• /products - View available products\n` +
      `• /buy <product_name> - Buy a product by name\n` +
      `• /pay <amount> <currency> [description] - Direct payment\n` +
      `• /status - Check payment status\n` +
      `• /refresh - Refresh payment status\n` +
      `• /cancel - Cancel current process\n\n` +
      `Supported currencies: USD, EUR, GBP, INR\n` +
      `Amount range: 1 to 1,000,000\n\n` +
      `Examples:\n` +
      `• /buy Premium Plan\n` +
      `• /buy Basic Package\n` +
      `• /pay 50 USD\n` +
      `• /pay 25 EUR "Consulting fee"\n\n` +
      `📝 **Note:** Product names are case-insensitive!`;

    if (isAdmin) {
      helpMessage +=
        `**Admin Commands:**\n` +
        `• /addproduct - Add new product\n` +
        `• /modifyproduct <product_name> - Modify product name, description, or price\n` +
        `• /deleteproduct <product_name> - Delete product by name\n` +
        `• /listproducts - List all products\n\n`;
    }

    if (isMasterAdmin) {
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
  } catch (error) {
    console.error("Error in help command:", error);
    ctx.reply("❌ Failed to load help message. Please try again later.");
  }
}
