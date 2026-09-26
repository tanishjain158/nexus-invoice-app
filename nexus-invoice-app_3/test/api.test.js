const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-'));
delete process.env.APP_USERNAME;
delete process.env.APP_PASSWORD;
const app = require('../server/app');

let server, base;
test.before(() => new Promise(resolve => {
  server = app.listen(0, () => { base = `http://127.0.0.1:${server.address().port}`; resolve(); });
}));
test.after(() => {
  server.close();
  require('../server/db').close();
  fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});

async function call(method, url, body) {
  const res = await fetch(base + url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function productId(name) {
  const { body } = await call('GET', '/api/products');
  return body.find(p => p.name === name).id;
}

test('creates an invoice with auto numbering, totals and continuous box numbering', async () => {
  const toxisorb = await productId('TOXISORB');
  const ionlyte = await productId('IONLYTE C-40');
  const { status, body } = await call('POST', '/api/invoices', {
    customer_id: 1,
    items: [
      { product_id: ionlyte, quantity: 300, cif_rate: 11 },
      {
        product_id: toxisorb, quantity: 4000, cif_rate: 1.5,
        packing: [
          { qty_per_package: 30, no_of_packages: 133, nw_per_package_kg: 13.5, gw_per_package_kg: 15 },
          { qty_per_package: 10, no_of_packages: 1, nw_per_package_kg: 4.5, gw_per_package_kg: 5 },
        ],
      },
    ],
  });
  assert.strictEqual(status, 201);
  assert.strictEqual(body.invoice.invoice_no, 'NXUAE0101');
  assert.strictEqual(body.totals.total_invoice_value, 300 * 11 + 4000 * 1.5);
  assert.strictEqual(body.totals.total_packages, 150 + 134);
  const boxes = body.items.flatMap(i => i.packing.map(p => [p.box_from, p.box_to]));
  assert.deepStrictEqual(boxes, [[1, 150], [151, 283], [284, 284]]);

  const next = await call('GET', '/api/invoices/next-number');
  assert.strictEqual(next.body.invoice_no, 'NXUAE0102');
});

test('rejects bad line items with a clear message and writes nothing', async () => {
  const before = (await call('GET', '/api/invoices')).body.length;
  const cases = [
    [{ product_id: 99999, quantity: 1, cif_rate: 1 }, /product not found/],
    [{ product_id: 1, quantity: 'abc', cif_rate: 1 }, /quantity/],
    [{ product_id: 1, quantity: 1, cif_rate: 1, packing: [{ no_of_packages: 0 }] }, /packages/],
  ];
  for (const [item, pattern] of cases) {
    const { status, body } = await call('POST', '/api/invoices', { customer_id: 1, items: [item] });
    assert.strictEqual(status, 400);
    assert.match(body.error, pattern);
  }
  assert.strictEqual((await call('GET', '/api/invoices')).body.length, before);
});

test('customer name is required', async () => {
  const { status, body } = await call('POST', '/api/customers', { consignee_address: 'x' });
  assert.strictEqual(status, 400);
  assert.match(body.error, /name/);
});

test('unknown API routes and malformed JSON return JSON errors', async () => {
  assert.strictEqual((await call('GET', '/api/nope')).status, 404);
  const res = await fetch(base + '/api/customers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad',
  });
  assert.strictEqual(res.status, 400);
  assert.ok((await res.json()).error);
});
