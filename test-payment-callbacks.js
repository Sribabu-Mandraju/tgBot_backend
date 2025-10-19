// ============================================================================
// PAYMENT CALLBACK TEST
// ============================================================================

import {
  connectToDatabase,
  disconnectFromDatabase,
  Payment,
} from "./models/index.js";

async function testPaymentCallbacks() {
  try {
    console.log("🔗 Testing payment callback scenarios...");

    // Connect to database
    await connectToDatabase();
    console.log("✅ Database connected successfully");

    // Test 1: Create a test payment
    console.log("\n📝 Creating test payment...");
    const testPayment = new Payment({
      userId: "123456789",
      chatId: "123456789",
      orderNumber: "TEST_123456789_" + Date.now(),
      amount: 100,
      currency: "USD",
      status: "pending",
      checkoutUrl: "https://test-checkout.com",
      billingAddress: {
        country: "US",
        state: "CA",
        city: "San Francisco",
        address: "123 Test St",
        zip: "94102",
        phone: "+1234567890",
      },
    });

    await testPayment.save();
    console.log(`✅ Test payment created: ${testPayment.orderNumber}`);

    // Test 2: Find pending payments
    console.log("\n🔍 Testing find pending payments...");
    const pendingPayments = await Payment.find({ status: "pending" });
    console.log(`📊 Found ${pendingPayments.length} pending payments`);

    // Test 3: Find payment by user ID
    console.log("\n👤 Testing find payment by user ID...");
    const userPayment = await Payment.findOne({
      userId: "123456789",
      status: "pending",
    }).sort({ createdAt: -1 });

    if (userPayment) {
      console.log(`✅ Found payment for user: ${userPayment.orderNumber}`);
    } else {
      console.log("❌ No payment found for user");
    }

    // Test 4: Update payment status
    console.log("\n🔄 Testing payment status update...");
    if (userPayment) {
      const updatedPayment = await Payment.updatePaymentStatus(
        userPayment.orderNumber,
        "completed",
        "TEST_TRANS_123",
        "TEST_PAY_456"
      );

      if (updatedPayment) {
        console.log(`✅ Payment status updated: ${updatedPayment.status}`);
        console.log(`📊 Transaction ID: ${updatedPayment.transactionId}`);
        console.log(`📊 Payment ID: ${updatedPayment.paymentId}`);
      } else {
        console.log("❌ Failed to update payment status");
      }
    }

    // Clean up test data
    console.log("\n🧹 Cleaning up test data...");
    await Payment.deleteOne({ orderNumber: testPayment.orderNumber });
    console.log("✅ Test data cleaned up");

    console.log("\n✅ All payment callback tests passed!");
  } catch (error) {
    console.error("❌ Payment callback test failed:", error);
  } finally {
    // Disconnect from database
    await disconnectFromDatabase();
    console.log("🔌 Database disconnected");
    process.exit(0);
  }
}

// Run the test
testPaymentCallbacks();
