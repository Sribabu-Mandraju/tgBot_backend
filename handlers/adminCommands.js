// ============================================================================
// ADMIN COMMAND HANDLERS
// ============================================================================

import {
  validateCurrency,
  formatAdminProductListMessage,
  formatAdminListMessage,
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

export async function handleDeleteProductCommand(ctx, productManager) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length === 0) {
    return ctx.reply(
      '❌ Invalid format. Use: /deleteproduct <product_name>\nExample: /deleteproduct "Premium Plan"\n\nUse /listproducts to see available products.'
    );
  }

  // Join all arguments to handle product names with spaces
  const productName = args.join(" ");

  try {
    // Find product by name (case-sensitive)
    const products = await productManager.getAllProducts();
    const product = products.find((p) => p.title === productName);

    if (!product) {
      return ctx.reply(
        `❌ Product "${productName}" not found.\n\n` +
          `Use /listproducts to see available products.\n` +
          `Note: Product names are case-sensitive.`
      );
    }

    await productManager.deleteProduct(product._id);
    ctx.reply(
      `✅ **Product Deleted Successfully!**\n\n` +
        `📝 **Name:** ${product.title}\n` +
        `💰 **Price:** ${product.amount} ${product.currency}\n` +
        `📄 **Description:** ${product.description}`
    );
  } catch (error) {
    console.error("Error deleting product:", error);
    ctx.reply("❌ Failed to delete product. Please try again later.");
  }
}

export async function handleListProductsCommand(ctx, productManager) {
  const userId = ctx.from.id;

  try {
    const productList = await productManager.getAllProductsForAdmin();
    const message = formatAdminProductListMessage(productList);

    ctx.reply(message);
  } catch (error) {
    console.error("Error listing products:", error);
    ctx.reply("❌ Failed to list products. Please try again later.");
  }
}

// ============================================================================
// MASTER ADMIN COMMANDS
// ============================================================================

export async function handleAddAdminCommand(ctx, adminManager) {
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

  try {
    await adminManager.addAdmin(newAdminId, "Admin User");
    ctx.reply(`✅ User ${newAdminId} has been added as an admin.`);
  } catch (error) {
    if (error.message === "Admin already exists") {
      ctx.reply(`❌ User ${newAdminId} is already an admin.`);
    } else {
      console.error("Error adding admin:", error);
      ctx.reply("❌ Failed to add admin. Please try again later.");
    }
  }
}

export async function handleRemoveAdminCommand(ctx, adminManager) {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(" ").slice(1);

  if (args.length !== 1) {
    return ctx.reply("❌ Invalid format. Use: /removeadmin <user_id>");
  }

  const adminId = args[0];

  try {
    await adminManager.removeAdmin(adminId);
    ctx.reply(`✅ User ${adminId} has been removed from admins.`);
  } catch (error) {
    if (error.message === "Cannot remove master admin") {
      ctx.reply("❌ Cannot remove master admin.");
    } else if (error.message === "Admin not found") {
      ctx.reply(`❌ User ${adminId} is not an admin.`);
    } else {
      console.error("Error removing admin:", error);
      ctx.reply("❌ Failed to remove admin. Please try again later.");
    }
  }
}

export async function handleListAdminsCommand(ctx, adminManager) {
  const userId = ctx.from.id;

  try {
    const adminList = await adminManager.getAllAdmins();
    const masterAdminId = await adminManager.getMasterAdminId();
    const message = formatAdminListMessage(adminList, masterAdminId);

    ctx.reply(message);
  } catch (error) {
    console.error("Error listing admins:", error);
    ctx.reply("❌ Failed to list admins. Please try again later.");
  }
}

// ============================================================================
// ADMIN ACCESS CONTROL
// ============================================================================

export function requireAdminAccess(handler, adminManager) {
  return async (ctx, ...args) => {
    const userId = ctx.from.id;

    try {
      const isAdmin = await adminManager.isAdmin(userId);
      if (!isAdmin) {
        return ctx.reply(ERROR_MESSAGES.ACCESS_DENIED);
      }

      return await handler(ctx, ...args);
    } catch (error) {
      console.error("Error checking admin access:", error);
      return ctx.reply(
        "❌ Error checking admin privileges. Please try again later."
      );
    }
  };
}

export function requireMasterAdminAccess(handler, adminManager) {
  return async (ctx, ...args) => {
    const userId = ctx.from.id;

    try {
      const isMasterAdmin = await adminManager.isMasterAdmin(userId);
      if (!isMasterAdmin) {
        return ctx.reply(ERROR_MESSAGES.MASTER_ACCESS_DENIED);
      }

      return await handler(ctx, ...args);
    } catch (error) {
      console.error("Error checking master admin access:", error);
      return ctx.reply(
        "❌ Error checking master admin privileges. Please try again later."
      );
    }
  };
}
