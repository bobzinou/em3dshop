// server.js
const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const rateLimit = require("express-rate-limit");

dotenv.config();

const app = express();

// ✅ TRUST PROXY POUR RENDER
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ RATE LIMIT SANS PROBLÈME IPv6
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

// ✅ PAYPAL CONFIG - PRODUCTION
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_SECRET = process.env.PAYPAL_SECRET;
const PAYPAL_API = "https://api-m.paypal.com";

console.log("🔐 PayPal Production Mode");
console.log(`✅ Client ID: ${PAYPAL_CLIENT_ID?.substring(0, 20)}...`);

// ✅ CRÉER UNE COMMANDE
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { items, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Panier vide" });
    }

    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders`,
      {
        intent: "CAPTURE",
        purchase_units: [
          {
            amount: {
              currency_code: "EUR",
              value: total.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: "EUR",
                  value: total.toFixed(2),
                },
              },
            },
            items: items.map((item) => ({
              name: item.name,
              unit_amount: {
                currency_code: "EUR",
                value: item.price.toFixed(2),
              },
              quantity: item.quantity,
            })),
          },
        ],
        application_context: {
          return_url: `${process.env.RETURN_URL || "http://localhost:5000"}/success`,
          cancel_url: `${process.env.RETURN_URL || "http://localhost:5000"}/cancel`,
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
      id: response.data.id,
      status: response.data.status,
    });
  } catch (error) {
    console.error("❌ Erreur création:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || "Erreur serveur",
    });
  }
});

// ✅ CAPTURER LA COMMANDE
app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderID } = req.body;

    if (!orderID) {
      return res.status(400).json({ error: "Order ID manquant" });
    }

    const auth = Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_SECRET}`
    ).toString("base64");

    const response = await axios.post(
      `${PAYPAL_API}/v2/checkout/orders/${orderID}/capture`,
      {},
      {
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Paiement capturé:", response.data.status);
    res.json({
      status: response.data.status,
      orderID: response.data.id,
    });
  } catch (error) {
    console.error("❌ Erreur capture:", error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data?.message || "Erreur serveur",
    });
  }
});

// Routes statiques
app.get("/success", (req, res) => {
  res.sendFile(path.join(__dirname, "public/success.html"));
});

app.get("/cancel", (req, res) => {
  res.sendFile(path.join(__dirname, "public/cancel.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// Démarrage
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
  console.log(`📍 http://localhost:${PORT}`);
});

module.exports = app;