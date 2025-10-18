// server.js
import express from "express";
import axios from "axios";
import CryptoJS from "crypto-js";
import bodyParser from "body-parser";
import dotenv from "dotenv";

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ["CHECKOUT_HOST", "MERCHANT_KEY", "MERCHANT_SECRET"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error("❌ Error: Missing required environment variables:");
  missingVars.forEach((varName) => {
    console.log(`   - ${varName}`);
  });
  console.log("\nPlease add these to your .env file:");
  console.log("CHECKOUT_HOST=your_checkout_host_url");
  console.log("MERCHANT_KEY=your_merchant_key");
  console.log("MERCHANT_SECRET=your_merchant_secret");
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;
const CHECKOUT_HOST = process.env.CHECKOUT_HOST;
const MERCHANT_KEY = process.env.MERCHANT_KEY;
const MERCHANT_SECRET = process.env.MERCHANT_SECRET;

app.use(bodyParser.json());
app.use(express.static("public")); // Optional: for serving a frontend

// Helper: Generate HMAC-SHA256 hash
function generateHash(payload) {
  const stringified = JSON.stringify(payload);
  return CryptoJS.HmacSHA256(stringified, MERCHANT_SECRET).toString(
    CryptoJS.enc.Hex
  );
}

// Endpoint to create payment session
app.post("/api/create-session", async (req, res) => {
  const {
    orderNumber,
    amount,
    currency = "USD",
    description,
    customerName,
    customerEmail,
    billingCountry = "US",
    methods = ["card"], // Default to card
    ...customParams
  } = req.body;

  // Validate inputs
  if (!orderNumber || !amount || amount <= 0) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid orderNumber or amount" });
  }

  // Construct payload
  const payload = {
    merchant_key: MERCHANT_KEY,
    operation: "purchase",
    methods: Array.isArray(methods) ? methods : [methods],
    order: {
      number: orderNumber,
      amount: amount.toFixed(2), // String with 2 decimals
      currency,
      description: description || `Payment for order ${orderNumber}`,
    },
    cancel_url: "https://your-domain.com/cancel", // Replace with your domain
    success_url: "https://your-domain.com/success", // Replace with your domain
    customer: {
      name: customerName || "Test User",
      email: customerEmail || "test@example.com",
    },
    billing_address: {
      country: billingCountry,
      state: "",
      city: "",
      address: "",
      zip: "",
      phone: "",
    },
    parameters: customParams.parameters || {},
    hash: "",
  };

  // Generate hash (exclude hash field)
  payload.hash = generateHash({ ...payload, hash: "" });

  try {
    const response = await axios.post(
      `${CHECKOUT_HOST}/api/v1/session`,
      payload,
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    res.json({ success: true, checkoutUrl: response.data.checkout_url });
  } catch (error) {
    console.error("RagaPay Error:", error.response?.data || error.message);
    console.error("Full error details:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
      },
    });

    res.status(500).json({
      success: false,
      error: error.response?.data?.message || "Session creation failed",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// Webhook endpoint for payment status updates
app.post("/api/webhook", (req, res) => {
  const { status, order_number, transaction_id } = req.body;
  console.log(
    `Webhook: Order ${order_number}, Status: ${status}, Transaction ID: ${transaction_id}`
  );
  // TODO: Update order status in DB, notify user via bot
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
