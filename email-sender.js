// email-sender.js
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// ✅ Configure le transporteur Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS
  }
});

// ✅ Fonction pour envoyer la facture au CLIENT
async function sendInvoiceEmail(clientEmail, clientName, invoicePath, order) {
  try {
    if (!fs.existsSync(invoicePath)) {
      console.warn(`⚠️ Fichier PDF introuvable: ${invoicePath}`);
      return false;
    }

    const totalAmount = order.customer?.total || order.total || "N/A";

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: clientEmail,
      subject: `✅ Facture reçue - Commande ${order.orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9;">
          <h2 style="color: #667eea; text-align: center;">📋 Votre Facture</h2>
          <hr style="border: none; border-top: 2px solid #667eea;">
          
          <p>Bonjour <strong>${clientName}</strong>,</p>
          
          <p>Merci pour votre commande ! Vous trouverez ci-joint votre facture détaillée.</p>
          
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="font-size: 14px;"><strong>📦 Numéro de commande :</strong> ${order.orderId}</p>
            <p style="font-size: 14px;"><strong>📅 Date :</strong> ${new Date(order.date).toLocaleDateString('fr-FR')}</p>
            <p style="font-size: 14px;"><strong>💰 Montant total :</strong> <span style="color: #667eea; font-size: 16px;"><strong>${totalAmount}€</strong></span></p>
          </div>
          
          <h4>📦 Articles commandés :</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr style="background: #667eea; color: white;">
              <th style="padding: 10px; text-align: left;">Produit</th>
              <th style="padding: 10px; text-align: center;">Quantité</th>
              <th style="padding: 10px; text-align: right;">Prix</th>
            </tr>
            ${order.items?.map(item => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 10px;">${item.name}</td>
                <td style="padding: 10px; text-align: center;">${item.qty || item.quantity}</td>
                <td style="padding: 10px; text-align: right;">${Number(item.price).toFixed(2)}€</td>
              </tr>
            `).join('') || '<tr><td colspan="3" style="padding: 10px; text-align: center; color: #999;">Aucun article</td></tr>'}
          </table>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
          
          <h4>📍 Informations de livraison :</h4>
          <div style="background: #f0f0f0; padding: 15px; border-radius: 5px;">
            <p style="margin: 0; font-size: 14px; line-height: 1.8;">
              <strong>${order.customer?.name || 'Client'}</strong><br>
              ${order.customer?.address || 'N/A'}<br>
              ${order.customer?.zipcode || ''} ${order.customer?.city || ''}<br>
              📧 ${order.customer?.email || 'N/A'}<br>
              📱 ${order.customer?.phone || 'N/A'}
            </p>
          </div>
          
          <p style="font-size: 12px; color: #999; margin-top: 30px; text-align: center;">
            Merci pour votre achat ! Vous recevrez bientôt votre commande.
          </p>
          
          <p style="font-size: 11px; color: #999; margin-top: 20px; text-align: center; border-top: 1px solid #ddd; padding-top: 15px;">
            ME3D Shop - Tous droits réservés
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `facture_${order.orderId}.pdf`,
          path: invoicePath
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email client envoyé:', info.response);
    return true;

  } catch (err) {
    console.error('❌ Erreur envoi email client:', err.message);
    return false;
  }
}

// ✅ Fonction pour notifier l'ADMIN
async function sendAdminNotification(order) {
  try {
    const itemsList = order.items
      ?.map(item => `- ${item.name} x${item.qty || item.quantity} : ${item.price}€`)
      .join("\n") || "Détails non disponibles";

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `🛒 Nouvelle commande reçue - ${order.orderId}`,
      text: `
Nouvelle commande enregistrée !

📦 N° commande : ${order.orderId}
📅 Date : ${new Date(order.date).toLocaleString("fr-FR")}

👤 Client :
- Nom : ${order.customer?.name || "N/A"}
- Email : ${order.customer?.email || "N/A"}

🏠 Adresse de livraison :
${order.customer?.address || "N/A"}

🛍️ Articles commandés :
${itemsList}

💰 Total : ${order.total || order.customer?.total || "N/A"}€

---
Facture générée et envoyée automatiquement au client.
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email admin envoyé:', info.response);
    return true;

  } catch (err) {
    console.error("Erreur envoi notification admin:", err.message);
    return false;
  }
}

// Export des fonctions (UNE SEULE FOIS, à la fin)
module.exports = {
  sendInvoiceEmail,
  sendAdminNotification
};