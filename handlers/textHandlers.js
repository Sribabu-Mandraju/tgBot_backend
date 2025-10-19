// ============================================================================
// TEXT MESSAGE HANDLERS
// ============================================================================

import {
  validateAddressField,
  validatePhone,
  validateZip,
  validateAmount,
  validateCurrency,
} from "../utils.js";
import { createPaymentSession } from "../ragapay.js";
import { ADDRESS_STEPS, PRODUCT_STEPS, SUCCESS_MESSAGES } from "../config.js";

// ============================================================================
// ADDRESS COLLECTION HANDLER
// ============================================================================

export function handleAddressCollection(
  ctx,
  userId,
  text,
  addressData,
  dataStorage
) {
  const { step, address } = addressData;

  switch (step) {
    case ADDRESS_STEPS.COUNTRY:
      const countryError = validateAddressField(text, "Country");
      if (countryError) {
        return ctx.reply(`❌ ${countryError}\n\nPlease enter your country:`);
      }
      address.country = text.trim();
      addressData.step = ADDRESS_STEPS.STATE;
      ctx.reply(
        `✅ Country: ${address.country}\n\n` +
          `**Step 2/6: State/Province**\n` +
          `Please enter your state or province:`
      );
      break;

    case ADDRESS_STEPS.STATE:
      const stateError = validateAddressField(text, "State/Province");
      if (stateError) {
        return ctx.reply(
          `❌ ${stateError}\n\nPlease enter your state or province:`
        );
      }
      address.state = text.trim();
      addressData.step = ADDRESS_STEPS.CITY;
      ctx.reply(
        `✅ State: ${address.state}\n\n` +
          `**Step 3/6: City**\n` +
          `Please enter your city:`
      );
      break;

    case ADDRESS_STEPS.CITY:
      const cityError = validateAddressField(text, "City");
      if (cityError) {
        return ctx.reply(`❌ ${cityError}\n\nPlease enter your city:`);
      }
      address.city = text.trim();
      addressData.step = ADDRESS_STEPS.ADDRESS;
      ctx.reply(
        `✅ City: ${address.city}\n\n` +
          `**Step 4/6: Street Address**\n` +
          `Please enter your street address:`
      );
      break;

    case ADDRESS_STEPS.ADDRESS:
      const addressError = validateAddressField(text, "Street address");
      if (addressError) {
        return ctx.reply(
          `❌ ${addressError}\n\nPlease enter your street address:`
        );
      }
      address.address = text.trim();
      addressData.step = ADDRESS_STEPS.ZIP;
      ctx.reply(
        `✅ Address: ${address.address}\n\n` +
          `**Step 5/6: ZIP/Postal Code**\n` +
          `Please enter your ZIP or postal code:`
      );
      break;

    case ADDRESS_STEPS.ZIP:
      const zipError = validateZip(text);
      if (zipError) {
        return ctx.reply(
          `❌ ${zipError}\n\nPlease enter your ZIP or postal code:`
        );
      }
      address.zip = text.trim();
      addressData.step = ADDRESS_STEPS.PHONE;
      ctx.reply(
        `✅ ZIP: ${address.zip}\n\n` +
          `**Step 6/6: Phone Number**\n` +
          `Please enter your phone number (e.g., +1234567890):`
      );
      break;

    case ADDRESS_STEPS.PHONE:
      const phoneError = validatePhone(text);
      if (phoneError) {
        return ctx.reply(`❌ ${phoneError}\n\nPlease enter your phone number:`);
      }
      address.phone = text.trim();

      // Address collection complete, create payment session
      console.log(`Address collection completed for user ${userId}:`, address);
      createPaymentSession(ctx, userId, addressData, dataStorage);
      break;

    default:
      ctx.reply(
        "❌ Invalid step. Please start over with /pay or /buy command."
      );
  }
}

// ============================================================================
// PRODUCT CREATION HANDLER
// ============================================================================

export async function handleProductCreation(
  ctx,
  userId,
  text,
  productData,
  productManager,
  dataStorage
) {
  const { step } = productData;

  try {
    switch (step) {
      case PRODUCT_STEPS.NAME:
        if (!text || text.trim().length < 2) {
          return ctx.reply(
            "❌ Product name must be at least 2 characters long.\n\nPlease enter the product name:"
          );
        }
        productData.productData.name = text.trim();
        productData.step = PRODUCT_STEPS.DESCRIPTION;
        ctx.reply(
          `✅ Name: ${productData.productData.name}\n\n` +
            `**Step 2/4: Description**\n` +
            `Please enter the product description:`
        );
        break;

      case PRODUCT_STEPS.DESCRIPTION:
        if (!text || text.trim().length < 5) {
          return ctx.reply(
            "❌ Description must be at least 5 characters long.\n\nPlease enter the product description:"
          );
        }
        productData.productData.description = text.trim();
        productData.step = PRODUCT_STEPS.PRICE;
        ctx.reply(
          `✅ Description: ${productData.productData.description}\n\n` +
            `**Step 3/4: Price**\n` +
            `Please enter the product price (e.g., 99.99):`
        );
        break;

      case PRODUCT_STEPS.PRICE:
        if (!validateAmount(text)) {
          return ctx.reply(
            "❌ Invalid price. Please enter a valid number between 1 and 1,000,000.\n\nPlease enter the product price:"
          );
        }
        productData.productData.price = parseFloat(text);
        productData.step = PRODUCT_STEPS.CURRENCY;
        ctx.reply(
          `✅ Price: ${productData.productData.price}\n\n` +
            `**Step 4/4: Currency**\n` +
            `Please enter the currency (USD, EUR, GBP, INR):`
        );
        break;

      case PRODUCT_STEPS.CURRENCY:
        if (!validateCurrency(text)) {
          return ctx.reply(
            "❌ Unsupported currency. Supported: USD, EUR, GBP, INR\n\nPlease enter the currency:"
          );
        }
        productData.productData.currency = text.toUpperCase();

        // Product creation complete
        const productId = await productManager.createProduct(
          productData.productData.name,
          productData.productData.description,
          productData.productData.price,
          productData.productData.currency,
          userId
        );

        console.log(`Product created by user ${userId}:`, {
          id: productId,
          ...productData.productData,
        });

        // Clear product creation data
        dataStorage.userProductSelection.delete(userId);

        ctx.reply(
          `✅ **Product Created Successfully!**\n\n` +
            `🆔 **ID:** ${productId}\n` +
            `📝 **Name:** ${productData.productData.name}\n` +
            `💰 **Price:** ${productData.productData.price} ${productData.productData.currency}\n` +
            `📄 **Description:** ${productData.productData.description}\n\n` +
            `Users can now buy this product using: /buy ${productData.productData.name}`
        );
        break;

      default:
        ctx.reply(
          "❌ Invalid step. Please start over with /addproduct command."
        );
    }
  } catch (error) {
    console.error("Error in product creation:", error);
    ctx.reply("❌ Failed to create product. Please try again later.");
  }
}

// ============================================================================
// PRODUCT MODIFICATION HANDLER
// ============================================================================

export async function handleProductModification(
  ctx,
  userId,
  text,
  modificationData,
  productManager,
  dataStorage
) {
  const { step, modifications, productId, productName } = modificationData;

  try {
    switch (step) {
      case "field":
        const fieldChoice = text.toLowerCase().trim();

        if (fieldChoice === "done") {
          // Apply modifications
          if (Object.keys(modifications).length === 0) {
            dataStorage.userProductModification.delete(userId);
            return ctx.reply(
              "❌ No modifications made. Product modification cancelled."
            );
          }

          const updatedProduct = await productManager.modifyProduct(
            productId,
            modifications
          );

          // Clear modification data
          dataStorage.userProductModification.delete(userId);

          ctx.reply(
            `✅ **Product Modified Successfully!**\n\n` +
              `📝 **Name:** ${updatedProduct.title}\n` +
              `💰 **Price:** ${updatedProduct.amount} ${updatedProduct.currency}\n` +
              `📄 **Description:** ${updatedProduct.description}\n\n` +
              `🕒 **Last Updated:** ${new Date(
                updatedProduct.updatedAt
              ).toLocaleString()}`
          );
          break;
        }

        if (
          !["name", "description", "price", "currency"].includes(fieldChoice)
        ) {
          return ctx.reply(
            "❌ Invalid choice. Please type one of: name, description, price, currency, or done"
          );
        }

        modificationData.step = fieldChoice;
        modificationData.currentField = fieldChoice;

        let prompt = "";
        switch (fieldChoice) {
          case "name":
            prompt = "Please enter the new product name:";
            break;
          case "description":
            prompt = "Please enter the new product description:";
            break;
          case "price":
            prompt = "Please enter the new product price (e.g., 99.99):";
            break;
          case "currency":
            prompt = "Please enter the new currency (USD, EUR, GBP, INR):";
            break;
        }

        ctx.reply(
          `✅ Field selected: ${fieldChoice}\n\n` +
            `**Step:** Enter new ${fieldChoice}\n` +
            prompt
        );
        break;

      case "name":
        if (text.trim().length < 2) {
          return ctx.reply(
            "❌ Product name must be at least 2 characters long.\n\nPlease enter the new product name:"
          );
        }
        modifications.title = text.trim();
        modificationData.step = "field";
        ctx.reply(
          `✅ New name: ${modifications.title}\n\n` +
            `**What would you like to modify next?**\n` +
            `• Type "name" to change the product name\n` +
            `• Type "description" to change the description\n` +
            `• Type "price" to change the price\n` +
            `• Type "currency" to change the currency\n` +
            `• Type "done" when finished`
        );
        break;

      case "description":
        if (text.trim().length < 5) {
          return ctx.reply(
            "❌ Description must be at least 5 characters long.\n\nPlease enter the new product description:"
          );
        }
        modifications.description = text.trim();
        modificationData.step = "field";
        ctx.reply(
          `✅ New description: ${modifications.description}\n\n` +
            `**What would you like to modify next?**\n` +
            `• Type "name" to change the product name\n` +
            `• Type "description" to change the description\n` +
            `• Type "price" to change the price\n` +
            `• Type "currency" to change the currency\n` +
            `• Type "done" when finished`
        );
        break;

      case "price":
        if (!validateAmount(text)) {
          return ctx.reply(
            "❌ Invalid price. Please enter a valid number between 1 and 1,000,000.\n\nPlease enter the new product price:"
          );
        }
        modifications.amount = parseFloat(text);
        modificationData.step = "field";
        ctx.reply(
          `✅ New price: ${modifications.amount}\n\n` +
            `**What would you like to modify next?**\n` +
            `• Type "name" to change the product name\n` +
            `• Type "description" to change the description\n` +
            `• Type "price" to change the price\n` +
            `• Type "currency" to change the currency\n` +
            `• Type "done" when finished`
        );
        break;

      case "currency":
        if (!validateCurrency(text)) {
          return ctx.reply(
            "❌ Unsupported currency. Supported: USD, EUR, GBP, INR\n\nPlease enter the new currency:"
          );
        }
        modifications.currency = text.toUpperCase();
        modificationData.step = "field";
        ctx.reply(
          `✅ New currency: ${modifications.currency}\n\n` +
            `**What would you like to modify next?**\n` +
            `• Type "name" to change the product name\n` +
            `• Type "description" to change the description\n` +
            `• Type "price" to change the price\n` +
            `• Type "currency" to change the currency\n` +
            `• Type "done" when finished`
        );
        break;

      default:
        ctx.reply(
          "❌ Invalid step. Please start over with /modifyproduct command."
        );
    }
  } catch (error) {
    console.error("Error in product modification:", error);
    ctx.reply("❌ Failed to modify product. Please try again later.");
  }
}
