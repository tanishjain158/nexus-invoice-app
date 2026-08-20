function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function money(n) { return Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function num(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }); }
function todayISO() { return new Date().toISOString().slice(0, 10); }

function toast(msg, isError) {
  const box = document.getElementById('toast');
  const el = document.createElement('div');
  el.className = 'toast-item' + (isError ? ' error' : '');
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

function field(label, inputHtml) {
  return `<div class="field"><label>${esc(label)}</label>${inputHtml}</div>`;
}
