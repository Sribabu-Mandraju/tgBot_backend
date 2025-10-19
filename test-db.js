// ============================================================================
// DATABASE CONNECTION TEST
// ============================================================================

import {
  connectToDatabase,
  disconnectFromDatabase,
  Admin,
  Product,
  Payment,
} from "./models/index.js";

async function testDatabaseConnection() {
  try {
    console.log("🔗 Testing database connection...");

    // Connect to database
    await connectToDatabase();
    console.log("✅ Database connected successfully");

    // Test Admin model
    console.log("👑 Testing Admin model...");
    const adminCount = await Admin.countDocuments();
    console.log(`📊 Total admins: ${adminCount}`);

    // Test Product model
    console.log("📦 Testing Product model...");
    const productCount = await Product.countDocuments();
    console.log(`📊 Total products: ${productCount}`);

    // Test Payment model
    console.log("💳 Testing Payment model...");
    const paymentCount = await Payment.countDocuments();
    console.log(`📊 Total payments: ${paymentCount}`);

    console.log("✅ All database tests passed!");
  } catch (error) {
    console.error("❌ Database test failed:", error);
  } finally {
    // Disconnect from database
    await disconnectFromDatabase();
    console.log("🔌 Database disconnected");
    process.exit(0);
  }
}

// Run the test
testDatabaseConnection();
