const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  let rows;
  if (q) {
    rows = db.prepare(`SELECT * FROM customers WHERE name LIKE ? OR consignee_address LIKE ? ORDER BY name`)
      .all(`%${q}%`, `%${q}%`);
  } else {
    rows = db.prepare('SELECT * FROM customers ORDER BY name').all();
  }
  res.json(rows);
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// All invoices for a specific customer — this is the "fill customer details, get their invoice history" feature.
router.get('/:id/invoices', (req, res) => {
  const rows = db.prepare(`SELECT i.*,
      (SELECT SUM(amount) FROM invoice_items WHERE invoice_id = i.id) AS total_value
    FROM invoices i WHERE i.customer_id = ? ORDER BY i.invoice_date DESC, i.id DESC`).all(req.params.id);
  res.json(rows);
});

router.post('/', (req, res) => {
  const b = req.body;
  const stmt = db.prepare(`INSERT INTO customers
    (name, consignee_address, buyer_name, buyer_address, country_of_final_destination, final_destination,
     seaport_of_discharge, default_delivery_terms, default_payment_terms, contact_email, contact_phone, notes)
    VALUES (@name, @consignee_address, @buyer_name, @buyer_address, @country_of_final_destination, @final_destination,
     @seaport_of_discharge, @default_delivery_terms, @default_payment_terms, @contact_email, @contact_phone, @notes)`);
  const info = stmt.run({
    name: b.name,
    consignee_address: b.consignee_address || '',
    buyer_name: b.buyer_name || '',
    buyer_address: b.buyer_address || '',
    country_of_final_destination: b.country_of_final_destination || '',
    final_destination: b.final_destination || '',
    seaport_of_discharge: b.seaport_of_discharge || '',
    default_delivery_terms: b.default_delivery_terms || '',
    default_payment_terms: b.default_payment_terms || '',
    contact_email: b.contact_email || '',
    contact_phone: b.contact_phone || '',
    notes: b.notes || '',
  });
  res.status(201).json(db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const fields = ['name', 'consignee_address', 'buyer_name', 'buyer_address', 'country_of_final_destination',
    'final_destination', 'seaport_of_discharge', 'default_delivery_terms', 'default_payment_terms',
    'contact_email', 'contact_phone', 'notes'];
  const updates = fields.filter(f => f in req.body);
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  const stmt = db.prepare(`UPDATE customers SET ${updates.map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`);
  stmt.run({ ...req.body, id: req.params.id });
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) AS c FROM invoices WHERE customer_id = ?').get(req.params.id).c;
  if (count > 0) return res.status(400).json({ error: 'Cannot delete customer with existing invoices' });
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
