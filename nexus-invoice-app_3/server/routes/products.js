const express = require('express');
const db = require('../db');

const router = express.Router();

function parseFeatures(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === 'string') {
    // Textarea input: one bullet per line.
    return raw.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function withParsedFeatures(row) {
  if (!row) return row;
  let features = [];
  try { features = row.features ? JSON.parse(row.features) : []; } catch (e) { features = []; }
  return { ...row, features };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY category, name').all();
  res.json(rows.map(withParsedFeatures));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(withParsedFeatures(row));
});

router.post('/', (req, res) => {
  const b = req.body;
  if (!b.name || !b.name.trim()) return res.status(400).json({ error: 'Product name is required' });
  const stmt = db.prepare(`INSERT INTO products
    (name, category, hs_code, pack_size, dimensions_mm, qty_per_package, nw_per_package_kg, gw_per_package_kg,
     default_cif_rate, batch_prefix, description, features, usage_info, presentation)
    VALUES (@name, @category, @hs_code, @pack_size, @dimensions_mm, @qty_per_package, @nw_per_package_kg, @gw_per_package_kg,
     @default_cif_rate, @batch_prefix, @description, @features, @usage_info, @presentation)`);
  const info = stmt.run({
    name: b.name.trim(),
    category: b.category || 'Miscellaneous',
    hs_code: b.hs_code || '2309.90.10',
    pack_size: b.pack_size || b.presentation || 'N/A',
    dimensions_mm: b.dimensions_mm || '',
    qty_per_package: Number(b.qty_per_package) || 1,
    nw_per_package_kg: Number(b.nw_per_package_kg) || 0,
    gw_per_package_kg: Number(b.gw_per_package_kg) || 0,
    default_cif_rate: b.default_cif_rate ? Number(b.default_cif_rate) : null,
    batch_prefix: b.batch_prefix || 'NX/26',
    description: b.description || '',
    features: JSON.stringify(parseFeatures(b.features)),
    usage_info: b.usage_info || '',
    presentation: b.presentation || '',
  });
  res.status(201).json(withParsedFeatures(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid)));
});

router.put('/:id', (req, res) => {
  const fields = ['name', 'category', 'hs_code', 'pack_size', 'dimensions_mm', 'qty_per_package',
    'nw_per_package_kg', 'gw_per_package_kg', 'default_cif_rate', 'batch_prefix', 'active',
    'description', 'usage_info', 'presentation'];
  const body = { ...req.body };
  if ('features' in body) {
    body.features = JSON.stringify(parseFeatures(body.features));
    fields.push('features');
  }
  const updates = fields.filter(f => f in body);
  if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
  const stmt = db.prepare(`UPDATE products SET ${updates.map(f => `${f} = @${f}`).join(', ')} WHERE id = @id`);
  stmt.run({ ...body, id: req.params.id });
  res.json(withParsedFeatures(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)));
});

router.delete('/:id', (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
