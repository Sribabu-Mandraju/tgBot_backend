// ============================================================================
// READIES PAYMENT INTEGRATION
// ============================================================================

import axios from "axios";
import CryptoJS from "crypto-js";
import { READIES_CONFIG, SERVER_CONFIG } from "./config.js";

const USER_AGENT = "TelegramBot/ReadiesIntegration/1.0";

const READIES_STATUS_MAP = {
  "0": "pending",
  "1": "completed",
  "200": "cancelled",
  "400": "failed",
  pending: "pending",
  completed: "completed",
  cancel: "cancelled",
  failed: "failed",
};

function assertConfig() {
  if (!READIES_CONFIG.merchantEmail) {
    throw new Error("READIES_MERCHANT_EMAIL is not configured");
  }
  if (!READIES_CONFIG.publicKey) {
    throw new Error("READIES_PUBLIC_KEY is not configured");
  }
  if (!READIES_CONFIG.privateKey) {
    throw new Error("READIES_PRIVATE_KEY is not configured");
  }
}

function buildFormBody(payload) {
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    params.append(key, String(value));
  });
  return params.toString();
}

export function mapReadiesStatus(status) {
  if (status === undefined || status === null) {
    return "pending";
  }

  const normalized = String(status).toLowerCase();
  return READIES_STATUS_MAP[normalized] || "pending";
}

export function generateIpnSignature() {
  const secret = READIES_CONFIG.ipnSecret || READIES_CONFIG.privateKey;
  if (!secret) {
    throw new Error("Readies IPN secret/private key is not configured");
  }
  return CryptoJS.MD5(secret).toString(CryptoJS.enc.Hex).toLowerCase();
}

export function verifyIpnSignature(receivedSignature) {
  if (!receivedSignature) {
    return false;
  }
  const expectedSignature = generateIpnSignature();
  return expectedSignature === receivedSignature.toLowerCase();
}

async function fetchAuthorizationToken() {
  assertConfig();

  const body = buildFormBody({
    email: READIES_CONFIG.merchantEmail,
    public_key: READIES_CONFIG.publicKey,
    private_key: READIES_CONFIG.privateKey,
  });

  const response = await axios.post(READIES_CONFIG.authorizeEndpoint, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    timeout: 15000,
  });

  const data = response.data || {};

  if (!data.status || !data.response?.authorize_token) {
    const errorMessage =
      data.message || "Failed to obtain Readies authorization token";
    throw new Error(errorMessage);
  }

  return data.response.authorize_token.replace(/^Bearer\s+/i, "");
}

export async function createPaymentLink(ctx, userId, paymentData, dataStorage) {
  const authToken = await fetchAuthorizationToken();

  const {
    amount,
    currency,
    description,
    address,
    productId,
    productName,
    productDescription,
  } = paymentData;

  const orderNumber = `TG_${userId}_${Date.now()}`;

  const buyerFirstName = ctx.from?.first_name || "Telegram";
  const buyerLastName = ctx.from?.last_name || "User";
  const buyerEmail =
    ctx.from?.username?.trim() && ctx.from.username.trim() !== ""
      ? `${ctx.from.username}@t.me`
      : `user${userId}@telegram.local`;

  const addressSupplied = Boolean(address);

  const payload = {
    plugins_version: "telegram-bot",
    cmd: "simple",
    amount: Number(amount).toFixed(2),
    currency1: currency.toUpperCase(),
    currency2: "READIES",
    user_creation: "false",
    buyer_opt_completed: "false",
    buyer_email: buyerEmail,
    buyer_first_name: buyerFirstName,
    buyer_last_name: buyerLastName,
    address_supplied: addressSupplied ? "true" : "false",
    address_line1: addressSupplied ? address.address : "",
    address_line2: addressSupplied ? address.address2 || "" : "",
    address_city: addressSupplied ? address.city : "",
    address_state_province: addressSupplied ? address.state : "",
    address_country: addressSupplied ? address.country : "",
    address_postal_code: addressSupplied ? address.zip : "",
    buyer_mobile: addressSupplied ? address.phone : "",
    item_name: productName || "Telegram Payment",
    item_number: productId ? String(productId) : "N/A",
    description: JSON.stringify({
      productId: productId || null,
      productName: productName || null,
      description: productDescription || description || null,
    }),
    ipn_url: `${SERVER_CONFIG.BASE_URL}/webhook/readies`,
    invoice: orderNumber,
    success_url: `${SERVER_CONFIG.BASE_URL}/payment/success?order_id=${orderNumber}&user_id=${userId}`,
    cancel_url: `${SERVER_CONFIG.BASE_URL}/payment/cancel?order_id=${orderNumber}&user_id=${userId}`,
  };

  const response = await axios.post(
    READIES_CONFIG.transactionEndpoint,
    buildFormBody(payload),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        Authorization: `Bearer ${authToken}`,
        "User-Agent": USER_AGENT,
      },
      timeout: 15000,
    }
  );

  const result = response.data || {};

  if (!result.status || !result.response) {
    const message =
      result.message ||
      "Readies API returned an unexpected response when creating transaction";
    throw new Error(message);
  }

  const checkoutUrl =
    result.response.checkout_url ||
    result.response.url ||
    result.response.payment_url;

  if (!checkoutUrl) {
    throw new Error(
      `Readies transaction created but checkout URL missing. Response: ${JSON.stringify(
        result,
        null,
        2
      )}`
    );
  }

  const paymentSessionData = {
    userId: userId.toString(),
    chatId: ctx.chat.id.toString(),
    orderNumber,
    invoiceId: result.response.invoice_id || orderNumber,
    paymentId: result.response.payment_id || null,
    transactionId: result.response.txn_id || null,
    amount: Number(amount),
    currency: currency.toUpperCase(),
    status: mapReadiesStatus(result.response.status),
    checkoutUrl,
    productId: productId || null,
    productName: productName || null,
    productDescription: productDescription || description || null,
    description: description || null,
    gateway: "readies",
    billingAddress: addressSupplied
      ? {
          country: address.country,
          state: address.state,
          city: address.city,
          address: address.address,
          zip: address.zip,
          phone: address.phone,
        }
      : null,
    gatewayMeta: {
      original_amount: result.response.original_amount || null,
      original_currency: result.response.original_currency || null,
      selected_amount: result.response.selected_amount || null,
      selected_currency: result.response.selected_currency || null,
      confirms_needed: result.response.confirms_needed || null,
      timeout: result.response.timeout || null,
    },
  };

  await dataStorage.createPaymentSession(paymentSessionData);

  return {
    paymentUrl: checkoutUrl,
    orderNumber,
    invoiceId: paymentSessionData.invoiceId,
    paymentId: paymentSessionData.paymentId,
    transactionId: paymentSessionData.transactionId,
    status: paymentSessionData.status,
  };
}
