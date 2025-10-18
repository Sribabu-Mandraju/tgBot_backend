// ============================================================================
// ADMIN COMMAND HANDLERS
// ============================================================================

import {
  validateCurrency,
  formatAdminProductListMessage,
  isValidUserId,
} from "../utils.js";
import { ERROR_MESSAGES } from "../config.js";

// ============================================================================
// PRODUCT MANAGEMENT COMMANDS
// ============================================================================

export function handleAddProductCommand(ctx, dataStorage) {
  const userId = ctx.from.id;

  // Store admin in product creation mode
  dataStorage.userProductSelection.set(userId, {
    step: "name",
    productData: {},
  });

  ctx.reply(
    `🔧 **Add New Product**\n\n` +
      `**Step 1/4: Product Name**\n` +
      `Please enter the product name:`
  );
}

export function handleDeleteProductCommand(ctx, productManager) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length !== 1) {
    return ctx.reply("❌ Invalid format. Use: /deleteproduct <product_id>");
  }

  const productId = parseInt(args[0]);
  const product = productManager.getProduct(productId);

  if (!product) {
    return ctx.reply(ERROR_MESSAGES.PRODUCT_NOT_FOUND);
  }

  productManager.deleteProduct(productId);
  ctx.reply(
    `✅ Product "${product.name}" (ID: ${productId}) has been deleted.`
  );
}

export function handleListProductsCommand(ctx, productManager) {
  const userId = ctx.from.id;

  const productList = productManager.getAllProducts();
  const message = formatAdminProductListMessage(productList);

  ctx.reply(message);
}

// ============================================================================
// MASTER ADMIN COMMANDS
// ============================================================================

export function handleAddAdminCommand(ctx, adminManager) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length !== 1) {
    return ctx.reply("❌ Invalid format. Use: /addadmin <user_id>");
  }

  const newAdminId = args[0];

  if (!isValidUserId(newAdminId)) {
    return ctx.reply(
      "❌ Invalid user ID format. Please enter a valid numeric user ID."
    );
  }

  adminManager.addAdmin(newAdminId);
  ctx.reply(`✅ User ${newAdminId} has been added as an admin.`);
}

export function handleRemoveAdminCommand(ctx, adminManager) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length !== 1) {
    return ctx.reply("❌ Invalid format. Use: /removeadmin <user_id>");
  }

  const adminId = args[0];

  if (adminId === adminManager.getMasterAdminId()) {
    return ctx.reply("❌ Cannot remove master admin.");
  }

  adminManager.removeAdmin(adminId);
  ctx.reply(`✅ User ${adminId} has been removed from admins.`);
}

export function handleListAdminsCommand(ctx, adminManager) {
  const userId = ctx.from.id;

  const adminList = adminManager.getAllAdmins();
  const message = formatAdminListMessage(
    adminList,
    adminManager.getMasterAdminId()
  );

  ctx.reply(message);
}

// ============================================================================
// ADMIN ACCESS CONTROL
// ============================================================================

export function requireAdminAccess(handler, adminManager) {
  return (ctx, ...args) => {
    const userId = ctx.from.id;

    if (!adminManager.isAdmin(userId)) {
      return ctx.reply(ERROR_MESSAGES.ACCESS_DENIED);
    }

    return handler(ctx, ...args);
  };
}

export function requireMasterAdminAccess(handler, adminManager) {
  return (ctx, ...args) => {
    const userId = ctx.from.id;

    if (!adminManager.isMasterAdmin(userId)) {
      return ctx.reply(ERROR_MESSAGES.MASTER_ACCESS_DENIED);
    }

    return handler(ctx, ...args);
  };
}
