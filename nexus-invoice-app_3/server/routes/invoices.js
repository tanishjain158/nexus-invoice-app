const express = require('express');
const db = require('../db');
const { renderInvoicePdf } = require('../pdf/render');

const router = express.Router();

function nextInvoiceNo(exporterId) {
  const exporter = db.prepare('SELECT * FROM exporters WHERE id = ?').get(exporterId);
  const prefix = exporter.invoice_prefix || 'NXUAE';
  const rows = db.prepare(`SELECT invoice_no FROM invoices WHERE invoice_no LIKE ?`).all(`${prefix}%`);
  let max = 100;
  for (const r of rows) {
    const suffix = r.invoice_no.slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && num > max) max = num;
  }
  const next = max + 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

function computeAndPersistItems(invoiceId, items) {
  const insertItem = db.prepare(`INSERT INTO invoice_items
    (invoice_id, product_id, sort_order, pack_size, batch_no, mfg_date, exp_date, quantity, cif_rate, amount)
    VALUES (@invoice_id, @product_id, @sort_order, @pack_size, @batch_no, @mfg_date, @exp_date, @quantity, @cif_rate, @amount)`);
  const insertPacking = db.prepare(`INSERT INTO packing_lines
    (invoice_item_id, dimensions_mm, qty_per_package, no_of_packages, box_from, box_to, nw_per_package_kg, gw_per_package_kg)
    VALUES (@invoice_item_id, @dimensions_mm, @qty_per_package, @no_of_packages, @box_from, @box_to, @nw_per_package_kg, @gw_per_package_kg)`);
  const getProduct = db.prepare('SELECT * FROM products WHERE id = ?');

  let boxCounter = 1;
  items.forEach((it, idx) => {
    const product = getProduct.get(it.product_id);
    const quantity = Number(it.quantity);
    const cif_rate = Number(it.cif_rate);
    const amount = Math.round(quantity * cif_rate * 100) / 100;
    const itemInfo = insertItem.run({
      invoice_id: invoiceId,
      product_id: it.product_id,
      sort_order: idx,
      pack_size: it.pack_size || product.pack_size,
      batch_no: it.batch_no || '',
      mfg_date: it.mfg_date || '',
      exp_date: it.exp_date || '',
      quantity,
      cif_rate,
      amount,
    });
    const itemId = itemInfo.lastInsertRowid;

    let packingLines = it.packing;
    if (!packingLines || !packingLines.length) {
      const qtyPerPkg = product.qty_per_package || 1;
      packingLines = [{
        dimensions_mm: product.dimensions_mm,
        qty_per_package: qtyPerPkg,
        no_of_packages: Math.ceil(quantity / qtyPerPkg),
        nw_per_package_kg: product.nw_per_package_kg,
        gw_per_package_kg: product.gw_per_package_kg,
      }];
    }
    for (const pl of packingLines) {
      const noOfPackages = Number(pl.no_of_packages);
      const boxFrom = boxCounter;
      const boxTo = boxCounter + noOfPackages - 1;
      boxCounter = boxTo + 1;
      insertPacking.run({
        invoice_item_id: itemId,
        dimensions_mm: pl.dimensions_mm || '',
        qty_per_package: pl.qty_per_package,
        no_of_packages: noOfPackages,
        box_from: boxFrom,
        box_to: boxTo,
        nw_per_package_kg: pl.nw_per_package_kg,
        gw_per_package_kg: pl.gw_per_package_kg,
      });
    }
  });
}

function getFullInvoice(id) {
  const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!invoice) return null;
  const exporter = db.prepare('SELECT * FROM exporters WHERE id = ?').get(invoice.exporter_id);
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(invoice.customer_id);
  const items = db.prepare(`SELECT ii.*, p.name AS product_name, p.hs_code AS hs_code FROM invoice_items ii
    JOIN products p ON p.id = ii.product_id WHERE ii.invoice_id = ? ORDER BY ii.sort_order`).all(id);
  for (const item of items) {
    item.packing = db.prepare('SELECT * FROM packing_lines WHERE invoice_item_id = ? ORDER BY box_from').all(item.id);
  }
  const totals = {
    total_invoice_value: items.reduce((s, i) => s + i.amount, 0),
    total_packages: items.reduce((s, i) => s + i.packing.reduce((a, p) => a + p.no_of_packages, 0), 0),
    total_net_weight: items.reduce((s, i) => s + i.packing.reduce((a, p) => a + p.no_of_packages * p.nw_per_package_kg, 0), 0),
    total_gross_weight: items.reduce((s, i) => s + i.packing.reduce((a, p) => a + p.no_of_packages * p.gw_per_package_kg, 0), 0),
  };
  totals.fob_value = totals.total_invoice_value - (invoice.sea_freight_charges || 0) - (invoice.insurance_charges || 0);
  return { invoice, exporter, customer, items, totals };
}

router.get('/', (req, res) => {
  const rows = db.prepare(`SELECT i.*, c.name AS customer_name,
      (SELECT SUM(amount) FROM invoice_items WHERE invoice_id = i.id) AS total_value
    FROM invoices i JOIN customers c ON c.id = i.customer_id
    ORDER BY i.invoice_date DESC, i.id DESC`).all();
  res.json(rows);
});

router.get('/next-number', (req, res) => {
  const exporterId = req.query.exporter_id || 1;
  res.json({ invoice_no: nextInvoiceNo(exporterId) });
});

router.get('/:id', (req, res) => {
  const full = getFullInvoice(req.params.id);
  if (!full) return res.status(404).json({ error: 'Not found' });
  res.json(full);
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.customer_id || !b.items || !b.items.length) {
    return res.status(400).json({ error: 'customer_id and at least one item are required' });
  }
  const exporterId = b.exporter_id || 1;
  const invoiceNo = b.invoice_no || nextInvoiceNo(exporterId);

  const tx = db.transaction(() => {
    const stmt = db.prepare(`INSERT INTO invoices
      (invoice_no, invoice_date, exporter_id, customer_id, exporters_ref, buyer_order_no, buyer_order_date,
       other_references, country_of_origin, country_of_final_destination, pre_carriage_by, place_of_receipt,
       vessel_name, port_of_loading, seaport_of_discharge, final_destination, delivery_terms, payment_terms,
       container_no, c_seal_number, a_seal_number, sea_freight_charges, insurance_charges, bill_number, bill_date, status)
      VALUES (@invoice_no, @invoice_date, @exporter_id, @customer_id, @exporters_ref, @buyer_order_no, @buyer_order_date,
       @other_references, @country_of_origin, @country_of_final_destination, @pre_carriage_by, @place_of_receipt,
       @vessel_name, @port_of_loading, @seaport_of_discharge, @final_destination, @delivery_terms, @payment_terms,
       @container_no, @c_seal_number, @a_seal_number, @sea_freight_charges, @insurance_charges, @bill_number, @bill_date, @status)`);
    const info = stmt.run({
      invoice_no: invoiceNo,
      invoice_date: b.invoice_date || new Date().toISOString().slice(0, 10),
      exporter_id: exporterId,
      customer_id: b.customer_id,
      exporters_ref: b.exporters_ref || '',
      buyer_order_no: b.buyer_order_no || '',
      buyer_order_date: b.buyer_order_date || '',
      other_references: b.other_references || '',
      country_of_origin: b.country_of_origin || 'INDIA',
      country_of_final_destination: b.country_of_final_destination || '',
      pre_carriage_by: b.pre_carriage_by || 'SEA',
      place_of_receipt: b.place_of_receipt || '',
      vessel_name: b.vessel_name || '',
      port_of_loading: b.port_of_loading || '',
      seaport_of_discharge: b.seaport_of_discharge || '',
      final_destination: b.final_destination || '',
      delivery_terms: b.delivery_terms || '',
      payment_terms: b.payment_terms || '',
      container_no: b.container_no || '',
      c_seal_number: b.c_seal_number || '',
      a_seal_number: b.a_seal_number || '',
      sea_freight_charges: Number(b.sea_freight_charges || 0),
      insurance_charges: Number(b.insurance_charges || 0),
      bill_number: b.bill_number || '',
      bill_date: b.bill_date || '',
      status: b.status || 'draft',
    });
    computeAndPersistItems(info.lastInsertRowid, b.items);
    return info.lastInsertRowid;
  });

  try {
    const id = tx();
    res.status(201).json(getFullInvoice(id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.put('/:id', (req, res) => {
  const b = req.body;
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const tx = db.transaction(() => {
    const fields = ['invoice_date', 'customer_id', 'exporters_ref', 'buyer_order_no', 'buyer_order_date',
      'other_references', 'country_of_origin', 'country_of_final_destination', 'pre_carriage_by', 'place_of_receipt',
      'vessel_name', 'port_of_loading', 'seaport_of_discharge', 'final_destination', 'delivery_terms', 'payment_terms',
      'container_no', 'c_seal_number', 'a_seal_number', 'sea_freight_charges', 'insurance_charges', 'bill_number',
      'bill_date', 'status'];
    const updates = fields.filter(f => f in b);
    if (updates.length) {
      const stmt = db.prepare(`UPDATE invoices SET ${updates.map(f => `${f} = @${f}`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`);
      stmt.run({ ...b, id: req.params.id });
    }
    if (b.items) {
      db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
      computeAndPersistItems(req.params.id, b.items);
    }
  });

  try {
    tx();
    res.json(getFullInvoice(req.params.id));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.get('/:id/pdf', async (req, res) => {
  const full = getFullInvoice(req.params.id);
  if (!full) return res.status(404).json({ error: 'Not found' });
  try {
    const pdfBuffer = await renderInvoicePdf(full);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${full.invoice.invoice_no}.pdf"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'PDF generation failed: ' + e.message });
  }
});

module.exports = router;
