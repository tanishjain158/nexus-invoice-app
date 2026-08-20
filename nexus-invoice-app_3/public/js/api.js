const API = (() => {
  async function req(method, url, body) {
    const opts = { method, headers: {} };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      let msg = res.statusText;
      try { const j = await res.json(); msg = j.error || msg; } catch (e) {}
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  return {
    exporters: { list: () => req('GET', '/api/exporters'), update: (id, b) => req('PUT', `/api/exporters/${id}`, b) },
    products: {
      list: () => req('GET', '/api/products'),
      get: id => req('GET', `/api/products/${id}`),
      create: b => req('POST', '/api/products', b),
      update: (id, b) => req('PUT', `/api/products/${id}`, b),
      remove: id => req('DELETE', `/api/products/${id}`),
    },
    customers: {
      list: q => req('GET', `/api/customers${q ? '?q=' + encodeURIComponent(q) : ''}`),
      get: id => req('GET', `/api/customers/${id}`),
      invoices: id => req('GET', `/api/customers/${id}/invoices`),
      create: b => req('POST', '/api/customers', b),
      update: (id, b) => req('PUT', `/api/customers/${id}`, b),
      remove: id => req('DELETE', `/api/customers/${id}`),
    },
    invoices: {
      list: () => req('GET', '/api/invoices'),
      get: id => req('GET', `/api/invoices/${id}`),
      nextNumber: exporterId => req('GET', `/api/invoices/next-number?exporter_id=${exporterId}`),
      create: b => req('POST', '/api/invoices', b),
      update: (id, b) => req('PUT', `/api/invoices/${id}`, b),
      remove: id => req('DELETE', `/api/invoices/${id}`),
      pdfUrl: id => `/api/invoices/${id}/pdf`,
    },
  };
})();
