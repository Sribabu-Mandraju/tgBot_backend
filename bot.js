// bot.js
require('dotenv').config({ silent: true }); // Suppress dotenv logs
const { Telegraf } = require('telegraf');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Command: /pay <amount> <description>
bot.command('pay', async (ctx) => {
  const [amount, ...descParts] = ctx.message.text.split(' ').slice(1);
  const description = descParts.join(' ') || 'Test Payment';

  if (!amount || isNaN(amount) || amount <= 0) {
    return ctx.reply('Usage: /pay <amount> <description>\nExample: /pay 50 Coffee');
  }

  try {
    const response = await axios.post('http://localhost:3000/api/create-session', {
      orderNumber: `bot-${Date.now()}`,
      amount: parseFloat(amount),
      currency: 'USD',
      description,
      customerName: ctx.from.first_name || 'Test User',
      customerEmail: `test${Date.now()}@example.com`,
      methods: ['card'],
      billingCountry: 'US',
    });

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
            inline_keyboard: [[{ text: 'Pay Now', url: response.data.checkoutUrl }]],
          },
        }
      );
    } else {
      ctx.reply('Failed to initiate payment. Try again.');
    }
  } catch (error) {
    console.error('Bot Error:', error.response?.data || error.message);
    ctx.reply('Error creating payment session. Please try again.');
  }
});

bot.launch().catch((err) => console.error('Bot launch failed:', err));
console.log('Telegram bot started');