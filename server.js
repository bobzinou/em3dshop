// server.js
const dotenv = require("dotenv");
dotenv.config(); // ✅ TOUJOURS EN PREMIER, avant tout le reste

const { generateInvoice } = require("./invoice-generator");
const express = require("express");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const { sendInvoiceEmail, sendAdminNotification } = require("./email-sender"); // adapte le chemin
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
			

//  RATE LIMIT SANS PROBLÈME IPv6
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

app.use(limiter);
	   
  // ✅ SENDCLOUD CONFIG
const SENDCLOUD_PUBLIC_KEY = process.env.SENDCLOUD_PUBLIC_KEY;
const SENDCLOUD_SECRET_KEY = process.env.SENDCLOUD_SECRET_KEY;
const SENDCLOUD_API = "https://panel.sendcloud.sc/api/v3";

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
	 
 // ✅ CRÉER UN PARCEL SENDCLOUD (Mondial Relay)
async function createSendcloudParcel(order) {
  if (!order.relayPoint) {
    console.log("ℹ️ Pas de point relais, envoi Sendcloud ignoré");
    return null;
  }

  try {
    const nameParts = (order.customer?.name || "Client").split(" ");
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const payload = {
      parcel: {
        name: order.customer?.name || "Client",
        company_name: "",
        email: order.customer?.email || "",
        telephone: order.customer?.phone || "",
        address: order.relayPoint.address || "",
        house_number: "",
        city: order.relayPoint.city || "",
        postal_code: order.relayPoint.postalCode || "",
        country: order.relayPoint.country || "FR",
        weight: "1.000", // ✅ à ajuster selon ton produit, en kg
        order_number: order.orderId,
        to_service_point: order.relayPoint.id,
        carrier: "mondial_relay",
        request_label: false // ✅ passe à true si tu veux générer l'étiquette direct
      }
    };

    const response = await axios.post(
      `${SENDCLOUD_API}/parcels`,
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
// ✅ RECHERCHE DE POINTS RELAIS MONDIAL RELAY
// ============================
// ROUTE : Recherche points relais Mondial Relay via Sendcloud
// ============================
app.get("/api/relay-points", async (req, res) => {
  const { postalCode, country } = req.query;

  console.log("🔍 Requête relay-points reçue:", { postalCode, country });

  if (!postalCode || !country) {
    return res.status(400).json({ error: "postalCode et country requis" });
  }

  try {
    const url = `${SENDCLOUD_API}/service-points?` + new URLSearchParams({
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
    console.error("❌ Erreur recherche points relais:", err.response?.data || err.message);
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

    // ✅ Génère un orderId s'il n'existe pas
    if (!order.orderId) {
      order.orderId = "ME3D-" + Date.now();
    }

    const ordersPath = path.join(__dirname, "data/orders.json");
    let orders = [];

    // ✅ FIX : lecture robuste (gère fichier vide ou corrompu)
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
      // si fileContent est vide, orders reste = []
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
    // ✅ Génère la facture PDF
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

      // ✅ NOUVEAU : notification admin
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
    const { items, total } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ error: "Panier vide" });
    }

    const numericTotal = Number(total);

    if (isNaN(numericTotal) || numericTotal <= 0) {
      return res.status(400).json({ error: "Total invalide" });
    }

    // ✅ Calcul du sous-total réel à partir des items (avec arrondi correct)
    const itemsTotal = items.reduce(
      (sum, item) => sum + Math.round(Number(item.price) * Number(item.qty) * 100) / 100,
      0
    );

    const roundedItemsTotal = Math.round(itemsTotal * 100) / 100;
    const shippingCost = Math.round((numericTotal - roundedItemsTotal) * 100) / 100;

    // 🔍 LOG DE DEBUG - à garder temporairement
    console.log("=== DEBUG PAYPAL ORDER ===");
    console.log("Items reçus:", JSON.stringify(items, null, 2));
    console.log("Total envoyé par le front:", numericTotal);
    console.log("Items total calculé:", roundedItemsTotal);
    console.log("Shipping calculé:", shippingCost);
    console.log("==========================");

    if (shippingCost < 0) {
      console.error("❌ Shipping négatif ! Le total front est inférieur au total des items.");
      return res.status(400).json({ error: "Incohérence entre total et items" });
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
              value: (roundedItemsTotal + shippingCost).toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: "EUR",
                  value: roundedItemsTotal.toFixed(2),
                },
                shipping: {
                  currency_code: "EUR",
                  value: shippingCost.toFixed(2),
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
    const { orderId } = req.body; // ✅ le front envoie "orderId" (minuscule d)
				  

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
      success: status === "COMPLETED", // ✅ ton front vérifie "result.success"
      status: status,
      transactionId: transactionId,     // ✅ ton front utilise "result.transactionId"
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
