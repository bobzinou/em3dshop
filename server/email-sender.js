const nodemailer = require('nodemailer');
require('dotenv').config();

// Configure le transporteur email
const transporter = nodemailer.createTransport({
  service: 'gmail', // ou un autre service email
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendInvoiceEmail(customerEmail, customerName, invoicePath, orderDetails) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customerEmail,	
      subject: `Facture EM3DSHOP - Commande ${orderDetails.orderId}`,
      html: `
        <h2>Bonjour ${customerName},</h2>
        <p>Merci pour votre commande chez <strong>EM3DSHOP</strong> ! ✨</p>
        
        <p><strong>Détails de votre commande :</strong></p>
        <ul>
          <li>Numéro de commande : <strong>${orderDetails.orderId}</strong></li>
          <li>Total : <strong>${orderDetails.total}€</strong></li>
          <li>Mode de livraison : <strong>${orderDetails.pickup ? 'Retrait en main propre au Plessis-Bouchard' : 'Livraison à domicile'}</strong></li>
        </ul>

        <p>Votre facture est jointe à cet email.</p>
        
        <p><strong>À bientôt sur EM3DSHOP ! 🎃</strong></p>
        <hr>
        <p style="font-size: 12px; color: #666;">
          © 2026 EM3DSHOP — Impressions 3D artisanales — France
        </p>
      `,
      attachments: [
        {
          path: invoicePath
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé à', customerEmail, '- Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error);
    return false;
  }
}

module.exports = { sendInvoiceEmail };