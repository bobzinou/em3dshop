const { Resend } = require('resend');
const fs = require('fs');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function sendInvoiceEmail(destinataire, nomClient, cheminPDF, order) {
  try {
    console.log("📧 Tentative d'envoi vers:", destinataire);
    console.log("📄 Fichier PDF:", cheminPDF);

    const pdfBuffer = fs.readFileSync(cheminPDF);

    const { data, error } = await resend.emails.send({
      from: 'EM3D Shop <contact@em3dshop.fr>', // ✅ domaine vérifié
      to: [destinataire],
      subject: `Votre facture - Commande ${order.orderId}`,
      html: `
        <p>Bonjour ${nomClient || ""},</p>
        <p>Merci pour votre commande <strong>${order.orderId}</strong>.</p>
        <p>Vous trouverez votre facture en pièce jointe.</p>
        <p>Cordialement,<br>EM3D Shop</p>
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

async function sendAdminNotification(order) {
  try {
    // Formate les infos de livraison
    let shippingInfo = "Retrait en main propre";
    if (order.relayPoint) {
      shippingInfo = `📦 Point Relais Mondial Relay:
${order.relayPoint.name}
${order.relayPoint.street} ${order.relayPoint.house_number || ''}
${order.relayPoint.postal_code} ${order.relayPoint.city}
Code Point: ${order.relayPoint.id}`;
    } else if (order.customer.address) {
      shippingInfo = `🚚 Livraison à domicile:
${order.customer.address}`;
    }

    const emailContent = `
    <h2>🔔 Nouvelle Commande: ${order.orderId}</h2>
    
    <h3>Client:</h3>
    <p>
      <strong>${order.customer.name}</strong><br>
      ${order.customer.email}<br>
      ${order.customer.address || 'Retrait en main propre'}
    </p>

    <h3>📦 Livraison:</h3>
    <pre>${shippingInfo}</pre>

    <h3>Articles:</h3>
    <ul>
      ${order.items.map(item => `<li>${item.name} x${item.qty} = ${(item.price * item.qty).toFixed(2)}€</li>`).join('')}
    </ul>

    <h3>Montants:</h3>
    <p>
      <strong>Sous-total:</strong> ${order.items.reduce((sum, item) => sum + (item.price * item.qty), 0).toFixed(2)}€<br>
      <strong>Livraison:</strong> ${order.customer.pickup ? '0.00' : '0.01'}€<br>
      <strong>TOTAL:</strong> ${order.total || 'N/A'}€
    </p>

    <hr>
    <p><small>Commande reçue le: ${new Date(order.date).toLocaleString('fr-FR')}</small></p>
    `;

    // Envoie l'email à l'admin
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `🔔 Nouvelle commande: ${order.orderId}`,
      html: emailContent
    });

    console.log("✅ Email admin envoyé");
    return true;
  } catch (err) {
    console.error("❌ Erreur envoi email admin:", err.message);
    return false;
  }
}

module.exports = { sendInvoiceEmail, sendAdminNotification };