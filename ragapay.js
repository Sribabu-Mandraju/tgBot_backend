// ============================================================================
// RAGAPAY PAYMENT INTEGRATION
// ============================================================================

import axios from "axios";
import CryptoJS from "crypto-js";
import { RAGAPAY_CONFIG, SERVER_CONFIG } from "./config.js";

// ============================================================================
// SIGNATURE GENERATION
// ============================================================================

export function generateSignature(payload) {
  try {
    if (!RAGAPAY_CONFIG.password) {
      throw new Error("Ragapay password is not configured");
    }

    // According to official docs: sha1(md5(strtoupper(order.number + order.amount + order.currency + order.description + PASSWORD)))
    const to_md5 =
      payload.order.number +
      payload.order.amount +
      payload.order.currency +
      payload.order.description +
      RAGAPAY_CONFIG.password;

    console.log("Signature input string:", to_md5);
    const upperString = to_md5.toUpperCase();
    console.log("Uppercase string:", upperString);
    const md5Hash = CryptoJS.MD5(upperString);
    console.log("MD5 hash:", md5Hash.toString(CryptoJS.enc.Hex));
    const sha1Hash = CryptoJS.SHA1(md5Hash.toString());
    const signature = CryptoJS.enc.Hex.stringify(sha1Hash);
    console.log("Final signature:", signature);

    return signature;
  } catch (error) {
    console.error("Signature generation error:", error);
    throw new Error(`Signature generation failed: ${error.message}`);
  }
}

// ============================================================================
// PAYMENT SESSION CREATION
// ============================================================================

export async function createPaymentSession(
  ctx,
  userId,
  paymentData,
  dataStorage
) {
  try {
    const { amount, currency, address, productId, productName } = paymentData;

    // Create payment session
    const orderNumber = `TG_${userId}_${Date.now()}`;
    const description = productName
      ? `Product: ${productName}`
      : `Telegram Payment - ${amount} ${currency}`;

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
        currency: currency,
        description: description,
      },
      cancel_url: `${SERVER_CONFIG.BASE_URL}/payment/cancel`,
      success_url: `${SERVER_CONFIG.BASE_URL}/payment/success`,
      customer: {
        name: ctx.from.first_name || "Telegram User",
        email: `user${userId}@telegram.com`,
      },
      billing_address: {
        country: address.country,
        state: address.state,
        city: address.city,
        address: address.address,
        zip: address.zip,
        phone: address.phone,
      },
      parameters: {
        telegram_user_id: userId,
        telegram_chat_id: ctx.chat.id,
        product_id: productId || null,
      },
      hash: "",
    };

    // Generate hash using correct Ragapay format
    payload.hash = generateSignature(payload);

    console.log(
      `Creating payment session for user ${userId}, order: ${orderNumber}`
    );
    console.log("Full payload being sent:", JSON.stringify(payload, null, 2));

    const response = await axios.post(RAGAPAY_CONFIG.endpoint, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    console.log(
      "Ragapay API Response:",
      JSON.stringify(response.data, null, 2)
    );

    // Check if response has the expected structure
    if (!response.data) {
      throw new Error("No response data received from Ragapay");
    }

    // Try different possible field names for checkout URL
    const checkoutUrl =
      response.data.checkout_url ||
      response.data.url ||
      response.data.redirect_url ||
      response.data.payment_url;

    if (!checkoutUrl) {
      console.error(
        "No checkout URL found in response. Available fields:",
        Object.keys(response.data)
      );
      throw new Error("No checkout URL received from Ragapay");
    }

    // Store session info
    dataStorage.userSessions.set(userId, {
      orderNumber,
      amount,
      currency: currency,
      status: "pending",
      checkoutUrl: checkoutUrl,
      productId: productId || null,
      productName: productName || null,
      createdAt: new Date(),
    });

    console.log(`Payment session created for user ${userId}: ${checkoutUrl}`);

    // Clear address collection data
    dataStorage.userAddressCollection.delete(userId);

    const message =
      `💳 **Payment Session Created!**\n\n` +
      `Amount: ${amount} ${currency}\n` +
      `Order: ${orderNumber}\n\n` +
      `📍 **Billing Address:**\n` +
      `${address.address}, ${address.city}\n` +
      `${address.state} ${address.zip}, ${address.country}\n` +
      `📞 ${address.phone}\n\n` +
      `🔗 **Click the link below to complete your payment:**\n` +
      `${checkoutUrl}\n\n` +
      `Use /status to check your payment status.`;

    ctx.reply(message);
  } catch (error) {
    console.error(
      `Payment creation failed for user ${userId}:`,
      error.response?.data || error.message
    );

    // Log full error details for debugging
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response headers:", error.response.headers);
      console.error("Response data:", error.response.data);
    }

    // Clear address collection data on error
    dataStorage.userAddressCollection.delete(userId);

    ctx.reply(
      "❌ Failed to create payment session. Please try again later.\n" +
        "If the problem persists, contact support.\n\n" +
        "Start over with: /pay <amount> <currency> or /buy <product_id>"
    );
  }
}

// ============================================================================
// WEBHOOK VALIDATION
// ============================================================================

export function validateWebhookSignature(payload, signature) {
  try {
    const expectedSignature = generateSignature(payload);
    return expectedSignature === signature;
  } catch (error) {
    console.error("Webhook signature validation error:", error);
    return false;
  }
}

// ============================================================================
// PAYMENT STATUS HELPERS
// ============================================================================

export function getPaymentStatusEmoji(status) {
  const statusEmojis = {
    pending: "⏳",
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
  };
  return statusEmojis[status] || "❓";
}

export function formatPaymentStatusMessage(session) {
  let message =
    `📋 Payment Status\n\n` +
    `Order: ${session.orderNumber}\n` +
    `Amount: ${session.amount} ${session.currency}\n` +
    `Status: ${getPaymentStatusEmoji(session.status)} ${session.status}\n` +
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
