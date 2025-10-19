// ============================================================================
// DATABASE CONNECTION
// ============================================================================

import mongoose from "mongoose";
import { SERVER_CONFIG } from "../config.js";

let isConnected = false;

export async function connectToDatabase() {
  if (isConnected) {
    console.log("📊 Database already connected");
    return;
  }

  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/telegram_payment_bot";

    console.log("🔗 Connecting to MongoDB...");

    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    isConnected = true;
    console.log("✅ MongoDB connected successfully");

    // Handle connection events
    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.log("⚠️ MongoDB disconnected");
      isConnected = false;
    });

    mongoose.connection.on("reconnected", () => {
      console.log("🔄 MongoDB reconnected");
      isConnected = true;
    });
  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error);
    isConnected = false;
    throw error;
  }
}

export async function disconnectFromDatabase() {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log("✅ MongoDB disconnected successfully");
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error);
  }
}

export function getConnectionStatus() {
  return {
    isConnected,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
  };
}
