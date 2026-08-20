const { numberToWordsUSD, fmtMoney, fmtNum } = require('../utils');

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtDate(d) {
  if (!d) return '';
  const parts = String(d).split('-');
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`; // YYYY-MM-DD -> DD/MM/YYYY
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`; // YYYY-MM -> MM/YYYY
  return esc(d);
}

function numberInWords(n) {
  const w = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',
    'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];
  function two(x) { return x < 20 ? w[x] : (tens[Math.floor(x / 10)] + (x % 10 ? '-' + w[x % 10] : '')); }
  function three(x) {
    let s = '';
    if (x >= 100) { s += w[Math.floor(x / 100)] + ' HUNDRED '; x %= 100; }
    if (x) s += two(x);
    return s.trim();
  }
  if (n === 0) return 'ZERO';
  let s = '';
  const th = Math.floor(n / 1000); n %= 1000;
  if (th) s += three(th) + ' THOUSAND ';
  if (n) s += three(n);
  return s.trim();
}

function headerBlock({ docType, invoice, exporter, customer, pageLabel }) {
  const title = docType === 'invoice' ? 'EXPORT COMMERCIAL INVOICE' : 'PACKING LIST';
  const dischargeLabel = docType === 'invoice' ? 'Seaport of Discharge' : 'Port of Discharge';
  return `
  <div class="doc-title">${title}</div>
  <table class="frame">
    <tr>
      <td style="width:52%" rowspan="1">
        <div class="label">Exporter</div>
        <div class="bold">${esc(exporter.name)}</div>
        <div>${esc(exporter.address)}</div>
      </td>
      <td style="width:30%">
        <div class="label">Invoice No. &amp; Date</div>
        <div class="bold">${esc(invoice.invoice_no)} dt.${fmtDate(invoice.invoice_date)}</div>
      </td>
      <td style="width:18%">
        <div class="label">Exporter's Ref :</div>
        <div>${esc(invoice.exporters_ref)}</div>
      </td>
    </tr>
    <tr>
      <td rowspan="1"></td>
      <td colspan="2">
        <div class="label">Buyer's Order No. &amp; Date</div>
        <div class="bold">${esc(invoice.buyer_order_no)}${invoice.buyer_order_date ? ', dt.' + fmtDate(invoice.buyer_order_date) : ''}</div>
        <div class="right">${pageLabel}</div>
      </td>
    </tr>
    <tr>
      <td></td>
      <td colspan="2">
        <div class="label">Other Reference(s)</div>
        <div>${esc(invoice.other_references)}</div>
      </td>
    </tr>
  </table>
  <table class="frame">
    <tr>
      <td style="width:52%">
        <div class="label">Consignee</div><br/>
        <div class="bold">${esc(customer.name)}</div>
        <div>${esc(customer.consignee_address)}</div>
      </td>
      <td style="width:48%" colspan="2">
        <div class="label">Buyer (If other than consignee):</div>
        <div>${esc(customer.buyer_name)}</div>
        <div>${esc(customer.buyer_address)}</div>
      </td>
    </tr>
    <tr>
      <td rowspan="2" style="vertical-align:top">
        <table style="width:100%;border-collapse:collapse">
          <tr>
            <td style="width:50%;border:none;padding:0 4px 0 0">
              <div class="label">Pre-Carriage by</div>
              <div class="center bold">${esc(invoice.pre_carriage_by)}</div>
            </td>
            <td style="border:none;padding:0">
              <div class="label">Place of Receipt by Pre-carrier</div>
              <div class="center">${esc(invoice.place_of_receipt)}</div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-top:6px">
          <tr>
            <td style="width:50%;border:none;padding:0 4px 0 0">
              <div class="label">Vessel Name &amp; No.</div>
              <div class="center bold">${esc(invoice.vessel_name)}</div>
            </td>
            <td style="border:none;padding:0">
              <div class="label">Port of Loading</div>
              <div class="center">${esc(invoice.port_of_loading)}</div>
            </td>
          </tr>
        </table>
        <table style="width:100%;border-collapse:collapse;margin-top:6px">
          <tr>
            <td style="width:50%;border:none;padding:0 4px 0 0">
              <div class="label">${dischargeLabel}</div>
              <div class="center bold">${esc(invoice.seaport_of_discharge)}</div>
            </td>
            <td style="border:none;padding:0">
              <div class="label">Final Destination</div>
              <div class="center">${esc(invoice.final_destination)}</div>
            </td>
          </tr>
        </table>
      </td>
      <td colspan="2">
        <div class="label">Country of Origin of Goods</div>
        <div class="center bold">${esc(invoice.country_of_origin)}</div>
      </td>
    </tr>
    <tr>
      <td colspan="2" style="border-top:none">
        <div class="label">Country of Final Destination</div>
        <div class="center bold">${esc(invoice.country_of_final_destination)}</div>
      </td>
    </tr>
    <tr>
      <td colspan="3" class="terms-box">
        <div class="label">Terms of Delivery and Payment</div>
        <p class="bold">${esc(invoice.delivery_terms)}</p>
        <p class="bold">${esc(invoice.payment_terms)}</p>
        <p class="bold">Account Name: ${esc(exporter.bank_account_name)}</p>
        <p class="bold">Bank name: ${esc(exporter.bank_name)}</p>
        <p class="bold">Account No.: ${esc(exporter.bank_account_no)}</p>
        <p class="bold">SWIFT CODE: ${esc(exporter.bank_swift_code)}</p>
        <p class="bold">Branch Address: ${esc(exporter.bank_branch_address)}</p>
        ${invoice.container_no ? `<p class="bold">Container no: ${esc(invoice.container_no)}</p>` : ''}
        ${invoice.c_seal_number ? `<p class="bold">C Seal number: ${esc(invoice.c_seal_number)}</p>` : ''}
        ${invoice.a_seal_number ? `<p class="bold">A seal number: ${esc(invoice.a_seal_number)}</p>` : ''}
      </td>
    </tr>
  </table>`;
}

function marksColumn(exporter, totalPackages) {
  return `Export by:<br/><b>${esc(exporter.name)}</b><br/>Product Name:<br/>Carton No.:<br/>Mfg. Date:<br/>Exp. Date:<br/>Product Origin:<br/>Description:<br/><b>ANIMAL FEED SUPPLEMENTS</b><br/><br/>F1/F${totalPackages}<br/>Packages to<br/>F${totalPackages}/F${totalPackages}<br/>Packages<br/>(${esc(numberInWords(totalPackages))} Only)`;
}

function invoicePages(full) {
  const { invoice, exporter, customer, items, totals } = full;
  const perPage = 4;
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const totalPages = pages.length;
  const totalPackages = totals.total_packages;

  return pages.map((pageItems, idx) => {
    const isLast = idx === pages.length - 1;

    return `
    ${idx > 0 ? '<div class="page-break"></div>' : ''}
    ${headerBlock({ docType: 'invoice', invoice, exporter, customer, pageLabel: `Page ${idx + 1} of ${totalPages}` })}
    <table class="goods-table">
      <thead>
        <tr>
          <th style="width:20%">Marks &amp; Nos./.</th>
          <th style="width:12%">No. &amp; Kind of Pkg</th>
          <th style="width:34%">Description of Goods<br/><span class="bold">ANIMAL FEED SUPPLEMENTS</span></th>
          <th style="width:11%">Quantity</th>
          <th style="width:11%">C.I.F Rate<br/>USD</th>
          <th style="width:12%">Amount<br/>USD</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowspan="2" style="vertical-align:top">${marksColumn(exporter, totalPackages)}</td>
          <td style="vertical-align:top">Total ${totalPackages}<br/>Packages</td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `
              <div class="item-block">
                <div class="item-title">${esc(item.product_name)}</div>
                <div>PACK SIZE: ${esc(item.pack_size)}</div>
                <div>BATCH NO: ${esc(item.batch_no)}</div>
                <div>EXP. DATE: ${fmtDate(item.exp_date)}</div>
              </div>`).join('')}
            ${isLast ? `
              <div style="margin-top:10px">
                <div>INDIAN ORIGIN</div>
                <div class="bold">CIF BREAKDOWN</div>
                <div class="bold">TOTAL INVOICE VALUE: USD ${fmtMoney(totals.total_invoice_value)}</div>
                <div class="bold">SEA FREIGHT CHARGES: USD ${fmtMoney(invoice.sea_freight_charges)}</div>
                <div class="bold">INSURANCE CHARGES: USD ${fmtMoney(invoice.insurance_charges)}</div>
                <div class="bold">FOB VALUE: USD ${fmtMoney(totals.fob_value)}</div>
              </div>` : ''}
          </td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `<div class="item-block center">${fmtNum(item.quantity)}</div>`).join('')}
          </td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `<div class="item-block center">${fmtMoney(item.cif_rate)}</div>`).join('')}
          </td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `<div class="item-block right">${fmtMoney(item.amount)}</div>`).join('')}
          </td>
        </tr>
        <tr><td colspan="5" class="goods-rows-fill"></td></tr>
      </tbody>
    </table>
    <table class="frame" style="margin-top:-1px">
      <tr>
        <td style="width:70%">
          <div>Amount Chargeable</div>
          <div>(in words)${isLast ? ' ' + esc(numberToWordsUSD(totals.total_invoice_value)) : ''}</div>
        </td>
        <td style="width:30%" class="right bold">${isLast ? `TOTAL USD<br/>${fmtMoney(totals.total_invoice_value)}` : ''}</td>
      </tr>
      <tr>
        <td colspan="2">
          <div>NET WT. &nbsp;&nbsp;: ${fmtMoney(totals.total_net_weight)} KGS &nbsp;&nbsp;&nbsp;&nbsp; NO.OF PACKAGES : ${totalPackages} PACKAGES</div>
          <div>GROSS WT : ${fmtMoney(totals.total_gross_weight)} KGS</div>
          ${isLast ? `
          <div class="bold" style="margin-top:6px">WE HEREBY CERTIFY THAT MERCHANDISE TO BE OF INDIAN ORIGIN</div>
          <div class="bold">ITC HS CODE &ndash; ${esc(items[0] ? items[0].hs_code || '2309.90.10' : '2309.90.10')}</div>
          ${invoice.bill_number ? `<div class="bold">Bill Number and Date: ${esc(invoice.bill_number)}${invoice.bill_date ? ' Dt.' + fmtDate(invoice.bill_date) : ''}.</div>` : ''}
          ` : ''}
        </td>
      </tr>
      <tr>
        <td style="width:70%">
          <div>Declaration :</div>
          <div>${esc(exporter.declaration_text)}</div>
        </td>
        <td style="width:30%">Signature &amp; Date</td>
      </tr>
    </table>`;
  }).join('\n');
}

function packingPages(full) {
  const { invoice, exporter, customer, items, totals } = full;
  const perPage = 4;
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  const totalPages = pages.length;
  const totalPackages = totals.total_packages;

  return pages.map((pageItems, idx) => {
    const isLast = idx === pages.length - 1;
    return `
    <div class="page-break"></div>
    ${headerBlock({ docType: 'packing', invoice, exporter, customer, pageLabel: `Page ${idx + 1} of ${totalPages}` })}
    <table class="goods-table">
      <thead>
        <tr>
          <th style="width:20%">Marks &amp; Nos./.</th>
          <th style="width:12%">No. &amp; Kind of Pkg</th>
          <th style="width:30%">Description of Good<br/><span class="bold">ANIMAL FEED SUPPLEMENTS</span></th>
          <th style="width:12%">Quantity</th>
          <th style="width:13%">NET WT. in KGs.</th>
          <th style="width:13%">GROSS WT. in KGs.</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td rowspan="2" style="vertical-align:top">${marksColumn(exporter, totalPackages)}</td>
          <td style="vertical-align:top">Total ${totalPackages}<br/>Packages</td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `
              <div class="item-block">
                <div class="item-title">${esc(item.product_name)}</div>
                <div>PACK SIZE: ${esc(item.pack_size)}</div>
                <div>BATCH NO: ${esc(item.batch_no)}</div>
                <div>EXP. DATE: ${fmtDate(item.exp_date)}</div>
              </div>`).join('')}
            ${isLast ? `<div class="bold" style="margin-top:14px">DETAILED PACKING LIST AS PER ANNEXURE</div>` : ''}
          </td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `<div class="item-block center">${fmtNum(item.quantity)}</div>`).join('')}
          </td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `<div class="item-block center">${fmtMoney(item.packing.reduce((s, p) => s + p.no_of_packages * p.nw_per_package_kg, 0))}</div>`).join('')}
          </td>
          <td style="vertical-align:top">
            ${pageItems.map(item => `<div class="item-block center">${fmtMoney(item.packing.reduce((s, p) => s + p.no_of_packages * p.gw_per_package_kg, 0))}</div>`).join('')}
          </td>
        </tr>
        <tr><td colspan="5" class="goods-rows-fill"></td></tr>
      </tbody>
    </table>
    <table class="frame" style="margin-top:-1px">
      <tr>
        <td colspan="2">
          <div>NET WT. &nbsp;&nbsp;: ${fmtMoney(totals.total_net_weight)} KGS &nbsp;&nbsp;&nbsp;&nbsp; NO.OF PACKAGES : ${totalPackages} PACKAGES</div>
          <div>GROSS WT : ${fmtMoney(totals.total_gross_weight)} KGS</div>
        </td>
      </tr>
      <tr>
        <td style="width:70%">
          <div>Declaration :</div>
          <div>${esc(exporter.declaration_text)}</div>
        </td>
        <td style="width:30%">Signature &amp; Date</td>
      </tr>
    </table>`;
  }).join('\n');
}

function annexurePage(full) {
  const { invoice, items, totals } = full;
  const rows = [];
  let sr = 1;
  for (const item of items) {
    for (const pl of item.packing) {
      rows.push(`
        <tr>
          <td>${sr++}</td>
          <td style="text-align:left">${esc(item.product_name)}<br/>${esc(item.pack_size)}</td>
          <td>${esc(pl.dimensions_mm)}</td>
          <td>${pl.qty_per_package}</td>
          <td>${pl.no_of_packages}</td>
          <td>F${pl.box_from} to F${pl.box_to}</td>
          <td>${esc(item.batch_no)}</td>
          <td>${fmtDate(item.mfg_date)}</td>
          <td>${fmtDate(item.exp_date)}</td>
          <td>${fmtNum(pl.nw_per_package_kg)}</td>
          <td>${fmtNum(pl.gw_per_package_kg)}</td>
        </tr>`);
    }
  }
  return `
  <div class="page-break"></div>
  <div class="annexure-title">ANNEXURE TO PACKING LIST NUMBER: ${esc(invoice.invoice_no)} dt.${fmtDate(invoice.invoice_date)}</div>
  <table class="annexure-table">
    <thead>
      <tr>
        <th style="width:4%">Sr.<br/>No.</th>
        <th style="width:16%">Name of Product</th>
        <th style="width:9%">Dimension<br/>in mm</th>
        <th style="width:8%">Qty per<br/>Package</th>
        <th style="width:8%">No. of<br/>Packages</th>
        <th style="width:11%">Sr. No.<br/>of Boxes</th>
        <th style="width:10%">Batch<br/>No.</th>
        <th style="width:8%">Mfg.<br/>Dt.</th>
        <th style="width:8%">Exp.<br/>Dt.</th>
        <th style="width:9%">NW /<br/>Package (kg)</th>
        <th style="width:9%">GW /<br/>Package (kg)</th>
      </tr>
    </thead>
    <tbody>${rows.join('')}</tbody>
  </table>
  <p class="bold" style="margin-top:14px">NO. OF PACKAGES: ${totals.total_packages} (${esc(numberInWords(totals.total_packages))} Only)</p>
  <p class="bold">NET WEIGHT: ${fmtMoney(totals.total_net_weight)} KGS</p>
  <p class="bold">GROSS WEIGHT: ${fmtMoney(totals.total_gross_weight)} KGS</p>`;
}

function buildFullHtml(full, styles) {
  return `<!doctype html>
  <html>
  <head><meta charset="utf-8"/><style>${styles}</style></head>
  <body>
    ${invoicePages(full)}
    ${packingPages(full)}
    ${annexurePage(full)}
  </body>
  </html>`;
}

module.exports = { buildFullHtml };
