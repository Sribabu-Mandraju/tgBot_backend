// ============================================================================
// RAGAPAY PAYMENT INTEGRATION
// ============================================================================

import axios from "axios";
import CryptoJS from "crypto-js";
import { RAGAPAY_CONFIG, SERVER_CONFIG } from "./config.js";

// ============================================================================
// SIGNATURE GENERATION
// ============================================================================

export function generateSignature(payload) {
  try {
    if (!RAGAPAY_CONFIG.password) {
      throw new Error("Ragapay password is not configured");
    }

    // According to official docs: sha1(md5(strtoupper(order.number + order.amount + order.currency + order.description + PASSWORD)))
    const to_md5 =
      payload.order.number +
      payload.order.amount +
      payload.order.currency +
      payload.order.description +
      RAGAPAY_CONFIG.password;

    console.log("Signature input string:", to_md5);
    const upperString = to_md5.toUpperCase();
    console.log("Uppercase string:", upperString);
    const md5Hash = CryptoJS.MD5(upperString);
    console.log("MD5 hash:", md5Hash.toString(CryptoJS.enc.Hex));
    const sha1Hash = CryptoJS.SHA1(md5Hash.toString());
    const signature = CryptoJS.enc.Hex.stringify(sha1Hash);
    console.log("Final signature:", signature);

    return signature;
  } catch (error) {
    console.error("Signature generation error:", error);
    throw new Error(`Signature generation failed: ${error.message}`);
  }
}

// ============================================================================
// PAYMENT SESSION CREATION
// ============================================================================

export async function createPaymentSession(
  ctx,
  userId,
  paymentData,
  dataStorage
) {
  try {
    const {
      amount,
      currency,
      address,
      productId,
      productName,
      productDescription,
      description,
    } = paymentData;

    // Country code mapping for Ragapay (requires 2-character codes)
    const countryCodeMap = {
      UAE: "AE",
      "UNITED ARAB EMIRATES": "AE",
      US: "US",
      USA: "US",
      "UNITED STATES": "US",
      UK: "GB",
      "UNITED KINGDOM": "GB",
      GB: "GB",
      INDIA: "IN",
      IN: "IN",
      CANADA: "CA",
      CA: "CA",
      AUSTRALIA: "AU",
      AU: "AU",
      GERMANY: "DE",
      DE: "DE",
      FRANCE: "FR",
      FR: "FR",
      ITALY: "IT",
      IT: "IT",
      SPAIN: "ES",
      ES: "ES",
      NETHERLANDS: "NL",
      NL: "NL",
      BELGIUM: "BE",
      BE: "BE",
      SWITZERLAND: "CH",
      CH: "CH",
      AUSTRIA: "AT",
      AT: "AT",
      SWEDEN: "SE",
      SE: "SE",
      NORWAY: "NO",
      NO: "NO",
      DENMARK: "DK",
      DK: "DK",
      FINLAND: "FI",
      FI: "FI",
      POLAND: "PL",
      PL: "PL",
      "CZECH REPUBLIC": "CZ",
      CZ: "CZ",
      HUNGARY: "HU",
      HU: "HU",
      PORTUGAL: "PT",
      PT: "PT",
      GREECE: "GR",
      GR: "GR",
      TURKEY: "TR",
      TR: "TR",
      RUSSIA: "RU",
      RU: "RU",
      CHINA: "CN",
      CN: "CN",
      JAPAN: "JP",
      JP: "JP",
      "SOUTH KOREA": "KR",
      KR: "KR",
      SINGAPORE: "SG",
      SG: "SG",
      MALAYSIA: "MY",
      MY: "MY",
      THAILAND: "TH",
      TH: "TH",
      PHILIPPINES: "PH",
      PH: "PH",
      INDONESIA: "ID",
      ID: "ID",
      VIETNAM: "VN",
      VN: "VN",
      BRAZIL: "BR",
      BR: "BR",
      ARGENTINA: "AR",
      AR: "AR",
      MEXICO: "MX",
      MX: "MX",
      CHILE: "CL",
      CL: "CL",
      COLOMBIA: "CO",
      CO: "CO",
      PERU: "PE",
      PE: "PE",
      "SOUTH AFRICA": "ZA",
      ZA: "ZA",
      EGYPT: "EG",
      EG: "EG",
      ISRAEL: "IL",
      IL: "IL",
      "SAUDI ARABIA": "SA",
      SA: "SA",
      KUWAIT: "KW",
      KW: "KW",
      QATAR: "QA",
      QA: "QA",
      BAHRAIN: "BH",
      BH: "BH",
      OMAN: "OM",
      OM: "OM",
      JORDAN: "JO",
      JO: "JO",
      LEBANON: "LB",
      LB: "LB",
      IRAN: "IR",
      IR: "IR",
      IRAQ: "IQ",
      IQ: "IQ",
      SYRIA: "SY",
      SY: "SY",
      PAKISTAN: "PK",
      PK: "PK",
      AFGHANISTAN: "AF",
      AF: "AF",
      BANGLADESH: "BD",
      BD: "BD",
      "SRI LANKA": "LK",
      LK: "LK",
      NEPAL: "NP",
      NP: "NP",
      BHUTAN: "BT",
      BT: "BT",
      MYANMAR: "MM",
      MM: "MM",
      CAMBODIA: "KH",
      KH: "KH",
      LAOS: "LA",
      LA: "LA",
      MONGOLIA: "MN",
      MN: "MN",
      TAIWAN: "TW",
      TW: "TW",
      "HONG KONG": "HK",
      HK: "HK",
      MACAU: "MO",
      MO: "MO",
      "NEW ZEALAND": "NZ",
      NZ: "NZ",
      FIJI: "FJ",
      FJ: "FJ",
      "PAPUA NEW GUINEA": "PG",
      PG: "PG",
      "SOLOMON ISLANDS": "SB",
      SB: "SB",
      VANUATU: "VU",
      VU: "VU",
      SAMOA: "WS",
      WS: "WS",
      TONGA: "TO",
      TO: "TO",
      KIRIBATI: "KI",
      KI: "KI",
      TUVALU: "TV",
      TV: "TV",
      NAURU: "NR",
      NR: "NR",
      PALAU: "PW",
      PW: "PW",
      "MARSHALL ISLANDS": "MH",
      MH: "MH",
      MICRONESIA: "FM",
      FM: "FM",
      "COOK ISLANDS": "CK",
      CK: "CK",
      NIUE: "NU",
      NU: "NU",
      TOKELAU: "TK",
      TK: "TK",
      "AMERICAN SAMOA": "AS",
      AS: "AS",
      GUAM: "GU",
      GU: "GU",
      "NORTHERN MARIANA ISLANDS": "MP",
      MP: "MP",
      "PUERTO RICO": "PR",
      PR: "PR",
      "VIRGIN ISLANDS": "VI",
      VI: "VI",
      BERMUDA: "BM",
      BM: "BM",
      "CAYMAN ISLANDS": "KY",
      KY: "KY",
      "TURKS AND CAICOS ISLANDS": "TC",
      TC: "TC",
      BAHAMAS: "BS",
      BS: "BS",
      JAMAICA: "JM",
      JM: "JM",
      HAITI: "HT",
      HT: "HT",
      "DOMINICAN REPUBLIC": "DO",
      DO: "DO",
      CUBA: "CU",
      CU: "CU",
      "TRINIDAD AND TOBAGO": "TT",
      TT: "TT",
      BARBADOS: "BB",
      BB: "BB",
      "SAINT LUCIA": "LC",
      LC: "LC",
      "SAINT VINCENT AND THE GRENADINES": "VC",
      VC: "VC",
      GRENADA: "GD",
      GD: "GD",
      "ANTIGUA AND BARBUDA": "AG",
      AG: "AG",
      "SAINT KITTS AND NEVIS": "KN",
      KN: "KN",
      DOMINICA: "DM",
      DM: "DM",
      BELIZE: "BZ",
      BZ: "BZ",
      GUATEMALA: "GT",
      GT: "GT",
      HONDURAS: "HN",
      HN: "HN",
      "EL SALVADOR": "SV",
      SV: "SV",
      NICARAGUA: "NI",
      NI: "NI",
      "COSTA RICA": "CR",
      CR: "CR",
      PANAMA: "PA",
      PA: "PA",
      VENEZUELA: "VE",
      VE: "VE",
      GUYANA: "GY",
      GY: "GY",
      SURINAME: "SR",
      SR: "SR",
      "FRENCH GUIANA": "GF",
      GF: "GF",
      ECUADOR: "EC",
      EC: "EC",
      BOLIVIA: "BO",
      BO: "BO",
      PARAGUAY: "PY",
      PY: "PY",
      URUGUAY: "UY",
      UY: "UY",
      ALBANIA: "AL",
      AL: "AL",
      ANDORRA: "AD",
      AD: "AD",
      ARMENIA: "AM",
      AM: "AM",
      AZERBAIJAN: "AZ",
      AZ: "AZ",
      BELARUS: "BY",
      BY: "BY",
      "BOSNIA AND HERZEGOVINA": "BA",
      BA: "BA",
      BULGARIA: "BG",
      BG: "BG",
      CROATIA: "HR",
      HR: "HR",
      CYPRUS: "CY",
      CY: "CY",
      ESTONIA: "EE",
      EE: "EE",
      GEORGIA: "GE",
      GE: "GE",
      ICELAND: "IS",
      IS: "IS",
      IRELAND: "IE",
      IE: "IE",
      LATVIA: "LV",
      LV: "LV",
      LIECHTENSTEIN: "LI",
      LI: "LI",
      LITHUANIA: "LT",
      LT: "LT",
      LUXEMBOURG: "LU",
      LU: "LU",
      MALTA: "MT",
      MT: "MT",
      MOLDOVA: "MD",
      MD: "MD",
      MONACO: "MC",
      MC: "MC",
      MONTENEGRO: "ME",
      ME: "ME",
      "NORTH MACEDONIA": "MK",
      MK: "MK",
      ROMANIA: "RO",
      RO: "RO",
      "SAN MARINO": "SM",
      SM: "SM",
      SERBIA: "RS",
      RS: "RS",
      SLOVAKIA: "SK",
      SK: "SK",
      SLOVENIA: "SI",
      SI: "SI",
      UKRAINE: "UA",
      UA: "UA",
      "VATICAN CITY": "VA",
      VA: "VA",
      KOSOVO: "XK",
      XK: "XK",
      ALGERIA: "DZ",
      DZ: "DZ",
      ANGOLA: "AO",
      AO: "AO",
      BENIN: "BJ",
      BJ: "BJ",
      BOTSWANA: "BW",
      BW: "BW",
      "BURKINA FASO": "BF",
      BF: "BF",
      BURUNDI: "BI",
      BI: "BI",
      CAMEROON: "CM",
      CM: "CM",
      "CAPE VERDE": "CV",
      CV: "CV",
      "CENTRAL AFRICAN REPUBLIC": "CF",
      CF: "CF",
      CHAD: "TD",
      TD: "TD",
      COMOROS: "KM",
      KM: "KM",
      CONGO: "CG",
      CG: "CG",
      "DEMOCRATIC REPUBLIC OF THE CONGO": "CD",
      CD: "CD",
      DJIBOUTI: "DJ",
      DJ: "DJ",
      "EQUATORIAL GUINEA": "GQ",
      GQ: "GQ",
      ERITREA: "ER",
      ER: "ER",
      ESWATINI: "SZ",
      SZ: "SZ",
      ETHIOPIA: "ET",
      ET: "ET",
      GABON: "GA",
      GA: "GA",
      GAMBIA: "GM",
      GM: "GM",
      GHANA: "GH",
      GH: "GH",
      GUINEA: "GN",
      GN: "GN",
      "GUINEA-BISSAU": "GW",
      GW: "GW",
      "IVORY COAST": "CI",
      CI: "CI",
      KENYA: "KE",
      KE: "KE",
      LESOTHO: "LS",
      LS: "LS",
      LIBERIA: "LR",
      LR: "LR",
      LIBYA: "LY",
      LY: "LY",
      MADAGASCAR: "MG",
      MG: "MG",
      MALAWI: "MW",
      MW: "MW",
      MALI: "ML",
      ML: "ML",
      MAURITANIA: "MR",
      MR: "MR",
      MAURITIUS: "MU",
      MU: "MU",
      MOROCCO: "MA",
      MA: "MA",
      MOZAMBIQUE: "MZ",
      MZ: "MZ",
      NAMIBIA: "NA",
      NA: "NA",
      NIGER: "NE",
      NE: "NE",
      NIGERIA: "NG",
      NG: "NG",
      RWANDA: "RW",
      RW: "RW",
      "SAO TOME AND PRINCIPE": "ST",
      ST: "ST",
      SENEGAL: "SN",
      SN: "SN",
      SEYCHELLES: "SC",
      SC: "SC",
      "SIERRA LEONE": "SL",
      SL: "SL",
      SOMALIA: "SO",
      SO: "SO",
      SUDAN: "SD",
      SD: "SD",
      "SOUTH SUDAN": "SS",
      SS: "SS",
      TANZANIA: "TZ",
      TZ: "TZ",
      TOGO: "TG",
      TG: "TG",
      TUNISIA: "TN",
      TN: "TN",
      UGANDA: "UG",
      UG: "UG",
      ZAMBIA: "ZM",
      ZM: "ZM",
      ZIMBABWE: "ZW",
      ZW: "ZW",
    };

    // Convert country name to 2-character code
    const countryCode =
      countryCodeMap[address.country.toUpperCase()] ||
      address.country.toUpperCase().substring(0, 2);

    // Create payment session
    const orderNumber = `TG_${userId}_${Date.now()}`;
    const paymentDescription = productName
      ? productDescription || `Product: ${productName}`
      : description || `Telegram Payment - ${amount} ${currency}`;

    console.log(`Ragapay config check:`, {
      key: RAGAPAY_CONFIG.key ? "present" : "missing",
      password: RAGAPAY_CONFIG.password ? "present" : "missing",
      endpoint: RAGAPAY_CONFIG.endpoint,
    });

    const payload = {
      merchant_key: RAGAPAY_CONFIG.key,
      operation: "purchase",
      methods: ["card"],
      order: {
        number: orderNumber,
        amount: amount.toFixed(2),
        currency: currency,
        description: paymentDescription,
      },
      cancel_url: `${SERVER_CONFIG.BASE_URL}/payment/cancel?user_id=${userId}`,
      success_url: `${SERVER_CONFIG.BASE_URL}/payment/success?user_id=${userId}`,
      webhook_url: `${SERVER_CONFIG.BASE_URL}/callback/ragapay`,
      customer: {
        name: ctx.from.first_name || "Telegram User",
        email: `user${userId}@telegram.com`,
      },
      billing_address: {
        country: countryCode,
        state: address.state,
        city: address.city,
        address: address.address,
        zip: address.zip,
        phone: address.phone,
      },
      parameters: {
        telegram_user_id: userId,
        telegram_chat_id: ctx.chat.id,
        product_id: productId || null,
        order_number: orderNumber,
      },
      hash: "",
    };

    // Generate hash using correct Ragapay format
    payload.hash = generateSignature(payload);

    console.log(
      `Creating payment session for user ${userId}, order: ${orderNumber}`
    );
    console.log("Full payload being sent:", JSON.stringify(payload, null, 2));

    const response = await axios.post(RAGAPAY_CONFIG.endpoint, payload, {
      headers: { "Content-Type": "application/json" },
      timeout: 10000,
    });

    console.log(
      "Ragapay API Response:",
      JSON.stringify(response.data, null, 2)
    );

    // Check if response has the expected structure
    if (!response.data) {
      throw new Error("No response data received from Ragapay");
    }

    // Try different possible field names for checkout URL
    const checkoutUrl =
      response.data.checkout_url ||
      response.data.url ||
      response.data.redirect_url ||
      response.data.payment_url;

    if (!checkoutUrl) {
      console.error(
        "No checkout URL found in response. Available fields:",
        Object.keys(response.data)
      );
      throw new Error("No checkout URL received from Ragapay");
    }

    // Create payment session in database
    const paymentSessionData = {
      userId: userId.toString(),
      chatId: ctx.chat.id.toString(),
      orderNumber,
      amount,
      currency: currency,
      status: "pending",
      checkoutUrl: checkoutUrl,
      productId: productId || null,
      productName: productName || null,
      productDescription: productDescription || null,
      description: description || null,
      billingAddress: address.country
        ? {
            country: address.country,
            state: address.state,
            city: address.city,
            address: address.address,
            zip: address.zip,
            phone: address.phone,
          }
        : null, // No address collected - RagaPay will collect it
    };

    // Store in database
    await dataStorage.createPaymentSession(paymentSessionData);

    console.log(`Payment session created for user ${userId}: ${checkoutUrl}`);

    // Clear address collection data if it exists
    if (dataStorage.userAddressCollection.has(userId)) {
      dataStorage.userAddressCollection.delete(userId);
    }

    const message =
      `💳 **Payment Session Created!**\n\n` +
      `Amount: ${amount} ${currency}\n` +
      `Order: ${orderNumber}\n\n` +
      `🔗 **Click the link below to complete your payment:**\n` +
      `${checkoutUrl}\n\n` +
      `💡 **Note:** You'll enter your billing address on the secure payment page.\n\n` +
      `Use /status to check your payment status.`;

    ctx.reply(message);
  } catch (error) {
    console.error(
      `Payment creation failed for user ${userId}:`,
      error.response?.data || error.message
    );

    // Log full error details for debugging
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response headers:", error.response.headers);
      console.error("Response data:", error.response.data);
    }

    // Clear address collection data on error
    dataStorage.userAddressCollection.delete(userId);

    ctx.reply(
      "❌ Failed to create payment session. Please try again later.\n" +
        "If the problem persists, contact support.\n\n" +
        "Start over with: /pay <amount> <currency> or /buy <product_id>"
    );
  }
}

// ============================================================================
// WEBHOOK VALIDATION
// ============================================================================

export function validateWebhookSignature(payload, signature) {
  try {
    const expectedSignature = generateSignature(payload);
    return expectedSignature === signature;
  } catch (error) {
    console.error("Webhook signature validation error:", error);
    return false;
  }
}

// ============================================================================
// PAYMENT STATUS HELPERS
// ============================================================================

export function getPaymentStatusEmoji(status) {
  const statusEmojis = {
    pending: "⏳",
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
  };
  return statusEmojis[status] || "❓";
}

export function formatPaymentStatusMessage(session) {
  let message =
    `📋 Payment Status\n\n` +
    `Order: ${session.orderNumber}\n` +
    `Amount: ${session.amount} ${session.currency}\n` +
    `Status: ${getPaymentStatusEmoji(session.status)} ${session.status}\n` +
    `Created: ${session.createdAt.toLocaleString()}\n\n`;

  if (session.productName) {
    message += `Product: ${session.productName}\n\n`;
  }

  if (session.status === "pending") {
    message +=
      "Payment is still pending. Complete it using the link sent earlier.";
  }

  return message;
}
