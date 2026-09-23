const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generateInvoice(order, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      const invoicesDir = path.dirname(outputPath);
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // En-tête
      doc.fontSize(20).font('Helvetica-Bold').text('EM3DSHOP', 50, 50);
      doc.fontSize(10).font('Helvetica').text('Impressions 3D Artisanales', 50, 75);
      doc.text('Le Plessis-Bouchard, France', 50, 90);

      // Titre facture
      doc.fontSize(16).font('Helvetica-Bold').text('FACTURE', 400, 50);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Numero: ${order.orderId}`, 400, 75);
      doc.text(`Date: ${new Date(order.date).toLocaleDateString('fr-FR')}`, 400, 90);

      // Ligne séparatrice
      doc.moveTo(50, 120).lineTo(550, 120).stroke();

      // Infos client
      doc.fontSize(12).font('Helvetica-Bold').text('FACTURE A:', 50, 140);
      doc.fontSize(10).font('Helvetica');
      doc.text(order.customer.name, 50, 160);
      doc.text(order.customer.email, 50, 175);
      if (order.customer.address) {
        doc.text(order.customer.address, 50, 190);
      }

      // Tableau produits
      const tableTop = order.customer.address ? 230 : 215;
      doc.fontSize(11).font('Helvetica-Bold');
      doc.text('Produit', 50, tableTop);
      doc.text('Qty', 280, tableTop);
      doc.text('Prix U.', 350, tableTop);
      doc.text('Total', 450, tableTop);

      doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

      doc.fontSize(10).font('Helvetica');
      let yPosition = tableTop + 30;
      let subtotal = 0;

      order.items.forEach(item => {
        const lineTotal = (item.price * item.qty).toFixed(2);
        subtotal += parseFloat(lineTotal);

        doc.text(item.name.substring(0, 30), 50, yPosition);
        doc.text(item.qty.toString(), 280, yPosition);
        doc.text(`${item.price.toFixed(2)}EUR`, 350, yPosition);
        doc.text(`${lineTotal}EUR`, 450, yPosition);

        yPosition += 20;
      });

      doc.moveTo(50, yPosition + 5).lineTo(550, yPosition + 5).stroke();
      yPosition += 25;

      doc.fontSize(10).font('Helvetica');
      doc.text('Sous-total:', 350, yPosition);
      doc.text(`${subtotal.toFixed(2)}EUR`, 450, yPosition);

      yPosition += 15;
      doc.text('Livraison:', 350, yPosition);
      doc.text(`${order.shipping.toFixed(2)}EUR`, 450, yPosition);

      yPosition += 20;
      doc.fontSize(12).font('Helvetica-Bold');
      doc.text('TOTAL:', 350, yPosition);
      doc.text(`${order.total}EUR`, 450, yPosition);

      // Pied de page
      doc.fontSize(8).font('Helvetica');
      doc.text('Merci pour votre achat !', 50, 700);
      doc.text('(c) 2026 EM3DSHOP - Tous droits reserves', 50, 715);

      doc.end();

      stream.on('finish', () => resolve(outputPath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoice };