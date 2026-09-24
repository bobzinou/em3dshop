// server.js
const express = require("express");
const axios = require("axios");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

dotenv.config();

const app = express();

// ✅ CRÉER LES DOSSIERS S'ILS N'EXISTENT PAS (RENDER)
const dataDir = path.join(__dirname, "data");
const invoicesDir = path.join(__dirname, "invoices");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

const ordersFile = path.join(dataDir, "orders.json");
if (!fs.existsSync(ordersFile)) fs.writeFileSync(ordersFile, JSON.stringify([]));

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

// ... rest du code