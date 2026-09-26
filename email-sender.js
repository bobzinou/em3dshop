const { Resend } = require('resend');
const fs = require('fs');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Appelé ainsi dans server.js :
// sendInvoiceEmail(order.customer.email, order.customer.name, invoicePath, order)
async function sendInvoiceEmail(destinataire, nomClient, cheminPDF, order) {
  try {
    const pdfBuffer = fs.readFileSync(cheminPDF);

    const { data, error } = await resend.emails.send({
      from: 'EM3D Shop <onboarding@resend.dev>',
      to: [destinataire],
      subject: `Votre facture - Commande ${order.orderId}`,
      html: `
        <p>Bonjour ${nomClient || ""},</p>
        <p>Merci pour votre commande <strong>${order.orderId}</strong>.</p>
        <p>Vous trouverez votre facture en pièce jointe.</p>
        <p>Cordialement,<br>ME3D Shop</p>
      `,
      attachments: [
        {
          filename: `facture_${order.orderId}.pdf`,
          content: pdfBuffer.toString('base64'),
        },
      ],
    });

    if (error) {
      console.error('❌ Erreur envoi email client:', error);
      return false;
    }

    console.log('✅ Email client envoyé:', data.id);
    return true;
  } catch (err) {
    console.error('❌ Erreur envoi email client:', err.message);
    return false;
  }
}

// Appelé ainsi dans server.js :
// sendAdminNotification(order)
async function sendAdminNotification(order) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'EM3D Shop <onboarding@resend.dev>',
      to: [process.env.EMAIL_USER],
      subject: `🧾 Nouvelle commande ${order.orderId}`,
      html: `
        <p>Nouvelle commande reçue.</p>
        <p><strong>N° commande :</strong> ${order.orderId}</p>
        <p><strong>Client :</strong> ${order.customer?.name || "N/A"} (${order.customer?.email || "N/A"})</p>
        <p><strong>Total :</strong> ${order.total || "N/A"} €</p>
        <p><strong>Date :</strong> ${order.date}</p>
      `,
    });

    if (error) {
      console.error('❌ Erreur notification admin:', error);
      return false;
    }

    console.log('✅ Notification admin envoyée:', data.id);
    return true;
  } catch (err) {
    console.error('❌ Erreur notification admin:', err.message);
    return false;
  }
}

module.exports = { sendInvoiceEmail, sendAdminNotification };