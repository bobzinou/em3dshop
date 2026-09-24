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
    // Vérifie que le fichier PDF existe
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

// ✅ Fonction pour t'envoyer une NOTIFICATION (nouvellement ajoutée)
async function sendAdminNotification(order) {
  try {
    const totalAmount = order.customer?.total || order.total || "N/A";

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: process.env.GMAIL_ADMIN || process.env.GMAIL_USER, // Envoie à TOI
      subject: `🔔 NOUVELLE COMMANDE - ${order.orderId}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff3cd; border-left: 4px solid #d63031;">
          <h2 style="color: #d63031; margin-top: 0;">🚨 NOUVELLE COMMANDE !</h2>
          
          <div style="background: white; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="font-size: 14px;"><strong>📦 Commande :</strong> ${order.orderId}</p>
            <p style="font-size: 14px;"><strong>👤 Client :</strong> ${order.customer?.name || 'N/A'}</p>
            <p style="font-size: 14px;"><strong>📧 Email :</strong> ${order.customer?.email || 'N/A'}</p>
            <p style="font-size: 14px;"><strong>📱 Téléphone :</strong> ${order.customer?.phone || 'N/A'}</p>
            <p style="font-size: 14px;"><strong>💰 Montant :</strong> <span style="font-size: 18px; color: #d63031;"><strong>${totalAmount}€</strong></span></p>
            <p style="font-size: 14px;"><strong>📅 Date :</strong> ${new Date(order.date).toLocaleDateString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
          
          <h4>📍 Livraison à :</h4>
          <p style="font-size: 14px; line-height: 1.8;">
            ${order.customer?.address || 'N/A'}<br>
            ${order.customer?.zipcode || ''} ${order.customer?.city || ''}<br>
            <strong>Type :</strong> ${order.customer?.deliveryType === 'hand' ? '🤝 En main propre' : '📬 Par courrier'}
          </p>
          
          <h4>📦 Détail des articles :</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="background: #d63031; color: white;">
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
            `).join('') || '<tr><td colspan="3" style="padding: 10px;">-</td></tr>'}
          </table>
          
          <p style="margin-top: 30px; text-align: center;">
            <a href="${process.env.RETURN_URL || 'http://localhost:3000'}/admin" style="background: #d63031; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
              📊 Voir le dashboard
            </a>
          </p>
        </div>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email admin envoyé');
    return true;

  } catch (err) {
    console.error('❌ Erreur envoi email admin:', err.message);
    return false;
  }
}

// Export des fonctions
module.exports = {
  sendInvoiceEmail,
  sendAdminNotification
};