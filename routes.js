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
        ragapay_callback: "/callback/ragapay",
        payment_success: "/payment/success",
        payment_cancel: "/payment/cancel",
        manual_update: "/manual-status-update",
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
      console.log("=== RAGAPAY WEBHOOK RECEIVED ===");
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("Body:", JSON.stringify(req.body, null, 2));
      console.log("=================================");

      // Handle different possible webhook formats
      let orderNumber, status, transactionId;

      // Format 1: Direct order and status
      if (req.body.order && req.body.status) {
        orderNumber = req.body.order.number;
        status = req.body.status;
        transactionId = req.body.transaction_id;
      }
      // Format 2: Nested in data
      else if (req.body.data && req.body.data.order) {
        orderNumber = req.body.data.order.number;
        status = req.body.data.status;
        transactionId = req.body.data.transaction_id;
      }
      // Format 3: Direct fields
      else if (req.body.order_number && req.body.payment_status) {
        orderNumber = req.body.order_number;
        status = req.body.payment_status;
        transactionId = req.body.transaction_id;
      }
      // Format 4: Alternative field names
      else if (req.body.orderNumber && req.body.status) {
        orderNumber = req.body.orderNumber;
        status = req.body.status;
        transactionId = req.body.transactionId;
      } else {
        console.error("Unknown webhook format:", req.body);
        return res.status(400).json({ error: "Unknown webhook format" });
      }

      if (!orderNumber || !status) {
        console.error(
          "Missing required fields - orderNumber:",
          orderNumber,
          "status:",
          status
        );
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(
        `Processing webhook - Order: ${orderNumber}, Status: ${status}`
      );

      // Find the user session by order number
      let userId = null;
      for (const [uid, session] of dataStorage.userSessions.entries()) {
        if (session.orderNumber === orderNumber) {
          userId = uid;
          break;
        }
      }

      if (!userId) {
        console.error("User session not found for order:", orderNumber);
        console.log(
          "Available sessions:",
          Array.from(dataStorage.userSessions.keys())
        );
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

  // Ragapay callback endpoint (based on official documentation)
  router.post("/callback/ragapay", (req, res) => {
    try {
      console.log("=== RAGAPAY CALLBACK RECEIVED ===");
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("Body:", JSON.stringify(req.body, null, 2));
      console.log("=================================");

      // According to Ragapay docs, callback contains:
      // payment_id, trans_id, order_id, amount, currency, description, hash
      const {
        payment_id,
        trans_id,
        order_id,
        amount,
        currency,
        description,
        hash,
        payment_status,
        status,
      } = req.body;

      if (!order_id) {
        console.error("Missing order_id in callback:", req.body);
        return res.status(400).json({ error: "Missing order_id" });
      }

      console.log(
        `Processing callback - Order: ${order_id}, Payment ID: ${payment_id}`
      );

      // Find the user session by order number
      let userId = null;
      for (const [uid, session] of dataStorage.userSessions.entries()) {
        if (session.orderNumber === order_id) {
          userId = uid;
          break;
        }
      }

      if (!userId) {
        console.error("User session not found for order:", order_id);
        console.log(
          "Available sessions:",
          Array.from(dataStorage.userSessions.keys())
        );
        return res.status(404).json({ error: "User session not found" });
      }

      // Update payment status
      const session = dataStorage.userSessions.get(userId);
      if (session) {
        const oldStatus = session.status;

        // Determine status based on callback data
        let newStatus = "completed"; // Default to completed for successful callbacks
        if (payment_status) {
          newStatus = payment_status.toLowerCase();
        } else if (status) {
          newStatus = status.toLowerCase();
        }

        session.status = newStatus;
        session.transactionId = trans_id;
        session.paymentId = payment_id;
        session.updatedAt = new Date();

        console.log(
          `Payment status updated for user ${userId}: ${oldStatus} -> ${newStatus}`
        );

        // Send notification to user
        try {
          const statusMessage = getPaymentStatusMessage(session, newStatus);
          bot.telegram.sendMessage(userId, statusMessage);
          console.log(`Notification sent to user ${userId}`);
        } catch (notifyError) {
          console.error("Failed to send notification:", notifyError);
        }
      }

      res
        .status(200)
        .json({ status: "OK", message: "Callback processed successfully" });
    } catch (error) {
      console.error("Ragapay callback error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual status update endpoint (for testing)
  router.post("/manual-status-update", (req, res) => {
    try {
      const { orderNumber, status, userId } = req.body;

      if (!orderNumber || !status) {
        return res.status(400).json({ error: "Missing orderNumber or status" });
      }

      console.log(
        `Manual status update - Order: ${orderNumber}, Status: ${status}`
      );

      // Find user session
      let targetUserId = userId;
      if (!targetUserId) {
        for (const [uid, session] of dataStorage.userSessions.entries()) {
          if (session.orderNumber === orderNumber) {
            targetUserId = uid;
            break;
          }
        }
      }

      if (!targetUserId) {
        return res.status(404).json({ error: "User session not found" });
      }

      // Update status
      const session = dataStorage.userSessions.get(targetUserId);
      if (session) {
        const oldStatus = session.status;
        session.status = status.toLowerCase();
        session.updatedAt = new Date();

        console.log(
          `Manual status update for user ${targetUserId}: ${oldStatus} -> ${status}`
        );

        // Send notification
        try {
          const statusMessage = getPaymentStatusMessage(session, status);
          bot.telegram.sendMessage(targetUserId, statusMessage);
        } catch (notifyError) {
          console.error("Failed to send notification:", notifyError);
        }

        res.json({
          status: "OK",
          message: "Status updated successfully",
          userId: targetUserId,
          orderNumber: orderNumber,
          oldStatus: oldStatus,
          newStatus: status,
        });
      } else {
        res.status(404).json({ error: "Session not found" });
      }
    } catch (error) {
      console.error("Manual status update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Payment success callback
  router.get("/payment/success", (req, res) => {
    try {
      console.log("Payment success callback received:", req.query);

      const { payment_id, trans_id, order_id, hash } = req.query;

      if (payment_id && order_id) {
        // Find user session by order_id
        let userId = null;
        for (const [uid, session] of dataStorage.userSessions.entries()) {
          if (session.orderNumber === order_id) {
            userId = uid;
            break;
          }
        }

        if (userId) {
          // Update payment status to completed
          const session = dataStorage.userSessions.get(userId);
          if (session) {
            session.status = "completed";
            session.transactionId = trans_id;
            session.paymentId = payment_id;
            session.updatedAt = new Date();

            console.log(
              `Payment completed for user ${userId}, order: ${order_id}`
            );

            // Send notification to user
            try {
              const statusMessage = getPaymentStatusMessage(
                session,
                "completed"
              );
              bot.telegram.sendMessage(userId, statusMessage);
            } catch (notifyError) {
              console.error("Failed to send notification:", notifyError);
            }
          }
        }
      }

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
    } catch (error) {
      console.error("Payment success callback error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Payment cancel callback
  router.get("/payment/cancel", (req, res) => {
    try {
      console.log("Payment cancel callback received:", req.query);

      const { payment_id, trans_id, order_id, hash } = req.query;

      if (payment_id && order_id) {
        // Find user session by order_id
        let userId = null;
        for (const [uid, session] of dataStorage.userSessions.entries()) {
          if (session.orderNumber === order_id) {
            userId = uid;
            break;
          }
        }

        if (userId) {
          // Update payment status to cancelled
          const session = dataStorage.userSessions.get(userId);
          if (session) {
            session.status = "cancelled";
            session.transactionId = trans_id;
            session.paymentId = payment_id;
            session.updatedAt = new Date();

            console.log(
              `Payment cancelled for user ${userId}, order: ${order_id}`
            );

            // Send notification to user
            try {
              const statusMessage = getPaymentStatusMessage(
                session,
                "cancelled"
              );
              bot.telegram.sendMessage(userId, statusMessage);
            } catch (notifyError) {
              console.error("Failed to send notification:", notifyError);
            }
          }
        }
      }

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
    } catch (error) {
      console.error("Payment cancel callback error:", error);
      res.status(500).send("Internal server error");
    }
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
        "/callback/ragapay",
        "/payment/success",
        "/payment/cancel",
        "/manual-status-update",
      ],
    });
  });

  return router;
}
