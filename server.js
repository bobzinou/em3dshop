// server.js
const dotenv = require("dotenv");
dotenv.config(); // TOUJOURS EN PREMIER

const express = require("express");
const helmet = require("helmet");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

const { generateInvoice } = require("./invoice-generator");
const { sendInvoiceEmail } = require("./email-sender");

const app = express();

// 📁 CRÉER LES DOSSIERS S'ILS N'EXISTENT PAS
const dataDir = path.join(__dirname, "data");
const invoicesDir = path.join(__dirname, "invoices");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

const ordersFile = path.join(dataDir, "orders.json");
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, JSON.stringify([]));

// ✅ HELMET EN PREMIER (avant tout le reste)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "https://www.paypal.com",
        "https://www.paypalobjects.com",
      ],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      frameSrc: ["https://www.paypal.com"],
      connectSrc: [
        "'self'",
        "https://www.paypal.com",
        "https://api-m.paypal.com",
      ],
    },
  },
  hsts: { maxAge: 31536000, includeSubDomains: true },
  xContentTypeOptions: true,
  xFrameOptions: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

// ✅ TRUST PROXY POUR RENDER
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ✅ RATE LIMIT (DÉFINI AVANT D'ÊTRE UTILISÉ)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.ip === '::1' || req.ip === '127.0.0.1';
  }
});

app.use(limiter); // ✅ UNE SEULE FOIS

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

// ✅ CONFIG GÉNÉRALE (thèmes, couleurs, livraison...)
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

app.post("/api/order", async (req, res) => {
     console.log("📩 Route /api/order appelée avec:", JSON.stringify(req.body, null, 2));
  try {
    const order = req.body;
    order.date = new Date().toISOString();

    // ✅ Génère un orderId s'il n'existe pas
    if (!order.orderId) {
      order.orderId = "ME3D-" + Date.now();
    }

    const ordersPath = path.join(__dirname, "data/orders.json");
    let orders = [];

    if (fs.existsSync(ordersPath)) {
      orders = JSON.parse(fs.readFileSync(ordersPath, "utf-8"));
    }

    orders.push(order);
    fs.writeFileSync(ordersPath, JSON.stringify(orders, null, 2));

    console.log("🧾 Nouvelle commande enregistrée:", order.orderId);

    // ✅ Génère la facture PDF
    const invoicePath = path.join(invoicesDir, `facture_${order.orderId}.pdf`);
    
    try {
      await generateInvoice(order, invoicePath);
      console.log("✅ Facture PDF générée:", invoicePath);

      // ✅ Envoie l'email si on a une adresse client
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
    } catch (invoiceError) {
      console.error("❌ Erreur génération facture/email:", invoiceError.message);
    }

    res.json({ success: true, orderId: order.orderId });
  } catch (err) {
    console.error("❌ Erreur enregistrement commande:", err.message);
    res.status(500).json({ error: "Impossible d'enregistrer la commande" });
  }
});

// ✅ CRÉER UNE COMMANDE PAYPAL
app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { items, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Panier vide" });
    }

    const numericTotal = Number(total);

    if (isNaN(numericTotal) || numericTotal <= 0) {
      return res.status(400).json({ error: "Total invalide" });
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
              value: numericTotal.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: "EUR",
                  value: numericTotal.toFixed(2),
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
          },
        ],
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
  res.sendFile(path.join(__dirname, "public/success.html"));
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