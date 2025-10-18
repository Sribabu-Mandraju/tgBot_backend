// ============================================================================
// EXPRESS ROUTES
// ============================================================================

import express from "express";
import { SERVER_CONFIG } from "./config.js";

// Helper function to format payment status messages
function getPaymentStatusMessage(session, status) {
  const statusEmojis = {
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
    pending: "⏳",
  };

  const statusEmoji = statusEmojis[status.toLowerCase()] || "❓";

  let message =
    `💳 **Payment Status Update**\n\n` +
    `Order: ${session.orderNumber}\n` +
    `Amount: ${session.amount} ${session.currency}\n` +
    `Status: ${statusEmoji} ${status.toUpperCase()}\n` +
    `Updated: ${new Date().toLocaleString()}\n\n`;

  if (session.productName) {
    message += `Product: ${session.productName}\n\n`;
  }

  if (status.toLowerCase() === "completed") {
    message += "🎉 **Payment Successful!**\nThank you for your purchase.";
  } else if (status.toLowerCase() === "failed") {
    message += "❌ **Payment Failed**\nPlease try again or contact support.";
  } else if (status.toLowerCase() === "cancelled") {
    message += "🚫 **Payment Cancelled**\nYou can start a new payment anytime.";
  }

  return message;
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

export function createRoutes(bot, dataStorage, productManager, adminManager) {
  const router = express.Router();

  // Health check endpoint
  router.get("/health", (req, res) => {
    const healthData = {
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: SERVER_CONFIG.NODE_ENV,
      bot: {
        isRunning: !!bot,
        totalUsers: dataStorage.userSessions.size,
        activeAddressCollections: dataStorage.userAddressCollection.size,
        activeProductCreations: dataStorage.userProductSelection.size,
      },
      products: {
        total: productManager.getProductCount(),
      },
      admins: {
        total: adminManager.getAllAdmins().length,
        masterAdmin: adminManager.getMasterAdminId(),
      },
    };

    res.json(healthData);
  });

  // Root endpoint
  router.get("/", (req, res) => {
    res.json({
      message: "Telegram Payment Bot API",
      version: "1.0.0",
      status: "running",
      endpoints: {
        health: "/health",
        telegram_webhook: "/webhook/telegram",
        ragapay_webhook: "/webhook/ragapay",
        payment_success: "/payment/success",
        payment_cancel: "/payment/cancel",
      },
    });
  });

  // Telegram webhook endpoint
  router.post("/webhook/telegram", (req, res) => {
    try {
      bot.handleUpdate(req.body);
      res.status(200).json({ status: "OK" });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Ragapay webhook endpoint for payment status updates
  router.post("/webhook/ragapay", (req, res) => {
    try {
      console.log(
        "Ragapay webhook received:",
        JSON.stringify(req.body, null, 2)
      );

      const { order, status, transaction_id } = req.body;

      if (!order || !status) {
        console.error("Invalid webhook data:", req.body);
        return res.status(400).json({ error: "Invalid webhook data" });
      }

      // Find the user session by order number
      let userId = null;
      for (const [uid, session] of dataStorage.userSessions.entries()) {
        if (session.orderNumber === order.number) {
          userId = uid;
          break;
        }
      }

      if (!userId) {
        console.error("User session not found for order:", order.number);
        return res.status(404).json({ error: "User session not found" });
      }

      // Update payment status
      const session = dataStorage.userSessions.get(userId);
      if (session) {
        session.status = status.toLowerCase();
        session.transactionId = transaction_id;
        session.updatedAt = new Date();

        console.log(`Payment status updated for user ${userId}: ${status}`);

        // Send notification to user
        const statusMessage = getPaymentStatusMessage(session, status);
        bot.telegram.sendMessage(userId, statusMessage);
      }

      res.status(200).json({ status: "OK" });
    } catch (error) {
      console.error("Ragapay webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Payment success callback
  router.get("/payment/success", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Successful</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
          .success { color: #28a745; font-size: 24px; }
          .message { margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="success">✅ Payment Successful!</div>
        <div class="message">Thank you for your payment. You can close this window and return to Telegram.</div>
      </body>
      </html>
    `);
  });

  // Payment cancel callback
  router.get("/payment/cancel", (req, res) => {
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
        <div class="message">Your payment was cancelled. You can close this window and return to Telegram.</div>
      </body>
      </html>
    `);
  });

  // 404 handler
  router.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: "The requested endpoint does not exist",
      availableEndpoints: [
        "/",
        "/health",
        "/webhook/telegram",
        "/webhook/ragapay",
        "/payment/success",
        "/payment/cancel",
      ],
    });
  });

  return router;
}
