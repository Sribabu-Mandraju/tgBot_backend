// bot.js
import { Telegraf } from "telegraf";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

// Validate bot token
if (!process.env.BOT_TOKEN) {
  console.error("❌ Error: BOT_TOKEN is not set in your .env file");
  console.log("Please add BOT_TOKEN=your_bot_token_here to your .env file");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

// Command: /pay <amount> <description>
bot.command("pay", async (ctx) => {
  const [amount, ...descParts] = ctx.message.text.split(" ").slice(1);
  const description = descParts.join(" ") || "Test Payment";

  if (!amount || isNaN(amount) || amount <= 0) {
    return ctx.reply(
      "Usage: /pay <amount> <description>\nExample: /pay 50 Coffee"
    );
  }

  try {
    const response = await axios.post(
      "https://tgbot-backend-fewy.onrender.com/api/create-session",
      {
        orderNumber: `bot-${Date.now()}`,
        amount: parseFloat(amount),
        currency: "USD",
        description,
        customerName: ctx.from.first_name || "Test User",
        customerEmail: `test${Date.now()}@example.com`,
        methods: ["card"],
        billingCountry: "US",
      }
    );

    if (response.data.success) {
      ctx.reply(
        `Complete your payment: ${response.data.checkoutUrl}\n\n` +
          `Use these test cards (sandbox):\n` +
          `✅ Success: 4111 1111 1111 1111, Expiry 01/38, CVV 123\n` +
          `❌ Failed: 4111 1111 1111 1111, Expiry 02/38, CVV 123\n` +
          `✅ 3DS Success: 4111 1111 1111 1111, Expiry 05/38, CVV 123\n` +
          `❌ 3DS Failed: 4111 1111 1111 1111, Expiry 06/38, CVV 123\n` +
          `❌ Unsupported: 1111 2222 3333 4444, Expiry 01/38, CVV 123`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Pay Now", url: response.data.checkoutUrl }],
            ],
          },
        }
      );
    } else {
      ctx.reply("Failed to initiate payment. Try again.");
    }
  } catch (error) {
    console.error("Bot Error:", error.message);
    ctx.reply("Error creating payment session. Please try again.");
  }
});

// Handle success/cancel redirects (optional, for user feedback)
bot.command("status", (ctx) => {
  // Placeholder: Check order status via DB or RagaPay API
  ctx.reply("Enter your order number to check status.");
});

// Launch bot with error handling
async function startBot() {
  try {
    await bot.launch();
    console.log("✅ Telegram bot started successfully");

    // Enable graceful stop
    process.once("SIGINT", () => bot.stop("SIGINT"));
    process.once("SIGTERM", () => bot.stop("SIGTERM"));
  } catch (error) {
    console.error("❌ Failed to start Telegram bot:", error.message);

    if (error.message.includes("404")) {
      console.log("\n🔧 Troubleshooting steps:");
      console.log("1. Check if your BOT_TOKEN is correct in the .env file");
      console.log("2. Make sure the bot exists and is active");
      console.log(
        "3. Verify the token format: BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
      );
      console.log("4. Contact @BotFather to get a new token if needed");
    }

    process.exit(1);
  }
}

startBot();
