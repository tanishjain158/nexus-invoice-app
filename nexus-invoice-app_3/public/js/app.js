const app = document.getElementById('app');
let uidCounter = 1;
const uid = () => 'r' + (uidCounter++);

// ---------- Router ----------
window.addEventListener('hashchange', route);
window.addEventListener('DOMContentLoaded', route);

function parseHash() {
  const h = (location.hash || '#/dashboard').slice(2);
  return h.split('/').filter(Boolean);
}

async function route() {
  const parts = parseHash();
  highlightNav(parts);
  try {
    if (parts.length === 0 || parts[0] === 'dashboard') return renderDashboard();
    if (parts[0] === 'customers' && parts.length === 1) return renderCustomers();
    if (parts[0] === 'customers' && parts[1] === 'new') return renderCustomerForm();
    if (parts[0] === 'customers' && parts[1] && parts[2] === 'edit') return renderCustomerForm(parts[1]);
    if (parts[0] === 'customers' && parts[1]) return renderCustomerDetail(parts[1]);
    if (parts[0] === 'products') return renderProducts();
    if (parts[0] === 'invoices' && parts.length === 1) return renderInvoices();
    if (parts[0] === 'invoices' && parts[1] === 'new') return renderInvoiceForm();
    if (parts[0] === 'invoices' && parts[1] && parts[2] === 'edit') return renderInvoiceForm(parts[1]);
    if (parts[0] === 'invoices' && parts[1]) return renderInvoiceDetail(parts[1]);
    if (parts[0] === 'settings') return renderSettings();
    app.innerHTML = `<div class="empty">Page not found.</div>`;
  } catch (e) {
    console.error(e);
    app.innerHTML = `<div class="card"><p class="empty">Something went wrong: ${esc(e.message)}</p></div>`;
  }
}

function highlightNav(parts) {
  document.querySelectorAll('#nav a').forEach(a => a.classList.remove('active'));
  const route = parts.join('/') || 'dashboard';
  let match = document.querySelector(`#nav a[data-route="${route}"]`);
  if (!match) {
    const base = parts[0] || 'dashboard';
    match = document.querySelector(`#nav a[data-route="${base}"]`);
  }
  if (match) match.classList.add('active');
}

function go(hash) { location.hash = hash; }

// ---------- Dashboard ----------
async function renderDashboard() {
  app.innerHTML = `<div class="empty">Loading…</div>`;
  const [invoices, customers, products] = await Promise.all([API.invoices.list(), API.customers.list(), API.products.list()]);
  const totalValue = invoices.reduce((s, i) => s + (i.total_value || 0), 0);

  app.innerHTML = `
    <h1>Dashboard</h1>
    <p class="subtitle">Overview of NEXUS export documentation, and quick lookup of a customer's invoice history.</p>

    <div class="row">
      <div class="card"><h2>Invoices</h2><div style="font-size:26px;font-weight:700">${invoices.length}</div></div>
      <div class="card"><h2>Customers</h2><div style="font-size:26px;font-weight:700">${customers.length}</div></div>
      <div class="card"><h2>Products</h2><div style="font-size:26px;font-weight:700">${products.length}</div></div>
      <div class="card"><h2>Total Invoiced (USD)</h2><div style="font-size:26px;font-weight:700">${money(totalValue)}</div></div>
    </div>

    <div class="card">
      <h2>Find a customer's invoices</h2>
      <div class="search-box">
        <input id="dashSearch" placeholder="Type a customer name to see all their invoices…" autocomplete="off"/>
        <button class="btn" id="dashSearchBtn">Search</button>
      </div>
      <div id="dashResults" style="margin-top:14px"></div>
    </div>

    <div class="card">
      <div class="toolbar"><h2 style="margin:0;border:none;padding:0">Recent Invoices</h2>
        <a class="btn" href="#/invoices/new">+ New Invoice</a>
      </div>
      ${invoiceTable(invoices.slice(0, 8))}
    </div>
  `;

  const doSearch = async () => {
    const q = document.getElementById('dashSearch').value.trim();
    const results = document.getElementById('dashResults');
    if (!q) { results.innerHTML = ''; return; }
    const matches = await API.customers.list(q);
    if (!matches.length) {
      results.innerHTML = `<div class="empty">No customer matches "${esc(q)}".</div>`;
      return;
    }
    results.innerHTML = matches.map(c => `<div class="badge-muted" style="margin-bottom:6px">
        <a class="link" href="#/customers/${c.id}">${esc(c.name)}</a> — ${esc(c.consignee_address || '')}
      </div>`).join('');
  };
  document.getElementById('dashSearchBtn').addEventListener('click', doSearch);
  document.getElementById('dashSearch').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
}

function invoiceTable(invoices) {
  if (!invoices.length) return `<div class="empty">No invoices yet.</div>`;
  return `<table class="data">
    <thead><tr><th>Invoice No.</th><th>Date</th><th>Customer</th><th>Status</th><th class="right">Total (USD)</th><th></th></tr></thead>
    <tbody>
      ${invoices.map(i => `
        <tr class="clickable" onclick="go('#/invoices/${i.id}')">
          <td>${esc(i.invoice_no)}</td>
          <td>${esc(i.invoice_date)}</td>
          <td>${esc(i.customer_name || '')}</td>
          <td><span class="pill ${i.status}">${esc(i.status)}</span></td>
          <td class="right">${money(i.total_value)}</td>
          <td><a class="link" href="${API.invoices.pdfUrl(i.id)}" target="_blank" onclick="event.stopPropagation()">PDF</a></td>
        </tr>`).join('')}
    </tbody>
  </table>`;
}

// ---------- Customers ----------
async function renderCustomers() {
  app.innerHTML = `<div class="empty">Loading…</div>`;
  const customers = await API.customers.list();
  app.innerHTML = `
    <div class="toolbar"><h1 style="margin:0">Customers</h1><a class="btn" href="#/customers/new">+ Add Customer</a></div>
    <p class="subtitle">Consignees / buyers you export to. Each customer's invoice history is one click away.</p>
    <div class="card">
      ${customers.length ? `<table class="data">
        <thead><tr><th>Name</th><th>Consignee Address</th><th>Final Destination</th><th>Port of Discharge</th><th></th></tr></thead>
        <tbody>
          ${customers.map(c => `
            <tr class="clickable" onclick="go('#/customers/${c.id}')">
              <td><b>${esc(c.name)}</b></td>
              <td>${esc(c.consignee_address || '')}</td>
              <td>${esc(c.final_destination || '')}</td>
              <td>${esc(c.seaport_of_discharge || '')}</td>
              <td><a class="link" href="#/customers/${c.id}/edit" onclick="event.stopPropagation()">Edit</a></td>
            </tr>`).join('')}
        </tbody>
      </table>` : `<div class="empty">No customers yet. Add your first customer to get started.</div>`}
    </div>
  `;
}

async function renderCustomerDetail(id) {
  app.innerHTML = `<div class="empty">Loading…</div>`;
  const [customer, invoices] = await Promise.all([API.customers.get(id), API.customers.invoices(id)]);
  const totalValue = invoices.reduce((s, i) => s + (i.total_value || 0), 0);
  app.innerHTML = `
    <div class="toolbar">
      <h1 style="margin:0">${esc(customer.name)}</h1>
      <div style="display:flex;gap:8px">
        <a class="btn secondary" href="#/customers/${customer.id}/edit">Edit Customer</a>
        <a class="btn" href="#/invoices/new?customer=${customer.id}">+ New Invoice for this customer</a>
      </div>
    </div>
    <div class="row">
      <div class="card">
        <h2>Customer Details</h2>
        <p><b>Consignee address:</b> ${esc(customer.consignee_address || '—')}</p>
        <p><b>Buyer (if different):</b> ${esc(customer.buyer_name || '—')} ${esc(customer.buyer_address || '')}</p>
        <p><b>Country of final destination:</b> ${esc(customer.country_of_final_destination || '—')}</p>
        <p><b>Final destination:</b> ${esc(customer.final_destination || '—')}</p>
        <p><b>Seaport of discharge:</b> ${esc(customer.seaport_of_discharge || '—')}</p>
        <p><b>Contact:</b> ${esc(customer.contact_email || '—')} ${esc(customer.contact_phone || '')}</p>
      </div>
      <div class="card">
        <h2>Summary</h2>
        <p><b>${invoices.length}</b> invoice(s) on file</p>
        <p><b>USD ${money(totalValue)}</b> total invoiced value</p>
      </div>
    </div>
    <div class="card">
      <h2>Invoice History</h2>
      ${invoiceTable(invoices)}
    </div>
  `;
}

function customerFormFields(c) {
  c = c || {};
  return `
    ${field('Customer / Consignee Name *', `<input name="name" required value="${esc(c.name || '')}"/>`)}
    ${field('Consignee Address', `<textarea name="consignee_address">${esc(c.consignee_address || '')}</textarea>`)}
    <div class="grid2">
      ${field('Buyer Name (if other than consignee)', `<input name="buyer_name" value="${esc(c.buyer_name || '')}"/>`)}
      ${field('Buyer Address', `<input name="buyer_address" value="${esc(c.buyer_address || '')}"/>`)}
    </div>
    <div class="grid3">
      ${field('Country of Final Destination', `<input name="country_of_final_destination" value="${esc(c.country_of_final_destination || 'UAE')}"/>`)}
      ${field('Final Destination', `<input name="final_destination" value="${esc(c.final_destination || '')}"/>`)}
      ${field('Seaport of Discharge', `<input name="seaport_of_discharge" value="${esc(c.seaport_of_discharge || '')}"/>`)}
    </div>
    ${field('Default Delivery Terms', `<textarea name="default_delivery_terms">${esc(c.default_delivery_terms || '')}</textarea>`)}
    ${field('Default Payment Terms', `<textarea name="default_payment_terms">${esc(c.default_payment_terms || '')}</textarea>`)}
    <div class="grid2">
      ${field('Contact Email', `<input name="contact_email" value="${esc(c.contact_email || '')}"/>`)}
      ${field('Contact Phone', `<input name="contact_phone" value="${esc(c.contact_phone || '')}"/>`)}
    </div>
    ${field('Notes', `<textarea name="notes">${esc(c.notes || '')}</textarea>`)}
  `;
}

async function renderCustomerForm(id) {
  const editing = !!id;
  const customer = editing ? await API.customers.get(id) : null;
  app.innerHTML = `
    <h1>${editing ? 'Edit Customer' : 'Add Customer'}</h1>
    <div class="card">
      <form id="custForm">
        ${customerFormFields(customer)}
        <div class="toolbar" style="justify-content:flex-start">
          <button type="submit" class="btn">${editing ? 'Save Changes' : 'Add Customer'}</button>
          <a class="btn secondary" href="${editing ? '#/customers/' + id : '#/customers'}">Cancel</a>
          ${editing ? `<button type="button" class="btn danger" id="delCust">Delete</button>` : ''}
        </div>
      </form>
    </div>
  `;
  document.getElementById('custForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try {
      if (editing) { await API.customers.update(id, data); toast('Customer updated.'); go('#/customers/' + id); }
      else { const c = await API.customers.create(data); toast('Customer added.'); go('#/customers/' + c.id); }
    } catch (err) { toast(err.message, true); }
  });
  if (editing) {
    document.getElementById('delCust').addEventListener('click', async () => {
      if (!confirm('Delete this customer? This only works if they have no invoices.')) return;
      try { await API.customers.remove(id); toast('Customer deleted.'); go('#/customers'); }
      catch (err) { toast(err.message, true); }
    });
  }
}

// ---------- Products ----------
let productsCache = null;
let productFilter = { q: '', category: '' };

function exportReady(p) {
  return Number(p.nw_per_package_kg) > 0 && Number(p.gw_per_package_kg) > 0 && p.dimensions_mm;
}

async function renderProducts() {
  app.innerHTML = `<div class="empty">Loading…</div>`;
  productsCache = await API.products.list();
  paintProducts();
}

function paintProducts() {
  const products = productsCache || [];
  const categories = [...new Set(products.map(p => p.category || 'Miscellaneous'))].sort();
  const q = productFilter.q.trim().toLowerCase();
  const filtered = products.filter(p => {
    if (productFilter.category && (p.category || 'Miscellaneous') !== productFilter.category) return false;
    if (q && !p.name.toLowerCase().includes(q) && !(p.description || '').toLowerCase().includes(q)) return false;
    return true;
  });
  const grouped = {};
  for (const p of filtered) {
    const cat = p.category || 'Miscellaneous';
    (grouped[cat] = grouped[cat] || []).push(p);
  }
  const groupNames = Object.keys(grouped).sort();
  const readyCount = products.filter(exportReady).length;

  app.innerHTML = `
    <div class="toolbar"><h1 style="margin:0">Product Catalog</h1><button class="btn" id="addProdBtn">+ Add Product</button></div>
    <p class="subtitle">${products.length} products across ${categories.length} categories. ${readyCount} have export packing details set (dimensions, units/package, net &amp; gross weight) and are ready to add to an invoice — the rest just need those filled in once.</p>
    <div class="card">
      <div class="row" style="align-items:flex-end">
        <div style="flex:2;min-width:220px">
          <div class="search-box"><input id="prodSearch" placeholder="Search by name or description…" value="${esc(productFilter.q)}"/></div>
        </div>
        <div style="flex:1;min-width:180px">
          <select id="prodCategory">
            <option value="">All categories</option>
            ${categories.map(c => `<option value="${esc(c)}" ${productFilter.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="card" id="prodFormCard" style="display:none"></div>
    ${groupNames.length ? groupNames.map(cat => `
      <div class="card">
        <h2>${esc(cat)} <span class="badge-muted">(${grouped[cat].length})</span></h2>
        <table class="data">
          <thead><tr><th>Product</th><th>Presentation</th><th>Export details</th><th></th></tr></thead>
          <tbody>
            ${grouped[cat].map(p => `
              <tr class="clickable" data-toggle="${p.id}">
                <td><b>${esc(p.name)}</b></td>
                <td>${esc(p.presentation || p.pack_size || '—')}</td>
                <td>${exportReady(p) ? '<span class="pill final">ready</span>' : '<span class="pill draft">needs setup</span>'}</td>
                <td><a class="link" href="#" data-edit="${p.id}">Edit</a> · <a class="link" href="#" data-del="${p.id}">Remove</a></td>
              </tr>
              <tr id="detail-${p.id}" style="display:none"><td colspan="4" id="detail-body-${p.id}"></td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('') : `<div class="card"><div class="empty">No products match your search.</div></div>`}
  `;

  function productDetailHtml(p) {
    return `
      <div style="padding:8px 4px">
        ${p.description ? `<p style="margin:0 0 10px">${esc(p.description)}</p>` : ''}
        ${p.features && p.features.length ? `
          <div style="margin-bottom:10px">
            <b>Features &amp; Benefits</b>
            <ul style="margin:6px 0 0;padding-left:20px">${p.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
          </div>` : ''}
        ${p.usage_info ? `<div style="margin-bottom:10px"><b>Usage / Dosage</b><div style="white-space:pre-line;margin-top:4px">${esc(p.usage_info)}</div></div>` : ''}
        <div class="row" style="font-size:12.5px;color:var(--muted)">
          <span>HS Code: <b>${esc(p.hs_code || '—')}</b></span>
          <span>Pack size: <b>${esc(p.pack_size || '—')}</b></span>
          <span>Dimensions: <b>${esc(p.dimensions_mm || 'not set')}</b></span>
          <span>Units/pkg: <b>${p.qty_per_package || '—'}</b></span>
          <span>NW/pkg: <b>${p.nw_per_package_kg ? num(p.nw_per_package_kg) + ' kg' : 'not set'}</b></span>
          <span>GW/pkg: <b>${p.gw_per_package_kg ? num(p.gw_per_package_kg) + ' kg' : 'not set'}</b></span>
          <span>Default rate: <b>${p.default_cif_rate ? '$' + money(p.default_cif_rate) : 'not set'}</b></span>
        </div>
      </div>`;
  }

  function showForm(product) {
    const card = document.getElementById('prodFormCard');
    card.style.display = 'block';
    const featuresText = product && product.features ? product.features.join('\n') : '';
    card.innerHTML = `
      <h2>${product ? 'Edit Product' : 'Add Product'}</h2>
      <form id="prodForm">
        <div class="grid2">
          ${field('Product Name *', `<input name="name" required value="${esc(product ? product.name : '')}"/>`)}
          ${field('Category', `<input name="category" list="catList" value="${esc(product ? product.category : '')}"/>
            <datalist id="catList">${categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}
        </div>
        ${field('Presentation (pack as sold, e.g. "25 KG" or "1 Liter")', `<input name="presentation" value="${esc(product ? product.presentation : '')}"/>`)}
        ${field('Description', `<textarea name="description">${esc(product ? product.description : '')}</textarea>`)}
        ${field('Features & Benefits (one per line)', `<textarea name="features" style="min-height:110px">${esc(featuresText)}</textarea>`)}
        ${field('Usage / Dosage / Feed Inclusion Rate', `<textarea name="usage_info" style="min-height:90px">${esc(product ? product.usage_info : '')}</textarea>`)}

        <h2 style="margin-top:18px">Export Packing Details</h2>
        <p class="subtitle" style="margin-top:-6px">Only needed once you're ready to ship this product — this is what fills in "No. &amp; Kind of Pkg" on an invoice.</p>
        <div class="grid3">
          ${field('Pack Size on Invoice (e.g. 9 KG)', `<input name="pack_size" value="${esc(product ? product.pack_size : '')}"/>`)}
          ${field('Dimensions (mm, e.g. 632 x 321 x 311)', `<input name="dimensions_mm" value="${esc(product ? product.dimensions_mm : '')}"/>`)}
          ${field('Units per Export Package', `<input type="number" min="1" name="qty_per_package" value="${product ? product.qty_per_package : 1}"/>`)}
        </div>
        <div class="grid4">
          ${field('Net Wt / Package (kg)', `<input type="number" step="0.01" name="nw_per_package_kg" value="${product && product.nw_per_package_kg ? product.nw_per_package_kg : ''}"/>`)}
          ${field('Gross Wt / Package (kg)', `<input type="number" step="0.01" name="gw_per_package_kg" value="${product && product.gw_per_package_kg ? product.gw_per_package_kg : ''}"/>`)}
          ${field('Default C.I.F Rate (USD)', `<input type="number" step="0.01" name="default_cif_rate" value="${product && product.default_cif_rate ? product.default_cif_rate : ''}"/>`)}
          ${field('HS Code', `<input name="hs_code" value="${esc(product ? product.hs_code : '2309.90.10')}"/>`)}
        </div>
        ${field('Batch Prefix (suggestion only)', `<input name="batch_prefix" value="${esc(product ? product.batch_prefix : 'NX/26')}"/>`)}
        <div class="toolbar" style="justify-content:flex-start">
          <button type="submit" class="btn">${product ? 'Save Changes' : 'Add Product'}</button>
          <button type="button" class="btn secondary" id="cancelProd">Cancel</button>
        </div>
      </form>
    `;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    document.getElementById('cancelProd').addEventListener('click', () => { card.style.display = 'none'; card.innerHTML = ''; });
    document.getElementById('prodForm').addEventListener('submit', async e => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(e.target).entries());
      try {
        if (product) await API.products.update(product.id, data);
        else await API.products.create(data);
        toast(product ? 'Product updated.' : 'Product added.');
        renderProducts();
      } catch (err) { toast(err.message, true); }
    });
  }

  document.getElementById('prodSearch').addEventListener('input', e => { productFilter.q = e.target.value; paintProducts(); });
  document.getElementById('prodCategory').addEventListener('change', e => { productFilter.category = e.target.value; paintProducts(); });
  document.getElementById('addProdBtn').addEventListener('click', () => showForm(null));

  document.querySelectorAll('[data-toggle]').forEach(row => row.addEventListener('click', e => {
    if (e.target.closest('a')) return;
    const id = row.dataset.toggle;
    const detailRow = document.getElementById(`detail-${id}`);
    const isOpen = detailRow.style.display !== 'none';
    detailRow.style.display = isOpen ? 'none' : 'table-row';
    if (!isOpen) {
      const p = products.find(p => String(p.id) === String(id));
      document.getElementById(`detail-body-${id}`).innerHTML = productDetailHtml(p);
    }
  }));
  document.querySelectorAll('[data-edit]').forEach(a => a.addEventListener('click', async e => {
    e.preventDefault();
    e.stopPropagation();
    const p = await API.products.get(a.dataset.edit);
    showForm(p);
  }));
  document.querySelectorAll('[data-del]').forEach(a => a.addEventListener('click', async e => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Remove this product from the catalog?')) return;
    try { await API.products.remove(a.dataset.del); toast('Product removed.'); renderProducts(); }
    catch (err) { toast(err.message, true); }
  }));
}

// ---------- Settings (exporter) ----------
async function renderSettings() {
  app.innerHTML = `<div class="empty">Loading…</div>`;
  const exporters = await API.exporters.list();
  const ex = exporters[0];
  app.innerHTML = `
    <h1>Exporter Settings</h1>
    <p class="subtitle">These details appear on every invoice, packing list and annexure you generate.</p>
    <div class="card">
      <form id="exForm">
        <div class="grid2">
          ${field('Exporter Name', `<input name="name" value="${esc(ex.name)}"/>`)}
          ${field('Invoice Number Prefix', `<input name="invoice_prefix" value="${esc(ex.invoice_prefix)}"/>`)}
        </div>
        ${field('Address', `<textarea name="address">${esc(ex.address)}</textarea>`)}
        <div class="grid2">
          ${field('Bank Account Name', `<input name="bank_account_name" value="${esc(ex.bank_account_name || '')}"/>`)}
          ${field('Bank Name', `<input name="bank_name" value="${esc(ex.bank_name || '')}"/>`)}
        </div>
        <div class="grid2">
          ${field('Bank Account No.', `<input name="bank_account_no" value="${esc(ex.bank_account_no || '')}"/>`)}
          ${field('SWIFT Code', `<input name="bank_swift_code" value="${esc(ex.bank_swift_code || '')}"/>`)}
        </div>
        ${field('Bank Branch Address', `<input name="bank_branch_address" value="${esc(ex.bank_branch_address || '')}"/>`)}
        ${field('Declaration Text', `<textarea name="declaration_text">${esc(ex.declaration_text || '')}</textarea>`)}
        <div class="toolbar" style="justify-content:flex-start">
          <button type="submit" class="btn">Save Settings</button>
        </div>
      </form>
    </div>
  `;
  document.getElementById('exForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    try { await API.exporters.update(ex.id, data); toast('Settings saved.'); }
    catch (err) { toast(err.message, true); }
  });
}

// ---------- Invoices list ----------
async function renderInvoices() {
  app.innerHTML = `<div class="empty">Loading…</div>`;
  const invoices = await API.invoices.list();
  app.innerHTML = `
    <div class="toolbar"><h1 style="margin:0">Invoices</h1><a class="btn" href="#/invoices/new">+ New Invoice</a></div>
    <div class="card">${invoiceTable(invoices)}</div>
  `;
}

async function renderInvoiceDetail(id) {
  app.innerHTML = `<div class="empty">Loading…</div>`;
  const full = await API.invoices.get(id);
  const { invoice, customer, items, totals } = full;
  app.innerHTML = `
    <div class="toolbar">
      <h1 style="margin:0">${esc(invoice.invoice_no)} <span class="pill ${invoice.status}">${esc(invoice.status)}</span></h1>
      <div style="display:flex;gap:8px">
        <a class="btn secondary" href="#/invoices/${id}/edit">Edit</a>
        <a class="btn" href="${API.invoices.pdfUrl(id)}" target="_blank">Download PDF (Invoice + Packing List + Annexure)</a>
      </div>
    </div>
    <div class="row">
      <div class="card">
        <h2>Shipment</h2>
        <p><b>Customer:</b> <a class="link" href="#/customers/${customer.id}">${esc(customer.name)}</a></p>
        <p><b>Invoice date:</b> ${esc(invoice.invoice_date)}</p>
        <p><b>Buyer order:</b> ${esc(invoice.buyer_order_no || '—')} ${invoice.buyer_order_date ? 'dt.' + esc(invoice.buyer_order_date) : ''}</p>
        <p><b>Vessel:</b> ${esc(invoice.vessel_name || '—')}</p>
        <p><b>Port of loading → discharge:</b> ${esc(invoice.port_of_loading || '—')} → ${esc(invoice.seaport_of_discharge || '—')}</p>
        <p><b>Container / Seals:</b> ${esc(invoice.container_no || '—')} / C:${esc(invoice.c_seal_number || '—')} A:${esc(invoice.a_seal_number || '—')}</p>
      </div>
      <div class="card">
        <h2>Totals</h2>
        <p><b>Total invoice value:</b> USD ${money(totals.total_invoice_value)}</p>
        <p><b>Sea freight:</b> USD ${money(invoice.sea_freight_charges)} &nbsp; <b>Insurance:</b> USD ${money(invoice.insurance_charges)}</p>
        <p><b>FOB value:</b> USD ${money(totals.fob_value)}</p>
        <p><b>Packages:</b> ${totals.total_packages} &nbsp; <b>Net wt:</b> ${money(totals.total_net_weight)} kg &nbsp; <b>Gross wt:</b> ${money(totals.total_gross_weight)} kg</p>
      </div>
    </div>
    <div class="card">
      <h2>Line Items</h2>
      <table class="data">
        <thead><tr><th>Product</th><th>Pack Size</th><th>Batch</th><th>Exp. Date</th><th class="right">Qty</th><th class="right">Rate</th><th class="right">Amount</th></tr></thead>
        <tbody>
          ${items.map(i => `<tr>
            <td>${esc(i.product_name)}</td><td>${esc(i.pack_size)}</td><td>${esc(i.batch_no)}</td><td>${esc(i.exp_date)}</td>
            <td class="right">${num(i.quantity)}</td><td class="right">${money(i.cif_rate)}</td><td class="right">${money(i.amount)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ---------- Invoice Form (create/edit) ----------
let formState = null;

async function renderInvoiceForm(id) {
  const editing = !!id;
  app.innerHTML = `<div class="empty">Loading…</div>`;
  const [customers, products, exporters] = await Promise.all([API.customers.list(), API.products.list(), API.exporters.list()]);
  const exporter = exporters[0];

  let invoice = {}, items = [];
  if (editing) {
    const full = await API.invoices.get(id);
    invoice = full.invoice;
    items = full.items.map(i => ({
      key: uid(), product_id: i.product_id, pack_size: i.pack_size, batch_no: i.batch_no,
      mfg_date: i.mfg_date, exp_date: i.exp_date, quantity: i.quantity, cif_rate: i.cif_rate,
      packing: i.packing.map(p => ({ key: uid(), dimensions_mm: p.dimensions_mm, qty_per_package: p.qty_per_package,
        no_of_packages: p.no_of_packages, nw_per_package_kg: p.nw_per_package_kg, gw_per_package_kg: p.gw_per_package_kg })),
    }));
  } else {
    const params = new URLSearchParams(location.hash.split('?')[1] || '');
    const preselectCustomer = params.get('customer');
    const nextNo = await API.invoices.nextNumber(exporter.id);
    invoice = {
      invoice_no: nextNo.invoice_no, invoice_date: todayISO(), customer_id: preselectCustomer || '',
      pre_carriage_by: 'SEA', country_of_origin: 'INDIA', status: 'draft',
    };
  }

  formState = { invoice, items, customers, products, exporter };
  paintInvoiceForm(editing, id);
}

function applyCustomerDefaults(customerId) {
  const c = formState.customers.find(c => String(c.id) === String(customerId));
  if (!c) return;
  Object.assign(formState.invoice, {
    country_of_final_destination: c.country_of_final_destination,
    final_destination: c.final_destination,
    seaport_of_discharge: c.seaport_of_discharge,
    delivery_terms: formState.invoice.delivery_terms || c.default_delivery_terms,
    payment_terms: formState.invoice.payment_terms || c.default_payment_terms,
  });
}

function newItemRow(productId) {
  const p = formState.products.find(p => String(p.id) === String(productId));
  return {
    key: uid(),
    product_id: p ? p.id : '',
    pack_size: p ? p.pack_size : '',
    batch_no: p ? p.batch_prefix : '',
    mfg_date: '', exp_date: '',
    quantity: '', cif_rate: p ? p.default_cif_rate : '',
    packing: [{
      key: uid(),
      dimensions_mm: p ? p.dimensions_mm : '',
      qty_per_package: p ? p.qty_per_package : 1,
      no_of_packages: 0,
      nw_per_package_kg: p ? p.nw_per_package_kg : '',
      gw_per_package_kg: p ? p.gw_per_package_kg : '',
    }],
  };
}

// A fresh packing row for "+ Split packaging" — e.g. the sample invoice's Toxisorb line,
// shipped as 133 full cartons of 30 units plus 1 partial carton of 10.
function newPackingRow(basedOn) {
  return {
    key: uid(),
    dimensions_mm: basedOn ? basedOn.dimensions_mm : '',
    qty_per_package: basedOn ? basedOn.qty_per_package : 1,
    no_of_packages: 0,
    nw_per_package_kg: basedOn ? basedOn.nw_per_package_kg : '',
    gw_per_package_kg: basedOn ? basedOn.gw_per_package_kg : '',
  };
}

function computeTotals() {
  let value = 0, packages = 0, nw = 0, gw = 0;
  for (const it of formState.items) {
    const qty = Number(it.quantity) || 0;
    const rate = Number(it.cif_rate) || 0;
    value += qty * rate;
    for (const pl of it.packing) {
      const n = Number(pl.no_of_packages) || 0;
      packages += n;
      nw += n * (Number(pl.nw_per_package_kg) || 0);
      gw += n * (Number(pl.gw_per_package_kg) || 0);
    }
  }
  const fob = value - (Number(formState.invoice.sea_freight_charges) || 0) - (Number(formState.invoice.insurance_charges) || 0);
  return { value, packages, nw, gw, fob };
}

function productOptions(selectedId) {
  const byCategory = {};
  for (const p of formState.products) {
    const cat = p.category || 'Miscellaneous';
    (byCategory[cat] = byCategory[cat] || []).push(p);
  }
  return Object.keys(byCategory).sort().map(cat => `
    <optgroup label="${esc(cat)}">
      ${byCategory[cat].map(p => {
        const ready = Number(p.nw_per_package_kg) > 0 && Number(p.gw_per_package_kg) > 0;
        const label = `${p.name} (${p.presentation || p.pack_size})${ready ? '' : ' — needs packing details'}`;
        return `<option value="${p.id}" ${String(p.id) === String(selectedId) ? 'selected' : ''}>${esc(label)}</option>`;
      }).join('')}
    </optgroup>`).join('');
}

function packingRowHtml(it, pk, i) {
  return `
    <div class="packing-row" data-pk="${pk.key}" style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;${i > 0 ? 'margin-top:4px;padding-top:4px;border-top:1px dashed var(--line)' : ''}">
      <input type="number" data-f="pk_no_of_packages" data-pk="${pk.key}" value="${pk.no_of_packages}" style="width:44px" title="No. of packages"/>
      <span class="badge-muted">×</span>
      <input type="number" data-f="pk_qty_per_package" data-pk="${pk.key}" value="${pk.qty_per_package}" style="width:36px" title="Units per package"/>
      <input data-f="pk_dimensions_mm" data-pk="${pk.key}" value="${esc(pk.dimensions_mm || '')}" style="width:120px" placeholder="dims mm" title="Dimensions (mm)"/>
      <input type="number" step="0.01" data-f="pk_nw" data-pk="${pk.key}" value="${pk.nw_per_package_kg}" style="width:48px" title="NW/pkg (kg)"/>
      <input type="number" step="0.01" data-f="pk_gw" data-pk="${pk.key}" value="${pk.gw_per_package_kg}" style="width:48px" title="GW/pkg (kg)"/>
      ${it.packing.length > 1 ? `<span class="remove-row" data-remove-split="${pk.key}" data-item="${it.key}" title="Remove this split">✕</span>` : ''}
    </div>`;
}

function itemRowHtml(it, idx) {
  const needsSetup = it.product_id && it.packing.some(p => !Number(p.nw_per_package_kg) || !Number(p.gw_per_package_kg));
  return `
  <tr data-key="${it.key}">
    <td style="min-width:170px">
      <select data-f="product_id">
        <option value="">Select…</option>
        ${productOptions(it.product_id)}
      </select>
    </td>
    <td style="width:90px"><input data-f="pack_size" value="${esc(it.pack_size)}" placeholder="pack size"/></td>
    <td style="width:110px"><input data-f="batch_no" value="${esc(it.batch_no)}" placeholder="batch no"/></td>
    <td style="width:120px"><input type="month" data-f="mfg_date" value="${esc(it.mfg_date)}"/></td>
    <td style="width:120px"><input type="month" data-f="exp_date" value="${esc(it.exp_date)}"/></td>
    <td style="width:80px"><input type="number" step="any" data-f="quantity" value="${it.quantity}" placeholder="qty"/></td>
    <td style="width:80px"><input type="number" step="0.01" data-f="cif_rate" value="${it.cif_rate}" placeholder="rate"/></td>
    <td style="width:90px" class="right amount-cell">${money((Number(it.quantity) || 0) * (Number(it.cif_rate) || 0))}</td>
    <td style="width:300px">
      <div class="packing-rows" data-item="${it.key}">
        ${it.packing.map((pk, i) => packingRowHtml(it, pk, i)).join('')}
      </div>
      <button type="button" class="btn secondary small" data-add-split="${it.key}" style="margin-top:5px;padding:3px 8px;font-size:11.5px">+ Split packaging</button>
      <div class="pkg-warning" style="color:#92620c;font-size:11px;margin-top:4px;display:${needsSetup ? 'block' : 'none'}">⚠ no export packing details yet — fill in dimensions/weights above or in the Product Catalog</div>
    </td>
    <td><span class="remove-row" data-remove="${it.key}">✕</span></td>
  </tr>`;
}

function paintInvoiceForm(editing, id) {
  const { invoice, customers, exporter } = formState;
  const totals = computeTotals();

  app.innerHTML = `
    <h1>${editing ? 'Edit Invoice' : 'New Invoice'}</h1>
    <p class="subtitle">Fill in shipment details and add the supplements being shipped — pack size, batch and totals are calculated for you.</p>
    <form id="invForm">
      <div class="card">
        <h2>Customer &amp; References</h2>
        <div class="grid3">
          ${field('Customer *', `<select name="customer_id" id="customerSelect" required>
            <option value="">Select customer…</option>
            ${customers.map(c => `<option value="${c.id}" ${String(c.id) === String(invoice.customer_id) ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
          </select>`)}
          ${field('Invoice No.', `<input name="invoice_no" value="${esc(invoice.invoice_no || '')}" ${editing ? 'readonly' : ''}/>`)}
          ${field('Invoice Date', `<input type="date" name="invoice_date" value="${esc(invoice.invoice_date || todayISO())}"/>`)}
        </div>
        <div class="grid3">
          ${field("Exporter's Ref", `<input name="exporters_ref" value="${esc(invoice.exporters_ref || '')}"/>`)}
          ${field("Buyer's Order No.", `<input name="buyer_order_no" value="${esc(invoice.buyer_order_no || '')}"/>`)}
          ${field("Buyer's Order Date", `<input type="date" name="buyer_order_date" value="${esc(invoice.buyer_order_date || '')}"/>`)}
        </div>
        ${field('Other Reference(s)', `<input name="other_references" value="${esc(invoice.other_references || '')}"/>`)}
      </div>

      <div class="card">
        <h2>Shipment Details</h2>
        <div class="grid4">
          ${field('Pre-Carriage by', `<input name="pre_carriage_by" value="${esc(invoice.pre_carriage_by || 'SEA')}"/>`)}
          ${field('Place of Receipt', `<input name="place_of_receipt" value="${esc(invoice.place_of_receipt || '')}"/>`)}
          ${field('Vessel Name & No.', `<input name="vessel_name" value="${esc(invoice.vessel_name || '')}"/>`)}
          ${field('Port of Loading', `<input name="port_of_loading" value="${esc(invoice.port_of_loading || '')}"/>`)}
        </div>
        <div class="grid4">
          ${field('Seaport / Port of Discharge', `<input name="seaport_of_discharge" value="${esc(invoice.seaport_of_discharge || '')}"/>`)}
          ${field('Final Destination', `<input name="final_destination" value="${esc(invoice.final_destination || '')}"/>`)}
          ${field('Country of Origin', `<input name="country_of_origin" value="${esc(invoice.country_of_origin || 'INDIA')}"/>`)}
          ${field('Country of Final Destination', `<input name="country_of_final_destination" value="${esc(invoice.country_of_final_destination || '')}"/>`)}
        </div>
        <div class="grid3">
          ${field('Container No.', `<input name="container_no" value="${esc(invoice.container_no || '')}"/>`)}
          ${field('C Seal Number', `<input name="c_seal_number" value="${esc(invoice.c_seal_number || '')}"/>`)}
          ${field('A Seal Number', `<input name="a_seal_number" value="${esc(invoice.a_seal_number || '')}"/>`)}
        </div>
      </div>

      <div class="card">
        <h2>Terms, Charges &amp; Compliance</h2>
        <div class="grid2">
          ${field('Delivery Terms', `<textarea name="delivery_terms">${esc(invoice.delivery_terms || '')}</textarea>`)}
          ${field('Payment Terms', `<textarea name="payment_terms">${esc(invoice.payment_terms || '')}</textarea>`)}
        </div>
        <div class="grid4">
          ${field('Sea Freight Charges (USD)', `<input type="number" step="0.01" name="sea_freight_charges" value="${invoice.sea_freight_charges || 0}"/>`)}
          ${field('Insurance Charges (USD)', `<input type="number" step="0.01" name="insurance_charges" value="${invoice.insurance_charges || 0}"/>`)}
          ${field('Bill Number', `<input name="bill_number" value="${esc(invoice.bill_number || '')}"/>`)}
          ${field('Bill Date', `<input type="date" name="bill_date" value="${esc(invoice.bill_date || '')}"/>`)}
        </div>
      </div>

      <div class="card">
        <h2>Supplements Shipped</h2>
        <div class="table-scroll">
          <table class="items-table">
            <thead><tr>
              <th>Product</th><th>Pack Size</th><th>Batch No.</th><th>Mfg</th><th>Exp</th><th>Qty</th><th>Rate</th><th>Amount</th><th>Packing (pkgs × units, dims, NW/GW per pkg)</th><th></th>
            </tr></thead>
            <tbody id="itemsBody">
              ${formState.items.map((it, idx) => itemRowHtml(it, idx)).join('')}
            </tbody>
          </table>
        </div>
        <button type="button" class="btn secondary small" id="addItemBtn">+ Add Product</button>
        <div class="totals-box">
          <span>Packages: <b id="tPkgs">${totals.packages}</b></span>
          <span>Net Wt: <b id="tNw">${money(totals.nw)}</b> kg</span>
          <span>Gross Wt: <b id="tGw">${money(totals.gw)}</b> kg</span>
          <span>Invoice Value: <b id="tVal">${money(totals.value)}</b> USD</span>
          <span>FOB Value: <b id="tFob">${money(totals.fob)}</b> USD</span>
        </div>
      </div>

      <div class="toolbar" style="justify-content:flex-start">
        <select name="status" style="width:auto">
          <option value="draft" ${invoice.status === 'draft' ? 'selected' : ''}>Draft</option>
          <option value="final" ${invoice.status === 'final' ? 'selected' : ''}>Final</option>
        </select>
        <button type="submit" class="btn">${editing ? 'Save Changes' : 'Create Invoice'}</button>
        <a class="btn secondary" href="${editing ? '#/invoices/' + id : '#/invoices'}">Cancel</a>
      </div>
    </form>
  `;

  wireInvoiceForm(editing, id);
}

function readFormValues() {
  const form = document.getElementById('invForm');
  const data = Object.fromEntries(new FormData(form).entries());
  Object.assign(formState.invoice, data);
}

function refreshTotalsUI() {
  const t = computeTotals();
  document.getElementById('tPkgs').textContent = t.packages;
  document.getElementById('tNw').textContent = money(t.nw);
  document.getElementById('tGw').textContent = money(t.gw);
  document.getElementById('tVal').textContent = money(t.value);
  document.getElementById('tFob').textContent = money(t.fob);
  document.querySelectorAll('#itemsBody tr').forEach(row => {
    const key = row.dataset.key;
    const it = formState.items.find(i => i.key === key);
    if (!it) return;
    row.querySelector('.amount-cell').textContent = money((Number(it.quantity) || 0) * (Number(it.cif_rate) || 0));
    const needsSetup = it.product_id && it.packing.some(p => !Number(p.nw_per_package_kg) || !Number(p.gw_per_package_kg));
    row.querySelector('.pkg-warning').style.display = needsSetup ? 'block' : 'none';
  });
}

function wireInvoiceForm(editing, id) {
  document.getElementById('customerSelect').addEventListener('change', e => {
    formState.invoice.customer_id = e.target.value;
    if (!editing) {
      applyCustomerDefaults(e.target.value);
      // Targeted update only (no full repaint) so we never destroy focused/about-to-be-clicked
      // elements elsewhere on the form — only fill fields the user hasn't already typed into.
      const form = document.getElementById('invForm');
      const setIfEmpty = (name, value) => { if (form[name] && !form[name].value && value) form[name].value = value; };
      setIfEmpty('country_of_final_destination', formState.invoice.country_of_final_destination);
      setIfEmpty('final_destination', formState.invoice.final_destination);
      setIfEmpty('seaport_of_discharge', formState.invoice.seaport_of_discharge);
      setIfEmpty('delivery_terms', formState.invoice.delivery_terms);
      setIfEmpty('payment_terms', formState.invoice.payment_terms);
    }
  });

  document.getElementById('addItemBtn').addEventListener('click', () => {
    readFormValues();
    formState.items.push(newItemRow(''));
    paintInvoiceForm(editing, id);
  });

  document.getElementById('itemsBody').addEventListener('click', e => {
    if (e.target.dataset.remove) {
      readFormValues();
      formState.items = formState.items.filter(i => i.key !== e.target.dataset.remove);
      paintInvoiceForm(editing, id);
      return;
    }
    // Structural changes (adding/removing a packing split) change how many rows render, so
    // — unlike the field-level edits below — these repaint the whole form. That's safe here
    // because button clicks are discrete events, not the rapid-typing case the input handler
    // below is careful to avoid repainting on.
    if (e.target.dataset.addSplit) {
      readFormValues();
      const it = formState.items.find(i => i.key === e.target.dataset.addSplit);
      if (it) it.packing.push(newPackingRow(it.packing[it.packing.length - 1]));
      paintInvoiceForm(editing, id);
      return;
    }
    if (e.target.dataset.removeSplit) {
      readFormValues();
      const it = formState.items.find(i => i.key === e.target.dataset.item);
      if (it && it.packing.length > 1) it.packing = it.packing.filter(p => p.key !== e.target.dataset.removeSplit);
      paintInvoiceForm(editing, id);
    }
  });

  // 'input' (not 'change') so totals/packages update live as the user types, and so state is
  // never left stale waiting on a blur that a fast click-to-submit might skip.
  document.getElementById('itemsBody').addEventListener('input', e => {
    const row = e.target.closest('tr');
    const key = row.dataset.key;
    const it = formState.items.find(i => i.key === key);
    const f = e.target.dataset.f;
    if (!f) return;
    // Field-level edits update state + the DOM in place (no full re-render). Re-rendering the
    // whole form here would replace elements like the Submit button mid-interaction: a user who
    // edits a field and immediately clicks Submit would have that click land on a now-detached
    // element and silently do nothing. Only structural changes (add/remove row) repaint.
    if (f === 'product_id') {
      const p = formState.products.find(p => String(p.id) === e.target.value);
      it.product_id = e.target.value;
      // Changing the product invalidates any splits configured for the old one, so collapse
      // back to a single packing row seeded from the new product's defaults.
      if (it.packing.length > 1) {
        readFormValues();
        it.packing = [newPackingRow(p)];
        if (p && it.quantity) it.packing[0].no_of_packages = Math.ceil(Number(it.quantity) / (p.qty_per_package || 1));
        paintInvoiceForm(editing, id);
        return;
      }
      if (p) {
        it.pack_size = p.pack_size;
        it.cif_rate = p.default_cif_rate;
        it.batch_no = it.batch_no || p.batch_prefix;
        it.packing[0].dimensions_mm = p.dimensions_mm;
        it.packing[0].qty_per_package = p.qty_per_package;
        it.packing[0].nw_per_package_kg = p.nw_per_package_kg;
        it.packing[0].gw_per_package_kg = p.gw_per_package_kg;
        if (it.quantity) it.packing[0].no_of_packages = Math.ceil(Number(it.quantity) / p.qty_per_package);
        row.querySelector('[data-f="pack_size"]').value = it.pack_size || '';
        row.querySelector('[data-f="batch_no"]').value = it.batch_no || '';
        row.querySelector('[data-f="cif_rate"]').value = it.cif_rate || '';
        row.querySelector('[data-f="pk_dimensions_mm"]').value = it.packing[0].dimensions_mm || '';
        row.querySelector('[data-f="pk_qty_per_package"]').value = it.packing[0].qty_per_package || '';
        row.querySelector('[data-f="pk_nw"]').value = it.packing[0].nw_per_package_kg || '';
        row.querySelector('[data-f="pk_gw"]').value = it.packing[0].gw_per_package_kg || '';
        row.querySelector('[data-f="pk_no_of_packages"]').value = it.packing[0].no_of_packages || 0;
      }
      refreshTotalsUI();
      return;
    }
    if (f === 'quantity') {
      it.quantity = e.target.value;
      // Only auto-fill the package count when there's just one (unsplit) packing row — once a
      // line has multiple splits, package counts are managed manually per split.
      if (it.packing.length === 1) {
        const qpp = Number(it.packing[0].qty_per_package) || 1;
        it.packing[0].no_of_packages = Math.ceil((Number(it.quantity) || 0) / qpp);
        row.querySelector('[data-f="pk_no_of_packages"]').value = it.packing[0].no_of_packages || 0;
      }
      refreshTotalsUI();
      return;
    }
    if (f === 'cif_rate') { it[f] = e.target.value; refreshTotalsUI(); return; }
    if (f === 'pack_size' || f === 'batch_no' || f === 'mfg_date' || f === 'exp_date') { it[f] = e.target.value; return; }
    if (f && f.startsWith('pk_')) {
      const pk = it.packing.find(p => p.key === e.target.dataset.pk) || it.packing[0];
      if (!pk) return;
      if (f === 'pk_no_of_packages') pk.no_of_packages = e.target.value;
      else if (f === 'pk_qty_per_package') pk.qty_per_package = e.target.value;
      else if (f === 'pk_dimensions_mm') pk.dimensions_mm = e.target.value;
      else if (f === 'pk_nw') pk.nw_per_package_kg = e.target.value;
      else if (f === 'pk_gw') pk.gw_per_package_kg = e.target.value;
      refreshTotalsUI();
    }
  });

  document.getElementById('invForm').addEventListener('submit', async e => {
    e.preventDefault();
    readFormValues();
    const payload = { ...formState.invoice };
    payload.items = formState.items
      .filter(i => i.product_id && i.quantity)
      .map(i => ({
        product_id: i.product_id, pack_size: i.pack_size, batch_no: i.batch_no,
        mfg_date: i.mfg_date, exp_date: i.exp_date, quantity: Number(i.quantity), cif_rate: Number(i.cif_rate) || 0,
        packing: i.packing.map(p => ({
          dimensions_mm: p.dimensions_mm, qty_per_package: Number(p.qty_per_package) || 1,
          no_of_packages: Number(p.no_of_packages) || 0,
          nw_per_package_kg: Number(p.nw_per_package_kg) || 0, gw_per_package_kg: Number(p.gw_per_package_kg) || 0,
        })),
      }));
    if (!payload.items.length) { toast('Add at least one product with a quantity.', true); return; }
    try {
      let result;
      if (editing) result = await API.invoices.update(id, payload);
      else result = await API.invoices.create(payload);
      toast('Invoice saved.');
      go('#/invoices/' + result.invoice.id);
    } catch (err) { toast(err.message, true); }
  });
}
