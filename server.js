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
// 🛡️ SÉCURITÉ
// ========================
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: "Trop de requêtes depuis cette IP, réessayez plus tard."
});
app.use('/api/', limiter);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use('/invoices', express.static(path.join(__dirname, 'invoices')));

// ========================
// 📋 ROUTES CONFIG
// ========================

app.get('/api/paypal-config', (req, res) => {
  res.json({ clientId: process.env.PAYPAL_CLIENT_ID });
});

app.get("/api/config", (req, res) => {
  res.json(config);
});

app.get("/api/products", (req, res) => {
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, "data/products.json"), "utf-8"));
  res.json(data);
});

// ========================
// 💳 ROUTES PAYPAL
// ========================

app.post("/api/paypal/create-order", (req, res) => {
  const { items, total, pickup } = req.body;

  fetch("https://api-m.sandbox.paypal.com/v2/checkout/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${Buffer.from(
        process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET
      ).toString("base64")}`
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: "EUR",
            value: total.toFixed(2),
            breakdown: {
              item_total: { currency_code: "EUR", value: (total - (pickup ? 0 : 3.99)).toFixed(2) },
              shipping: { currency_code: "EUR", value: (pickup ? 0 : 3.99).toFixed(2) }
            }
          },
          items: items.map(item => ({
            name: item.name,
            unit_amount: { currency_code: "EUR", value: item.price.toFixed(2) },
            quantity: item.qty.toString()
          }))
        }
      ]
    })
  })
    .then(res => res.json())
    .then(data => {
      if (data.id) {
        res.json({ orderId: data.id });
      } else {
        res.status(400).json({ error: data });
      }
    })
    .catch(err => res.status(500).json({ error: err.message }));
});

// Capture la commande PayPal après approbation du client
app.post("/api/paypal/capture-order",
  [
    body('customer.name').trim().escape().notEmpty(),
    body('customer.email').isEmail().normalizeEmail(),
    body('customer.address').trim().escape().optional()
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { orderId, customer, items, total, pickup } = req.body;

    try {
      const captureResponse = await fetch(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${Buffer.from(
            process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_SECRET
          ).toString("base64")}`
        }
      });

      const data = await captureResponse.json();

      if (data.status === "COMPLETED") {
        const order = {
          orderId: data.id,
          date: new Date().toISOString(),
          customer: {
            name: customer.name,
            email: customer.email,
            address: customer.address || "",
            pickup: pickup || false
          },
          items: items,
          total: parseFloat(total),
          shipping: pickup ? 0 : 3.99,
          paypalTransactionId: data.id
        };

        let orders = [];
        if (fs.existsSync(ordersFile)) {
          orders = JSON.parse(fs.readFileSync(ordersFile, "utf-8"));
        }
        orders.push(order);
        fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
        console.log("✅ Commande enregistrée :", order.orderId);

        try {
          const invoicePath = path.join(__dirname, `invoices/facture_${orderId}.pdf`);
          await generateInvoice(order, invoicePath);
          console.log("✅ Facture générée :", invoicePath);

          const emailSent = await sendInvoiceEmail(
            customer.email,
            customer.name,
            invoicePath,
            order
          );

          if (emailSent) {
            console.log("✅ Email envoyé à :", customer.email);
          } else {
            console.warn("⚠️ Email non envoyé mais commande validée");
          }
        } catch (invoiceError) {
          console.error("⚠️ Erreur lors de la génération/envoi de la facture :", invoiceError.message);
        }

        res.json({
          success: true,
          transactionId: data.id,
          message: "Commande validée ! Facture envoyée par email."
        });
      } else {
        res.status(400).json({ error: "Paiement non complété", status: data.status });
      }
    } catch (err) {
      console.error("❌ Erreur lors de la capture PayPal :", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// ========================
// 📦 ROUTES COMMANDES
// ========================

app.post("/api/order", async (req, res) => {
  try {
    const { orderId, customer, items, total, pickup } = req.body;

    const order = {
      orderId,
      date: new Date().toISOString(),
      customer: {
        name: customer.name,
        email: customer.email,
        address: customer.address || "",
        pickup: pickup || false
      },
      items: items,
      total: parseFloat(total),
      shipping: pickup ? 0 : 3.99
    };

    let orders = [];
    if (fs.existsSync(ordersFile)) {
      orders = JSON.parse(fs.readFileSync(ordersFile, "utf-8"));
    }
    orders.push(order);
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2));
    console.log("✅ Commande enregistrée :", order.orderId);

    try {
      const invoicePath = path.join(__dirname, `invoices/facture_${orderId}.pdf`);
      await generateInvoice(order, invoicePath);
      console.log("✅ Facture générée :", invoicePath);

      await sendInvoiceEmail(
        customer.email,
        customer.name,
        invoicePath,
        order
      );
      console.log("✅ Email envoyé à :", customer.email);
    } catch (invoiceError) {
      console.error("⚠️ Erreur facture :", invoiceError.message);
    }

    res.json({
      success: true,
      invoicePath: `/invoices/facture_${orderId}.pdf`,
      message: "Commande validée et facture envoyée !"
    });
  } catch (error) {
    console.error("❌ Erreur lors du traitement de la commande :", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get("/api/orders", (req, res) => {
  try {
    if (fs.existsSync(ordersFile)) {
      const orders = JSON.parse(fs.readFileSync(ordersFile, "utf-8"));
      res.json(orders);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========================
// ⚠️ GESTION D'ERREURS (doit être en dernier, avant listen)
// ========================
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Une erreur est survenue, réessayez plus tard." });
});

// ========================
// 🚀 LANCEMENT
// ========================
app.listen(PORT, () => {
  console.log(`\n🎃 EM3DSHOP lancé ! Ouvre ton navigateur sur : http://localhost:${PORT}\n`);
});