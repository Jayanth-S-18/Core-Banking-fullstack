const API = ''; // same origin - Express serves this file and the API together

const fmtMoney = (n, ccy) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy || 'USD' }).format(n);

const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

async function checkHealth() {
  const el = document.getElementById('connStatus');
  try {
    const res = await fetch(`${API}/api/health`);
    const data = await res.json();
    if (data.status === 'ok') {
      el.textContent = 'database connected';
      el.className = 'conn-status ok';
    } else {
      throw new Error(data.database || 'unknown error');
    }
  } catch (err) {
    el.textContent = `database unreachable — ${err.message}`;
    el.className = 'conn-status err';
  }
}

async function loadAccounts() {
  const body = document.getElementById('accountsBody');
  const countEl = document.getElementById('accountCount');
  const fromSel = document.getElementById('fromAccount');
  const toSel = document.getElementById('toAccount');

  try {
    const res = await fetch(`${API}/api/accounts`);
    const accounts = await res.json();
    if (!res.ok) throw new Error(accounts.error || 'failed to load accounts');

    countEl.textContent = `${accounts.length} account${accounts.length === 1 ? '' : 's'}`;

    body.innerHTML = accounts.length
      ? accounts.map(a => `
        <tr>
          <td class="acct-number">${a.account_number}</td>
          <td>${a.full_name}</td>
          <td>${a.account_type}</td>
          <td>${a.branch_name}</td>
          <td class="balance">${fmtMoney(a.balance, a.currency)}</td>
          <td><span class="status-pill ${a.status.toLowerCase()}">${a.status}</span></td>
        </tr>
      `).join('')
      : `<tr><td colspan="6" class="empty">No accounts yet.</td></tr>`;

    const options = accounts
      .map(a => `<option value="${a.account_id}">${a.account_number} — ${a.full_name} (${fmtMoney(a.balance, a.currency)})</option>`)
      .join('');
    fromSel.innerHTML = options;
    toSel.innerHTML = options;
    if (accounts.length > 1) toSel.selectedIndex = 1;
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty">Couldn't load accounts — ${err.message}</td></tr>`;
  }
}

async function loadAuditLog() {
  const feed = document.getElementById('auditFeed');
  try {
    const res = await fetch(`${API}/api/audit-logs?limit=25`);
    const logs = await res.json();
    if (!res.ok) throw new Error(logs.error || 'failed to load audit log');

    feed.innerHTML = logs.length
      ? logs.map(l => `
        <li>
          <div class="audit-line">
            <span class="audit-what">${l.table_name} #${l.record_id} · <span class="field">${l.column_name || l.operation}</span></span>
            <span class="audit-meta">${fmtTime(l.changed_at)}</span>
          </div>
          <div class="audit-change">${l.old_value ?? '—'} → ${l.new_value ?? '—'} &nbsp;·&nbsp; by ${l.changed_by}</div>
        </li>
      `).join('')
      : `<li class="empty">No activity logged yet.</li>`;
  } catch (err) {
    feed.innerHTML = `<li class="empty">Couldn't load activity — ${err.message}</li>`;
  }
}

async function refreshAll() {
  await Promise.all([loadAccounts(), loadAuditLog()]);
}

document.getElementById('transferForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('submitBtn');
  const statusEl = document.getElementById('transferStatus');

  const payload = {
    from_account_id: Number(document.getElementById('fromAccount').value),
    to_account_id: Number(document.getElementById('toAccount').value),
    amount: Number(document.getElementById('amount').value),
    reference_no: document.getElementById('reference').value.trim() || `WEB-${Date.now()}`,
    initiated_by: document.getElementById('initiatedBy').value.trim() || 'dashboard_user',
  };

  if (payload.from_account_id === payload.to_account_id) {
    statusEl.textContent = 'Source and destination accounts must be different.';
    statusEl.className = 'form-status error';
    return;
  }

  btn.disabled = true;
  statusEl.textContent = 'Sending…';
  statusEl.className = 'form-status';

  try {
    const res = await fetch(`${API}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      statusEl.textContent = data.result;
      statusEl.className = 'form-status success';
      document.getElementById('amount').value = '';
      document.getElementById('reference').value = '';
      await refreshAll();
    } else {
      statusEl.textContent = data.result || data.error || 'Transfer failed.';
      statusEl.className = 'form-status error';
    }
  } catch (err) {
    statusEl.textContent = `Network error — ${err.message}`;
    statusEl.className = 'form-status error';
  } finally {
    btn.disabled = false;
  }
});

checkHealth();
refreshAll();
setInterval(refreshAll, 8000); // keep the ledger live without a manual refresh
