const nodemailer = require('nodemailer');
const fs = require('fs');

// Configure le transporteur email
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

async function sendInvoiceEmail(customerEmail, customerName, invoicePath, order) {
  try {
    // Vérifie que le fichier existe
    if (!fs.existsSync(invoicePath)) {
      console.warn('⚠️ Fichier facture non trouvé:', invoicePath);
      return false;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: customerEmail,
      subject: `🎉 Facture ME3DSHOP - ${order.orderId}`,
      html: `
        <h2>Merci pour votre commande, ${customerName} ! 🎃</h2>
        <p>Votre commande a été validée avec succès.</p>
        
        <h3>Détails de la commande:</h3>
        <ul>
          <li><strong>Numéro:</strong> ${order.orderId}</li>
          <li><strong>Date:</strong> ${new Date(order.date).toLocaleDateString('fr-FR')}</li>
          <li><strong>Total:</strong> ${(order.total).toFixed(2)}€</li>
        </ul>

        <h3>Articles commandés:</h3>
        <ul>
          ${order.items.map(item => `<li>${item.name} (x${item.qty}) - ${(item.price * item.qty).toFixed(2)}€</li>`).join('')}
        </ul>

        ${order.customer.pickup 
          ? '<p><strong>📍 Livraison:</strong> Retrait en main propre au Plessis-Bouchard</p>'
          : `<p><strong>📍 Livraison:</strong> ${order.customer.address || 'Adresse non renseignée'}</p><p><strong>Frais de livraison:</strong> ${order.shipping || 0}€</p>`
        }

        <hr>
        <p>Votre facture est en pièce jointe.</p>
        <p>Pour toute question: <strong>contact@me3dshop.fr</strong></p>
        <p>Merci de votre confiance ! 🙏</p>
      `,
      attachments: [
        {
          filename: `facture_${order.orderId}.pdf`,
          path: invoicePath
        }
      ]
    };

    // Envoie l'email
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email envoyé:', info.response);
    return true;
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email:', error.message);
    return false;
  }
}

module.exports = { sendInvoiceEmail };