// ============================================================================
// EXPRESS ROUTES
// ============================================================================

import express from "express";
import { SERVER_CONFIG } from "./config.js";

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
        webhook: "/webhook/telegram",
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
        "/payment/success",
        "/payment/cancel",
      ],
    });
  });

  return router;
}
