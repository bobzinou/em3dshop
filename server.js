// server.js
const dotenv = require("dotenv");
dotenv.config(); // ✅ TOUJOURS EN PREMIER, avant tout le reste

const { generateInvoice } = require("./invoice-generator");
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const { sendInvoiceEmail, sendAdminNotification } = require("./email-sender");
const app = express();

// CRÉER LES DOSSIERS S'ILS N'EXISTENT PAS (RENDER)
const dataDir = path.join(__dirname, "data");
const invoicesDir = path.join(__dirname, "invoices");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

const ordersFile = path.join(dataDir, "orders.json");
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, JSON.stringify([]));

// TRUST PROXY POUR RENDER
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// RATE LIMIT SANS PROBLÈME IPv6
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.ip === '::1' || req.ip === '127.0.0.1';
  }
});

app.use(limiter);

// ✅ SENDCLOUD CONFIG — DEUX VERSIONS D'API DIFFÉRENTES
const SENDCLOUD_PUBLIC_KEY = process.env.SENDCLOUD_PUBLIC_KEY;
const SENDCLOUD_SECRET_KEY = process.env.SENDCLOUD_SECRET_KEY;
const SENDCLOUD_API_V2 = "https://panel.sendcloud.sc/api/v2"; // pour /parcels
const SENDCLOUD_API_V3 = "https://panel.sendcloud.sc/api/v3"; // pour /service-points

const sendcloudAuth = Buffer.from(
  `${SENDCLOUD_PUBLIC_KEY}:${SENDCLOUD_SECRET_KEY}`
).toString("base64");

// ✅ PAYPAL CONFIG - PRODUCTION
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = "https://api-m.paypal.com";

console.log("🔐 PayPal Production Mode");
console.log(`✅ Client ID: ${PAYPAL_CLIENT_ID?.substring(0, 20)}...`);

// ✅ CONFIG PAYPAL POUR LE FRONT
app.get("/api/paypal-config", (req, res) => {
  res.json({ clientId: PAYPAL_CLIENT_ID });
});

// ✅ CODES PROMO VALIDES
const VALID_PROMO_CODES = {
  "PROMO10": 0.10,
  "BIENVENUE10": 0.10
};

function getDiscountPercent(code) {
  if (!code) return 0;
  const normalized = code.trim().toUpperCase();
  return VALID_PROMO_CODES[normalized] || 0;
}

// ✅ VALIDATION CODE PROMO
app.post("/api/validate-promo", (req, res) => {
  const { code } = req.body;
  const discountPercent = getDiscountPercent(code);

  if (discountPercent > 0) {
    res.json({ valid: true, discountPercent });
  } else {
    res.json({ valid: false, discountPercent: 0 });
  }
});

// ✅ LISTE DES PRODUITS
app.get("/api/products", (req, res) => {
  try {
    const data = fs.readFileSync(path.join(__dirname, "public/products.json"), "utf-8");
    res.json(JSON.parse(data));
  } catch (err) {
    console.error("❌ Erreur lecture products.json:", err.message);
    res.status(500).json({ error: "Impossible de charger les produits" });
  }
});

// ✅ CONFIG GÉNÉRALE
app.get("/api/config", (req, res) => {
  try {
    const configPath = path.join(__dirname, "public/config.json");
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, "utf-8");
      res.json(JSON.parse(data));
    } else {
      res.json({});
    }
  } catch (err) {
    console.error("❌ Erreur lecture config.json:", err.message);
    res.status(500).json({ error: "Impossible de charger la config" });
  }
});

// ✅ CRÉER UN PARCEL SENDCLOUD (API v2)
async function createSendcloudParcel(order) {
  if (!order.relayPoint) {
    console.log("ℹ️ Pas de point relais, envoi Sendcloud ignoré");
    return null;
  }

  try {
    const payload = {
      parcel: {
        name: order.customer?.name || "Client",
        company_name: "",
        email: order.customer?.email || "",
        telephone: order.customer?.phone || "",
        address: order.relayPoint.street || order.relayPoint.address || "",
        house_number: order.relayPoint.house_number || "",
        city: order.relayPoint.city || "",
        postal_code: order.relayPoint.postal_code || order.relayPoint.postalCode || "",
        country: order.relayPoint.country || "FR",
        weight: "1.000",
        order_number: order.orderId,
        to_service_point: parseInt(order.relayPoint.id, 10),
        request_label: false
      }
    };

    const response = await axios.post(
      `${SENDCLOUD_API_V2}/parcels`, // ✅ v2 pour les parcels
      payload,
      {
        headers: {
          Authorization: `Basic ${sendcloudAuth}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ Parcel Sendcloud créé:", response.data.parcel?.id);
    return response.data.parcel;
  } catch (error) {
    console.error("❌ Erreur création parcel Sendcloud:", error.response?.data || error.message);
    return null;
  }
}

// ============================
// ROUTE : Recherche points relais Mondial Relay via Sendcloud (API v3)
// ============================
app.get("/api/relay-points", async (req, res) => {
  const { postalCode, country } = req.query;

  console.log("🔍 Requête relay-points reçue:", { postalCode, country });

  if (!postalCode || !country) {
    return res.status(400).json({ error: "postalCode et country requis" });
  }

  try {
    const url = `${SENDCLOUD_API_V3}/service-points?` + new URLSearchParams({
      country_code: country,
      address_postal_code: postalCode,
      carrier_code: "mondial_relay"
    }).toString();

    console.log("➡️ URL Sendcloud appelée:", url);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Basic ${sendcloudAuth}`,
        "Content-Type": "application/json"
      }
    });

    const results = response.data?.data?.results || [];

    const points = results.map(point => ({
      id: point.id,
      name: point.name,
      company_name: point.name,
      street: point.address?.street,
      house_number: point.address?.house_number,
      postal_code: point.address?.postal_code,
      city: point.address?.city,
      country: point.address?.country_code
    }));

    res.json(points);
  } catch (err) {
    console.error("❌ Erreur recherche points relais - STATUS:", err.response?.status);
    console.error("❌ Erreur recherche points relais - DATA:", JSON.stringify(err.response?.data, null, 2));
    res.status(500).json({
      error: "Erreur API Sendcloud",
      details: err.response?.data || err.message
    });
  }
});

app.post("/api/order", async (req, res) => {
  console.log("📩 Route /api/order appelée avec:", JSON.stringify(req.body, null, 2));
  try {
    const order = req.body;
    order.date = new Date().toISOString();

    if (!order.orderId) {
      order.orderId = "ME3D-" + Date.now();
    }

    const ordersPath = path.join(__dirname, "data/orders.json");
    let orders = [];

    if (fs.existsSync(ordersPath)) {
      const fileContent = fs.readFileSync(ordersPath, "utf-8").trim();

      if (fileContent) {
        try {
          orders = JSON.parse(fileContent);
          if (!Array.isArray(orders)) {
            console.warn("⚠️ orders.json ne contient pas un tableau, réinitialisation");
            orders = [];
          }
        } catch (parseError) {
          console.error("⚠️ orders.json corrompu, réinitialisation:", parseError.message);
          orders = [];
        }
      }
    }

    orders.push(order);
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

    console.log("🧾 Nouvelle commande enregistrée:", order.orderId);
    if (order.relayPoint) {
      const parcel = await createSendcloudParcel(order);
      if (parcel) {
        order.sendcloudParcelId = parcel.id;
        fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));
      }
    }

    const invoicePath = path.join(invoicesDir, `facture_${order.orderId}.pdf`);

    try {
      await generateInvoice(order, invoicePath);
      console.log("✅ Facture PDF générée:", invoicePath);

      if (order.customer?.email) {
        console.log("📧 Envoi email à:", order.customer.email);
        const emailSent = await sendInvoiceEmail(
          order.customer.email,
          order.customer.name,
          invoicePath,
          order
        );

        if (emailSent) {
          console.log("✅ Email envoyé avec succès");
        } else {
          console.warn("⚠️ Échec envoi email (voir logs ci-dessus)");
        }
      } else {
        console.warn("⚠️ Pas d'email client, envoi ignoré");
      }

      const adminNotified = await sendAdminNotification(order);
      if (adminNotified) {
        console.log("✅ Notification admin envoyée");
      } else {
        console.warn("⚠️ Échec notification admin");
      }

    } catch (invoiceError) {
      console.error("❌ Erreur génération facture/email:", invoiceError.message);
      console.error(invoiceError.stack);
    }

    res.json({ success: true, orderId: order.orderId });
  } catch (err) {
    console.error("❌ Erreur enregistrement commande:", err.message);
    console.error(err.stack);
    res.status(500).json({ error: "Impossible d'enregistrer la commande", details: err.message });
  }
});

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { items, total, promoCode } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Panier vide" });
    }

    const itemsTotal = items.reduce(
      (sum, item) => sum + Math.round(Number(item.price) * Number(item.qty) * 100) / 100,
      0
    );
    const roundedItemsTotal = Math.round(itemsTotal * 100) / 100;

    const discountPercent = getDiscountPercent(promoCode);
    const discountAmount = Math.round(roundedItemsTotal * discountPercent * 100) / 100;
    const itemsTotalAfterDiscount = Math.round((roundedItemsTotal - discountAmount) * 100) / 100;

    const numericTotal = Number(total);
    if (isNaN(numericTotal) || numericTotal <= 0) {
      return res.status(400).json({ error: "Total invalide" });
    }

    const shippingCost = Math.round((numericTotal - itemsTotalAfterDiscount) * 100) / 100;

    console.log("=== DEBUG PAYPAL ORDER ===");
    console.log("Items total brut:", roundedItemsTotal);
    console.log("Code promo:", promoCode, "-> réduction:", discountPercent * 100, "%");
    console.log("Montant réduction:", discountAmount);
    console.log("Items total après réduction:", itemsTotalAfterDiscount);
    console.log("Shipping calculé:", shippingCost);
    console.log("==========================");

    if (shippingCost < 0) {
      console.error("❌ Shipping négatif ! Incohérence total front / items.");
      return res.status(400).json({ error: "Incohérence entre total et items" });
    }

    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`
    ).toString("base64");

    const finalTotal = itemsTotalAfterDiscount + shippingCost;

    const purchaseUnit = {
      amount: {
        currency_code: "EUR",
        value: finalTotal.toFixed(2),
        breakdown: {
          item_total: {
            currency_code: "EUR",
            value: roundedItemsTotal.toFixed(2),
          },
          shipping: {
            currency_code: "EUR",
            value: shippingCost.toFixed(2),
          },
          discount: {
            currency_code: "EUR",
            value: discountAmount.toFixed(2),
          },
        },
      },
      items: items.map((item) => ({
        name: item.name,
        unit_amount: {
          currency_code: "EUR",
          value: Number(item.price).toFixed(2),
        },
        quantity: String(item.qty),
      })),
    };

    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [purchaseUnit],
        application_context: {
          return_url: `${process.env.RETURN_URL || "http://localhost:3000"}/success`,
          cancel_url: `${process.env.RETURN_URL || "http://localhost:3000"}/cancel`,
          brand_name: "ME3D Shop",
          locale: "fr-FR",
          user_action: "PAY_NOW",
        },
      },
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Commande créée:", response.data.id);

    res.json({
      orderId: response.data.id,
      status: response.data.status,
      discountApplied: discountAmount,
    });
  } catch (error) {
    console.error("❌ Erreur création:", JSON.stringify(error.response?.data, null, 2) || error.message);
    res.status(500).json({
      error: error.response?.data?.message || "Erreur serveur",
      details: error.response?.data,
    });
  }
});

// ✅ CAPTURER LA COMMANDE PAYPAL
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "Order ID manquant" });
    }

    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    const status = response.data.status;
    const transactionId = response.data.purchase_units?.[0]?.payments?.captures?.[0]?.id 
                           || response.data.id;

    console.log("✅ Paiement capturé:", status, "| Transaction:", transactionId);
    res.json({
      success: status === "COMPLETED",
      status: status,
      transactionId: transactionId,
    });
  } catch (error) {
    console.error("❌ Erreur capture:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: error.response?.data?.message || "Erreur serveur",
    });
  }
});

// Routes statiques
app.get("/success", (req, res) => {
  res.sendFile(path.join(__dirname, "public/success"));
});

app.get("/cancel", (req, res) => {
  res.sendFile(path.join(__dirname, "public/cancel.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Démarrage
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});

module.exports = app;