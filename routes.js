// ============================================================================
// EXPRESS ROUTES
// ============================================================================

import express from "express";
import { SERVER_CONFIG } from "./config.js";
import { Payment } from "./models/index.js";
import { verifyIpnSignature, mapReadiesStatus } from "./readies.js";

// Helper function to identify user from payment callback
async function identifyUserFromCallback(queryParams) {
  const { payment_id, trans_id, order_id, user_id, invoice_id } = queryParams;

  console.log("🔍 Identifying user from callback parameters:", queryParams);

  // Method 1: Invoice ID lookup
  const effectiveInvoice = invoice_id || order_id;
  if (effectiveInvoice) {
    console.log(
      `📋 Looking up payment by invoice/order id: ${effectiveInvoice}`
    );
    const payment = await Payment.findByInvoiceId(effectiveInvoice);
    if (payment) {
      console.log(`✅ Found payment for user: ${payment.userId}`);
      return { userId: payment.userId, payment, method: "invoice_id" };
    }
  }

  if (order_id) {
    console.log(`📋 Looking up payment by order_id: ${order_id}`);
    const payment = await Payment.findByOrderNumber(order_id);
    if (payment) {
      console.log(`✅ Found payment for user: ${payment.userId}`);
      return { userId: payment.userId, payment, method: "order_id" };
    }
  }

  // Method 2: Payment ID lookup
  if (payment_id) {
    console.log(`💳 Looking up payment by payment_id: ${payment_id}`);
    const payment = await Payment.findPaymentByPaymentId(payment_id);
    if (payment) {
      console.log(`✅ Found payment for user: ${payment.userId}`);
      return { userId: payment.userId, payment: payment, method: "payment_id" };
    }
  }

  // Method 3: Transaction ID lookup
  if (trans_id) {
    console.log(`🔄 Looking up payment by transaction_id: ${trans_id}`);
    const payment = await Payment.findPaymentByTransactionId(trans_id);
    if (payment) {
      console.log(`✅ Found payment for user: ${payment.userId}`);
      return {
        userId: payment.userId,
        payment: payment,
        method: "transaction_id",
      };
    }
  }

  // Method 4: User ID parameter
  if (user_id) {
    console.log(`👤 Looking up active payment for user: ${user_id}`);
    const payment = await Payment.findActivePaymentByUser(user_id);
    if (payment) {
      console.log(`✅ Found active payment for user: ${payment.userId}`);
      return { userId: payment.userId, payment: payment, method: "user_id" };
    }
  }

  // Method 5: Most recent pending payment (last resort)
  console.log(`🔍 Looking up most recent pending payment...`);
  const recentPayment = await Payment.findOne({
    status: "pending",
  }).sort({ createdAt: -1 });

  if (recentPayment) {
    console.log(
      `✅ Found most recent pending payment for user: ${recentPayment.userId}`
    );
    return {
      userId: recentPayment.userId,
      payment: recentPayment,
      method: "most_recent",
    };
  }

  console.log(`❌ Could not identify user from callback parameters`);
  return null;
}

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
  router.get("/health", async (req, res) => {
    try {
      const [productCount, adminList, masterAdminId] = await Promise.all([
        productManager.getProductCount(),
        adminManager.getAllAdmins(),
        adminManager.getMasterAdminId(),
      ]);

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
          total: productCount,
        },
        admins: {
          total: adminList.length,
          masterAdmin: masterAdminId,
        },
      };

      res.json(healthData);
    } catch (error) {
      console.error("Health endpoint error:", error);
      res
        .status(500)
        .json({ status: "ERROR", message: "Unable to fetch health data" });
    }
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
        readies_webhook: "/webhook/readies",
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

  // Readies IPN webhook
  router.post("/webhook/readies", async (req, res) => {
    try {
      console.log("=== READIES IPN RECEIVED ===");
      console.log("Headers:", JSON.stringify(req.headers, null, 2));
      console.log("Body:", JSON.stringify(req.body, null, 2));
      console.log("=================================");

      const signature =
        req.body?.sign ||
        req.body?.key ||
        req.headers["x-readies-signature"] ||
        req.headers["x-signature"];

      if (!verifyIpnSignature(signature)) {
        console.error("Invalid IPN signature");
        return res.status(400).json({ error: "Invalid signature" });
      }

      const orderNumber = req.body.invoice_id || req.body.order_id;
      if (!orderNumber) {
        console.error("Missing invoice_id/order_id in IPN payload");
        return res.status(400).json({ error: "Missing invoice identifier" });
      }

      const status = mapReadiesStatus(req.body.status ?? req.body.resultCode);

      const updatedPayment = await dataStorage.updatePaymentStatus(
        orderNumber,
        status,
        req.body.txn_id,
        req.body.payment_id
      );

      if (!updatedPayment) {
        console.error("Payment session not found for order:", orderNumber);
        return res.status(404).json({ error: "Payment not found" });
      }

      console.log(
        `Payment status updated for user ${updatedPayment.userId}: ${status}`
      );

      try {
        const statusMessage = getPaymentStatusMessage(updatedPayment, status);
        await bot.telegram.sendMessage(updatedPayment.userId, statusMessage);
      } catch (notifyError) {
        console.error("Failed to send notification:", notifyError);
      }

      res.status(200).json({ status: "OK" });
    } catch (error) {
      console.error("Readies IPN error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Manual status update endpoint (for testing)
  router.post("/manual-status-update", async (req, res) => {
    try {
      const { orderNumber, status, userId } = req.body;

      if (!orderNumber || !status) {
        return res.status(400).json({ error: "Missing orderNumber or status" });
      }

      console.log(
        `Manual status update - Order: ${orderNumber}, Status: ${status}`
      );

      // Update payment status in database
      const updatedPayment = await dataStorage.updatePaymentStatus(
        orderNumber,
        status.toLowerCase()
      );

      if (!updatedPayment) {
        return res.status(404).json({ error: "User session not found" });
      }

      console.log(
        `Manual status update for user ${updatedPayment.userId}: ${status}`
      );

      // Send notification
      try {
        const statusMessage = getPaymentStatusMessage(updatedPayment, status);
        bot.telegram.sendMessage(updatedPayment.userId, statusMessage);
      } catch (notifyError) {
        console.error("Failed to send notification:", notifyError);
      }

      res.json({
        status: "OK",
        message: "Status updated successfully",
        userId: updatedPayment.userId,
        orderNumber: orderNumber,
        newStatus: status,
      });
    } catch (error) {
      console.error("Manual status update error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Payment success callback
  router.get("/payment/success", async (req, res) => {
    try {
      console.log("Payment success callback received:", req.query);
      console.log("Query parameters:", JSON.stringify(req.query, null, 2));
      console.log("Request URL:", req.url);
      console.log("Request headers:", JSON.stringify(req.headers, null, 2));

      // Use the comprehensive user identification helper
      const userInfo = await identifyUserFromCallback(req.query);

      if (!userInfo) {
        console.log("❌ Could not identify user from callback parameters");
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Status</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #dc3545; font-size: 24px; }
              .message { margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="error">⚠️ Payment Status Unknown</div>
            <div class="message">We couldn't identify your payment. Please contact support.</div>
          </body>
          </html>
        `);
      }

      const { userId, payment, method } = userInfo;
      console.log(`🎯 Identified user ${userId} using method: ${method}`);

      // Update payment status
      const updatedPayment = await dataStorage.updatePaymentStatus(
        payment.orderNumber,
        "completed",
        req.query.trans_id,
        req.query.payment_id
      );

      if (updatedPayment) {
        console.log(
          `✅ Payment completed for user ${userId}, order: ${payment.orderNumber}`
        );

        // Send notification to user
        try {
          const statusMessage = getPaymentStatusMessage(
            updatedPayment,
            "completed"
          );
          await bot.telegram.sendMessage(userId, statusMessage);
          console.log(`📱 Notification sent to user ${userId}`);
        } catch (notifyError) {
          console.error("Failed to send notification:", notifyError);
          // Don't throw the error, just log it to prevent crashes
        }
      } else {
        console.log(
          `❌ Failed to update payment status for order: ${payment.orderNumber}`
        );
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
            .debug { font-size: 12px; color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="success">✅ Payment Successful!</div>
          <div class="message">Thank you for your payment. You can close this window and return to Telegram.</div>
          <div class="debug">
            Debug Info:<br>
            User ID: ${userId || "Not provided"}<br>
            Order Number: ${payment?.orderNumber || "Not provided"}<br>
            Method: ${method || "Not provided"}<br>
            Timestamp: ${new Date().toISOString()}
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error("Payment success callback error:", error);
      res.status(500).send("Internal server error");
    }
  });

  // Payment cancel callback
  router.get("/payment/cancel", async (req, res) => {
    try {
      console.log("Payment cancel callback received:", req.query);

      // Use the comprehensive user identification helper
      const userInfo = await identifyUserFromCallback(req.query);

      if (!userInfo) {
        console.log("❌ Could not identify user from callback parameters");
        return res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Payment Status</title>
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
              .error { color: #dc3545; font-size: 24px; }
              .message { margin: 20px 0; }
            </style>
          </head>
          <body>
            <div class="error">⚠️ Payment Status Unknown</div>
            <div class="message">We couldn't identify your payment. Please contact support.</div>
          </body>
          </html>
        `);
      }

      const { userId, payment, method } = userInfo;
      console.log(`🎯 Identified user ${userId} using method: ${method}`);

      // Update payment status to cancelled
      const updatedPayment = await dataStorage.updatePaymentStatus(
        payment.orderNumber,
        "cancelled",
        req.query.trans_id,
        req.query.payment_id
      );

      if (updatedPayment) {
        console.log(
          `✅ Payment cancelled for user ${userId}, order: ${payment.orderNumber}`
        );

        // Send notification to user
        try {
          const statusMessage = getPaymentStatusMessage(
            updatedPayment,
            "cancelled"
          );
          await bot.telegram.sendMessage(userId, statusMessage);
          console.log(`📱 Notification sent to user ${userId}`);
        } catch (notifyError) {
          console.error("Failed to send notification:", notifyError);
          // Don't throw the error, just log it to prevent crashes
        }
      } else {
        console.log(
          `❌ Failed to update payment status for order: ${payment.orderNumber}`
        );
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
        "/webhook/readies",
        "/payment/success",
        "/payment/cancel",
        "/manual-status-update",
      ],
    });
  });

  return router;
}
