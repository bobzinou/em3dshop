require('dotenv').config();
const nodemailer = require('nodemailer');

console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASSWORD:", process.env.EMAIL_PASSWORD ? "***" + process.env.EMAIL_PASSWORD.slice(-4) : "NON DÉFINI");

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

transporter.sendMail({
  from: process.env.EMAIL_USER,
  to: process.env.EMAIL_USER, // s'envoie à toi-même pour tester
  subject: "Test ME3DSHOP",
  text: "Si tu reçois ça, la config email fonctionne !"
}, (error, info) => {
  if (error) {
    console.error("❌ ERREUR:", error.message);
  } else {
    console.log("✅ SUCCÈS:", info.response);
  }
});