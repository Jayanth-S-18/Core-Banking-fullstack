const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const inr = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const when = d => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
let accounts = [], txType = 'deposit';

function toast(msg, type = 'info') {
  const t = document.createElement('div'); t.className = 'toast ' + type;
  t.textContent = msg;
  $('#toasts').append(t); setTimeout(() => t.remove(), 4500);
}
async function api(path, body) {
  try {
    const r = await fetch('/api' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    const j = await r.json(); return r.ok ? j : { ok: false, message: j.message || 'Request failed' };
  } catch { return { ok: false, message: 'Cannot reach the API. Is the backend running?', offline: true }; }
}
const statusPill = s => `<span class="pill ${s === 'SUCCESS' || s === 'ACTIVE' || s === 'VERIFIED' ? 'ok' : s === 'FAILED' ? 'fail' : 'warn'}">${esc(s)}</span>`;

async function load() {
  const [acc, st, tx, au, h] = await Promise.all([api('/accounts'), api('/stats'), api('/transactions'), api('/audit-logs'), api('/health')]);
  const hb = $('#health');
  if (h.status === 'ok') { hb.className = 'health ok'; hb.textContent = '● API + database connected'; }
  else { hb.className = 'health bad'; hb.textContent = '● Backend/database unreachable'; return; }
  accounts = acc; renderAccounts(); renderStats(st); renderTx(tx); renderAudit(au); fillSelects(st.branches);
}
function renderStats(s) {
  $('#cards').innerHTML = [['Total deposits', inr(s.total)], ['Customers', s.users], ['Accounts', s.accounts], ['Transactions', s.txns], ['Failed attempts', s.failed]]
    .map(([k, v]) => `<div class="card"><small>${k}</small><b>${v}</b></div>`).join('');
  const max = Math.max(...s.branches.map(b => b.total_balance), 1);
  $('#branchBars').innerHTML = s.branches.map(b => `<div class="bar"><div style="display:flex;justify-content:space-between;background:none;height:auto"><span>#${b.balance_rank} ${esc(b.name)}, ${esc(b.city)} <small>(${b.accounts} acc)</small></span><b>${inr(b.total_balance)}</b></div><div><i style="width:${b.total_balance / max * 100}%"></i></div></div>`).join('');
}
function renderAccounts() {
  $('#accRows').innerHTML = accounts.map(a => `<tr data-id="${a.account_id}"><td><b>${esc(a.account_no)}</b></td><td>${esc(a.full_name)}</td><td>${esc(a.branch_name)}, ${esc(a.city)}</td><td>${esc(a.type)}</td><td>${statusPill(a.status)}</td><td class="r">${inr(a.balance)}</td></tr>`).join('');
}
function renderTx(tx) {
  const row = t => `<tr><td>${t.txn_id}</td><td>${t.txn_type}</td><td>${esc(t.from_no || '—')}</td><td>${esc(t.to_no || '—')}</td><td class="r">${inr(t.amount)}</td><td>${statusPill(t.status)}</td><td>${esc(t.initiated_by)}</td><td>${when(t.created_at)}</td></tr>`;
  $('#txRows').innerHTML = tx.map(row).join('');
  $('#latest').innerHTML = tx.slice(0, 5).map(t => `<div class="item"><div>${t.txn_type} ${statusPill(t.status)}<small>${esc(t.from_no || 'Cash')} → ${esc(t.to_no || 'Cash')} · ${when(t.created_at)}</small></div><b>${inr(t.amount)}</b></div>`).join('');
}
function renderAudit(au) {
  $('#auRows').innerHTML = au.map(l => `<tr><td>${l.log_id}</td><td>${esc(l.account_no)}</td><td class="r">${inr(l.old_balance)}</td><td class="r">${inr(l.new_balance)}</td><td>${esc(l.changed_by)}</td><td>${when(l.changed_at)}</td></tr>`).join('');
}
function fillSelects(branches) {
  const opts = accounts.filter(a => a.status === 'ACTIVE').map(a => `<option value="${a.account_id}">${esc(a.account_no)} · ${esc(a.full_name)} (${inr(a.balance)})</option>`).join('')
    + accounts.filter(a => a.status !== 'ACTIVE').map(a => `<option value="${a.account_id}">${esc(a.account_no)} · ${esc(a.full_name)} [FROZEN]</option>`).join('');
  const keepA = $('#selA').value, keepB = $('#selB').value;
  $('#selA').innerHTML = opts; $('#selB').innerHTML = opts;
  if (keepA) $('#selA').value = keepA; if (keepB) $('#selB').value = keepB;
  if (!$('#branchSel').options.length) $('#branchSel').innerHTML = branches.map(b => `<option value="${b.branch_id}">${esc(b.name)}, ${esc(b.city)}</option>`).join('');
}

// Navigation: every click gives feedback
$$('nav button').forEach(b => b.onclick = () => {
  $$('nav button, .page').forEach(e => e.classList.remove('on')); b.classList.add('on'); $('#' + b.dataset.page).classList.add('on');
});
// Transaction tabs
$$('#tabs button').forEach(b => b.onclick = () => {
  $$('#tabs button').forEach(x => x.classList.remove('on')); b.classList.add('on'); txType = b.dataset.t;
  $('#toWrap').hidden = txType !== 'transfer'; $('#fromLbl').textContent = txType === 'transfer' ? 'From account' : 'Account';
  $('#txBtn').textContent = { deposit: 'Deposit money', withdraw: 'Withdraw money', transfer: 'Transfer money' }[txType];
 
});
$('#txForm').onsubmit = async e => {
  e.preventDefault(); const f = Object.fromEntries(new FormData(e.target)); const btn = $('#txBtn'); btn.disabled = true;
  const body = txType === 'transfer' ? { from_account: f.account, to_account: f.to_account, amount: f.amount, initiated_by: f.initiated_by } : f;
  const r = await api('/' + txType, body); btn.disabled = false;
  toast(r.message, r.ok ? 'success' : 'error'); if (r.ok) e.target.amount.value = ''; load();
};
$('#newUser').onsubmit = async e => {
  e.preventDefault(); const r = await api('/users', Object.fromEntries(new FormData(e.target)));
  toast(r.message, r.ok ? 'success' : 'error'); if (r.ok) { e.target.reset(); load(); }
};
// Account details modal
$('#accRows').onclick = e => {
  const tr = e.target.closest('tr'); if (!tr) return; const a = accounts.find(x => x.account_id == tr.dataset.id);
  $('#mBody').innerHTML = `<h2>${esc(a.full_name)}</h2><p class="sub">${esc(a.account_no)} · ${esc(a.type)} ${statusPill(a.status)}</p><h1>${inr(a.balance)}</h1>
  <div class="kv"><span>Email</span><span>${esc(a.email)}</span><span>Phone</span><span>${esc(a.phone)}</span><span>Address</span><span>${esc(a.address || '—')}</span>
  <span>Date of birth</span><span>${esc((a.dob || '—').toString().slice(0, 10))}</span><span>PAN</span><span>${esc(a.pan || '—')}</span><span>KYC</span><span>${statusPill(a.kyc_status)}</span>
  <span>Branch</span><span>${esc(a.branch_name)} (${esc(a.ifsc)})</span><span>Opened on</span><span>${esc(String(a.opened_on).slice(0, 10))}</span></div>`;
  $('#modal').hidden = false;
};
$('#mx').onclick = () => $('#modal').hidden = true; $('#modal').onclick = e => { if (e.target.id === 'modal') e.target.hidden = true; };

load();
setInterval(load, 8000);
