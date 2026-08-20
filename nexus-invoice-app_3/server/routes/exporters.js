const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM exporters').all());
});

router.put('/:id', (req, res) => {
  const fields = ['name', 'address', 'invoice_prefix', 'bank_account_name', 'bank_name',
    'bank_account_no', 'bank_swift_code', 'bank_branch_address', 'declaration_text'];
  const updates = fields.filter(f => f in req.body);
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  const stmt = db.prepare(`UPDATE exporters SET ${updates.map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`);
  stmt.run({ ...req.body, id: req.params.id });
  res.json(db.prepare('SELECT * FROM exporters WHERE id = ?').get(req.params.id));
});

module.exports = router;
