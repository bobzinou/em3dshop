require('dotenv').config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const config = require("./config");
const { generateInvoice } = require('./invoice-generator');
const { sendInvoiceEmail } = require('./email-sender');

const app = express();
const PORT = 3000;
const ordersFile = path.join(__dirname, "data/orders.json");

// ========================
// 🔒 SÉCURITÉ
// ========================

app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
	scriptSrc: ["'self'", "https://www.paypal.com", "https://js.paypal.com", "'unsafe-inline'"],
    frameSrc: ["https://www.paypal.com", "https://www.sandbox.paypal.com"],
    connectSrc: ["'self'", "https://api-m.sandbox.paypal.com", "https://api.paypal.com", "https://www.sandbox.paypal.com", "https://www.paypalobjects.com"],
    imgSrc: ["'self'", "data:", "https://www.paypalobjects.com", "https://www.sandbox.paypal.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://www.paypalobjects.com"],
    fontSrc: ["'self'", "https://www.paypalobjects.com"]
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// ========================
// 🔧 CONFIG & PRODUITS
// ========================

app.get('/api/paypal-config', (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

app.get("/api/config", (req, res) => {
  res.json(config);
});

app.get("/api/products", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/products.json"), "utf-8"));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Erreur chargement produits" });
  }
});

// ========================
// 💳 PAYPAL - CREATE ORDER
// ========================

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { items, total, customer } = req.body;

    if (!items || !total || !customer) {
      return res.status(400).json({ error: "Données manquantes" });
    }

    const response = await fetch(
      "https://api-m.sandbox.paypal.com/v2/checkout/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET
          ).toString("base64")}`
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{
            amount: {
              value: parseFloat(total).toFixed(2),
              currency_code: "EUR"
            }
          }]
        })
      }
    );

    const order = await response.json();

    if (!order.id) {
      return res.status(400).json({ error: "Erreur création commande PayPal" });
    }

    res.json({ orderId: order.id });
  } catch (err) {
    console.error("❌ Erreur create-order :", err);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 💳 PAYPAL - CAPTURE ORDER
// ========================

app.post("/api/paypal/capture-order", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "OrderID manquant" });
    }

    const response = await fetch(
      `https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${Buffer.from(
            process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET
          ).toString("base64")}`
        }
      }
    );

    const orderData = await response.json();

    if (orderData.status === "COMPLETED") {
      console.log("✅ Commande PayPal validée :", orderData.id);
      res.json({ success: true, transactionId: orderData.id });
    } else {
      res.status(400).json({ error: "Paiement non complété", status: orderData.status });
    }
  } catch (err) {
    console.error("❌ Erreur capture-order :", err);
    res.status(500).json({ error: err.message });
  }
});

// ========================
// 📦 ENREGISTREMENT COMMANDE
// ========================

app.post("/api/order", 
  [
    body('customer.name').trim().escape().notEmpty(),
    body('customer.email').isEmail().normalizeEmail(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const order = req.body;
      order.date = new Date().toISOString();

      console.log('📝 Commande reçue:', order.orderId);

      let orders = [];
      if (fs.existsSync(ordersFile)) {
        orders = JSON.parse(fs.readFileSync(ordersFile, "utf-8"));
      }
      orders.push(order);
      fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));

      console.log('💾 Commande sauvegardée');

      // Génère la facture PDF
      const invoicePath = path.join(__dirname, 'invoices', `${order.orderId || 'invoice'}_${Date.now()}.pdf`);
      
      console.log('🖨️ Génération facture:', invoicePath);
      await generateInvoice(order, invoicePath);
      console.log('✅ Facture générée');

      // Envoie par email
      if (order.customer.email) {
        console.log('📧 Envoi email à:', order.customer.email);
        const emailResult = await sendInvoiceEmail(order.customer.email, order.customer.name, invoicePath, order);
        console.log('📧 Résultat email:', emailResult);
      } else {
        console.log('⚠️ Pas d\'email client');
      }

      console.log("✅ Commande enregistrée :", order.orderId || order.transactionId);
      res.json({ success: true, invoicePath });
    } catch (err) {
      console.error("❌ Erreur enregistrement commande :", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ========================
// 🛡️ ERROR HANDLER
// ========================

app.use((err, req, res, next) => {
  console.error("❌ Erreur serveur :", err.stack);
  res.status(500).json({ error: "Une erreur est survenue, réessayez plus tard." });
});

// ========================
// 🚀 DÉMARRAGE
// ========================

app.listen(PORT, () => {
  console.log(`\n🎃 ME3DSHOP lancé ! Ouvre : http://localhost:${PORT}\n`);
});