const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

function generateInvoice(order) {
  return new Promise((resolve, reject) => {
    const invoicesDir = path.join(__dirname, 'invoices');
    if (!fs.existsSync(invoicesDir)) {
      fs.mkdirSync(invoicesDir);
    }

    const filePath = path.join(invoicesDir, `facture-${order.orderId}.pdf`);
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // En-tête
    doc.fontSize(20).text('EM3DSHOP', { align: 'left' });
    doc.fontSize(10).text('Impressions 3D artisanales', { align: 'left' });
    doc.moveDown();
    doc.fontSize(16).text('FACTURE', { align: 'right' });
    doc.fontSize(10).text(`N° commande : ${order.orderId}`, { align: 'right' });
    doc.text(`Date : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
    doc.moveDown(2);

    // Infos client
    doc.fontSize(12).text('Facturé à :', { underline: true });
    doc.fontSize(10).text(order.customer.name);
    doc.text(order.customer.email);
    if (!order.customer.pickup && order.customer.address) {
      doc.text(order.customer.address);
    } else {
      doc.text('Retrait en main propre - Le Plessis-Bouchard');
    }
    doc.moveDown(2);

    // Tableau produits
    doc.fontSize(12).text('Détail de la commande', { underline: true });
    doc.moveDown(0.5);

    const tableTop = doc.y;
    doc.fontSize(10);
    doc.text('Produit', 50, tableTop);
    doc.text('Qté', 300, tableTop);
    doc.text('Prix unit.', 370, tableTop);
    doc.text('Total', 470, tableTop);
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    order.items.forEach(item => {
      const y = doc.y;
      doc.text(item.name, 50, y, { width: 240 });
      doc.text(item.qty.toString(), 300, y);
      doc.text(`${item.price.toFixed(2)}€`, 370, y);
      doc.text(`${(item.price * item.qty).toFixed(2)}€`, 470, y);
      doc.moveDown();
    });

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const shippingCost = order.customer.pickup ? 0 : 3.99;
    const subtotal = order.items.reduce((sum, i) => sum + i.price * i.qty, 0);

    doc.text(`Sous-total : ${subtotal.toFixed(2)}€`, { align: 'right' });
    doc.text(`Livraison : ${shippingCost.toFixed(2)}€`, { align: 'right' });
    doc.fontSize(12).text(`TOTAL : ${order.total}€`, { align: 'right' });

    doc.moveDown(3);
    doc.fontSize(9).fillColor('gray').text(
      'Merci pour votre commande sur EM3DSHOP - Ceci est une facture de test générée en mode Sandbox PayPal.',
      { align: 'center' }
    );

    doc.end();

    stream.on('finish', () => resolve(filePath));
    stream.on('error', reject);
  });
}

module.exports = generateInvoice;