const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generateInvoice(order, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      // Crée le dossier invoices s'il n'existe pas
      const invoicesDir = path.dirname(outputPath);
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(outputPath);

      doc.pipe(stream);

      // En-tête
      doc.fontSize(24).font('Helvetica-Bold').text('EM3DSHOP', 50, 40);
      doc.fontSize(11).font('Helvetica').text('Impressions 3D Artisanales', 50, 70);
      doc.text('Le Plessis-Bouchard, France', 50, 85);

      // Titre FACTURE
      doc.fontSize(18).font('Helvetica-Bold').text('FACTURE', 400, 50);

      // Info commande
      doc.fontSize(10).font('Helvetica');
      doc.text(`Numéro: ${order.orderId}`, 400, 80);
      doc.text(`Date: ${new Date(order.date).toLocaleDateString('fr-FR')}`, 400, 95);

      // Séparation
      doc.moveTo(50, 120).lineTo(550, 120).stroke();

      // Facturé à
      doc.fontSize(12).font('Helvetica-Bold').text('FACTURÉ À:', 50, 140);
      doc.fontSize(10).font('Helvetica');
      doc.text(order.customer.name, 50, 160);
      doc.text(order.customer.email, 50, 175);
      if (order.customer.address) {
        doc.text(order.customer.address, 50, 190);
      } else {
        doc.text('📍 Retrait en main propre', 50, 190);
      }

      // Tableau produits
      const tableTop = 240;
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Produit', 50, tableTop);
      doc.text('Qty', 280, tableTop);
      doc.text('Prix U.', 330, tableTop);
      doc.text('Total', 430, tableTop);

      // Ligne
      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      // Articles
      doc.fontSize(10).font('Helvetica');
      let yPosition = tableTop + 25;
      let subtotal = 0;

      order.items.forEach(item => {
        const lineTotal = (item.price * item.qty).toFixed(2);
        subtotal += parseFloat(lineTotal);

        // Texte
        doc.text(item.name.substring(0, 35), 50, yPosition, { width: 220 });
        doc.text(item.qty.toString(), 280, yPosition);
        doc.text(item.price.toFixed(2) + '€', 330, yPosition);
        doc.text(lineTotal + '€', 430, yPosition);

        yPosition += 20;
      });

      // Sous-total
      yPosition += 10;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 15;

      doc.font('Helvetica').fontSize(10);
      doc.text(`Sous-total:`, 330, yPosition);
      doc.text(subtotal.toFixed(2) + '€', 430, yPosition);

      yPosition += 20;
      doc.text(`Livraison:`, 330, yPosition);
      const shippingCost = order.shipping || 0;
      doc.text(shippingCost.toFixed(2) + '€', 430, yPosition);

      // Total
      yPosition += 25;
      doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
      yPosition += 15;
      doc.fontSize(14).font('Helvetica-Bold');
      doc.text(`TOTAL:`, 330, yPosition);
      doc.text((subtotal + shippingCost).toFixed(2) + '€', 420, yPosition);

      // Footer
      yPosition = 720;
      doc.fontSize(9).font('Helvetica').text('Merci de votre achat ! 🎉', 50, yPosition);
      doc.text('Pour toute question : contact@me3dshop.fr', 50, yPosition + 15);

      doc.end();

      stream.on('finish', () => {
        console.log('PDF créé:', outputPath);
        resolve(outputPath);
      });

      stream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateInvoice };