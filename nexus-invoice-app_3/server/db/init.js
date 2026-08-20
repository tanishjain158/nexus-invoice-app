const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'nexus.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const isNew = !fs.existsSync(DB_PATH);
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS exporters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  invoice_prefix TEXT NOT NULL DEFAULT 'NXUAE',
  bank_account_name TEXT,
  bank_name TEXT,
  bank_account_no TEXT,
  bank_swift_code TEXT,
  bank_branch_address TEXT,
  declaration_text TEXT DEFAULT 'We declare that this invoice shows the actual price of the goods Described and that all particulars are true and correct.'
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  consignee_address TEXT,
  buyer_name TEXT,
  buyer_address TEXT,
  country_of_final_destination TEXT,
  final_destination TEXT,
  seaport_of_discharge TEXT,
  default_delivery_terms TEXT,
  default_payment_terms TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'ANIMAL FEED SUPPLEMENTS',
  hs_code TEXT DEFAULT '2309.90.10',
  pack_size TEXT NOT NULL,
  dimensions_mm TEXT,
  qty_per_package INTEGER NOT NULL DEFAULT 1,
  nw_per_package_kg REAL NOT NULL DEFAULT 0,
  gw_per_package_kg REAL NOT NULL DEFAULT 0,
  default_cif_rate REAL,
  batch_prefix TEXT DEFAULT 'NX/26',
  -- Catalog/reference fields (from the NEXUS product catalogue) — informational, not used on invoices.
  description TEXT,
  features TEXT,      -- JSON array of bullet strings
  usage_info TEXT,     -- dosage / feed inclusion rate / mode of action / directions, as given in the catalogue
  presentation TEXT,   -- raw "Presentation" text from the catalogue, e.g. "25 KG" or "25 Kg, 1 Liter"
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT UNIQUE NOT NULL,
  invoice_date TEXT NOT NULL,
  exporter_id INTEGER NOT NULL REFERENCES exporters(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  exporters_ref TEXT,
  buyer_order_no TEXT,
  buyer_order_date TEXT,
  other_references TEXT,
  country_of_origin TEXT DEFAULT 'INDIA',
  country_of_final_destination TEXT,
  pre_carriage_by TEXT DEFAULT 'SEA',
  place_of_receipt TEXT,
  vessel_name TEXT,
  port_of_loading TEXT,
  seaport_of_discharge TEXT,
  final_destination TEXT,
  delivery_terms TEXT,
  payment_terms TEXT,
  container_no TEXT,
  c_seal_number TEXT,
  a_seal_number TEXT,
  sea_freight_charges REAL DEFAULT 0,
  insurance_charges REAL DEFAULT 0,
  bill_number TEXT,
  bill_date TEXT,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  sort_order INTEGER DEFAULT 0,
  pack_size TEXT,
  batch_no TEXT,
  mfg_date TEXT,
  exp_date TEXT,
  quantity REAL NOT NULL,
  cif_rate REAL NOT NULL,
  amount REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS packing_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_item_id INTEGER NOT NULL REFERENCES invoice_items(id) ON DELETE CASCADE,
  dimensions_mm TEXT,
  qty_per_package INTEGER NOT NULL,
  no_of_packages INTEGER NOT NULL,
  box_from INTEGER,
  box_to INTEGER,
  nw_per_package_kg REAL NOT NULL,
  gw_per_package_kg REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_packing_item ON packing_lines(invoice_item_id);
`);

// Migration guard: if this is an existing database created before the catalog fields existed,
// add the new columns in place rather than requiring a fresh DB. Safe to run every boot.
const existingColumns = db.prepare(`PRAGMA table_info(products)`).all().map(c => c.name);
const columnsToAdd = {
  description: `ALTER TABLE products ADD COLUMN description TEXT`,
  features: `ALTER TABLE products ADD COLUMN features TEXT`,
  usage_info: `ALTER TABLE products ADD COLUMN usage_info TEXT`,
  presentation: `ALTER TABLE products ADD COLUMN presentation TEXT`,
};
for (const [col, ddl] of Object.entries(columnsToAdd)) {
  if (!existingColumns.includes(col)) db.exec(ddl);
}

// Seed the full NEXUS product catalogue (idempotent — only inserts products that aren't already
// present by name, so this is safe to run on every boot, including against an existing database).
const catalogProducts = require('./catalog_data');
const existingNames = new Set(db.prepare(`SELECT name FROM products`).all().map(r => r.name));
const insertCatalogProduct = db.prepare(`INSERT INTO products
  (name, category, hs_code, pack_size, dimensions_mm, qty_per_package, nw_per_package_kg, gw_per_package_kg,
   default_cif_rate, batch_prefix, description, features, usage_info, presentation)
  VALUES (@name, @category, @hs_code, @pack_size, @dimensions_mm, @qty_per_package, @nw_per_package_kg, @gw_per_package_kg,
   @default_cif_rate, @batch_prefix, @description, @features, @usage_info, @presentation)`);
let catalogInserted = 0;
for (const p of catalogProducts) {
  if (existingNames.has(p.name)) continue;
  insertCatalogProduct.run({
    name: p.name,
    category: p.category,
    hs_code: '2309.90.10',
    pack_size: p.pack_size,
    dimensions_mm: '',
    qty_per_package: 1,
    nw_per_package_kg: 0,
    gw_per_package_kg: 0,
    default_cif_rate: null,
    batch_prefix: 'NX/26',
    description: p.description,
    features: JSON.stringify(p.features || []),
    usage_info: p.usage_info,
    presentation: p.presentation,
  });
  existingNames.add(p.name);
  catalogInserted++;
}
if (catalogInserted > 0) {
  console.log(`Seeded ${catalogInserted} product(s) from the NEXUS catalogue (dimensions/weights/CIF rate left blank — fill in per product before using on an invoice).`);
}

if (isNew) {
  const insertExporter = db.prepare(`INSERT INTO exporters
    (name, address, invoice_prefix, bank_account_name, bank_name, bank_account_no, bank_swift_code, bank_branch_address)
    VALUES (?,?,?,?,?,?,?,?)`);
  insertExporter.run(
    'NEXUS',
    'A-1143 SUN WEST BANK, ASHRAM ROAD, AHMEDABAD, GUJARAT, INDIA-380009',
    'NXUAE',
    'NEXUS',
    'THE KALUPUR COMMERCIAL CO OP BANK LTD',
    '02320102297',
    'KALUINAAXXX',
    'KALUPUR BANK BHAVAN, Ashram Road Ahmedabad-380014'
  );

  const insertProduct = db.prepare(`INSERT INTO products
    (name, hs_code, pack_size, dimensions_mm, qty_per_package, nw_per_package_kg, gw_per_package_kg, default_cif_rate, batch_prefix)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  const products = [
    ['IONLYTE C-40', '2309.90.10', '9 KG', '632 x 321 x 311', 2, 18, 22, 11.00, 'NX/26001'],
    ['X-LYTE C', '2309.90.10', '9 KG', '632 x 321 x 311', 2, 18, 22, 10.75, 'NX/26002'],
    ['NUTRIX PLATINA', '2309.90.10', '10 KG', '570 x 305 x 320', 2, 20, 24, 6.25, 'NX/26003'],
    ['GROWNEX FORTE', '2309.90.10', '10 KG', '570 x 305 x 320', 2, 20, 24, 6.25, 'NX/26004'],
    ['MINZA GOLD', '2309.90.10', '10 KG', '570 x 305 x 320', 2, 20, 24, 6.25, 'NX/26005'],
    ['TOXISORB', '2309.90.10', '450 GM', '400 x 380 x 380', 30, 13.5, 15, 1.50, 'NX/26008'],
  ];
  for (const p of products) insertProduct.run(...p);

  const insertCustomer = db.prepare(`INSERT INTO customers
    (name, consignee_address, buyer_name, buyer_address, country_of_final_destination, final_destination, seaport_of_discharge, default_delivery_terms, default_payment_terms)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  insertCustomer.run(
    'UAE Sample Buyer LLC',
    'UAE',
    '',
    '',
    'UAE',
    'UAE',
    'KHOR AL FAKKAN PORT',
    'Delivery: C.I.F, KHOR AL FAKKAN PORT, UAE',
    'Payment: 30% ADVANCE DURING DISPATCH + 70% AS DA AT 60 DAYS FROM BL DATE'
  );

  console.log('Database initialized with seed data at', DB_PATH);
}

module.exports = db;
