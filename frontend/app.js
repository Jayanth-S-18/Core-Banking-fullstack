const API = ''; // same origin - Express serves this file and the API together

const fmtMoney = (n, ccy) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: ccy || 'USD' }).format(Number(n || 0));

const maskEmail = (value = '') => {
  if (!value) return '—';
  const [local, domain] = String(value).split('@');
  if (!domain) return `${value.slice(0, 2)}***`;
  return `${local.slice(0, 2)}***@${domain}`;
};

const maskPhone = (value = '') => {
  if (!value) return '—';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length <= 4) return '***';
  return `*** *** ${digits.slice(-4)}`;
};

const fmtTime = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};

const slugify = (value = '') => value.toLowerCase().replace(/\s+/g, '-');

function setStatusText(el, message, type) {
  el.textContent = message;
  el.className = type ? `form-status ${type}` : 'form-status';
}

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
  const countStatEl = document.getElementById('accountCountStat');
  const fromSel = document.getElementById('fromAccount');
  const toSel = document.getElementById('toAccount');

  try {
    const res = await fetch(`${API}/api/accounts`);
    const accounts = await res.json();
    if (!res.ok) throw new Error(accounts.error || 'failed to load accounts');

    countEl.textContent = `${accounts.length} account${accounts.length === 1 ? '' : 's'}`;
    countStatEl.textContent = String(accounts.length);

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

    renderBalanceChart(accounts);
    const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0);
    document.getElementById('totalBalanceStat').textContent = fmtMoney(totalBalance, 'USD');
    document.getElementById('activeAccountsStat').textContent = String(accounts.filter(a => a.status === 'ACTIVE').length);
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="empty">Couldn't load accounts — ${err.message}</td></tr>`;
  }
}

async function loadUsers() {
  const list = document.getElementById('customersList');
  const countEl = document.getElementById('customerCount');
  const verifiedEl = document.getElementById('verifiedCustomersStat');
  const searchInput = document.getElementById('customerSearch');
  const query = (searchInput ? searchInput.value : '').trim();

  try {
    const res = await fetch(`${API}/api/users${query ? `?search=${encodeURIComponent(query)}` : ''}`);
    const users = await res.json();
    if (!res.ok) throw new Error(users.error || 'failed to load customers');

    countEl.textContent = `${users.length} customer${users.length === 1 ? '' : 's'}`;
    verifiedEl.textContent = String(users.filter(u => u.kyc_status === 'VERIFIED').length);

    list.innerHTML = users.length
      ? users.map(user => `
        <li>
          <button type="button" class="customer-button" data-user-id="${user.user_id}">
            <div class="customer-top">
              <span class="customer-name">${user.full_name}</span>
              <span class="kyc-badge ${slugify(user.kyc_status)}">${user.kyc_status}</span>
            </div>
            <div class="customer-meta">${maskEmail(user.email)} · ${maskPhone(user.phone)}</div>
          </button>
        </li>
      `).join('')
      : '<li class="empty">No customers yet.</li>';

    renderCustomerStatusBreakdown(users);
    bindCustomerButtons();

    const selected = document.querySelector('.customer-button.active');
    if (!selected && users.length) {
      const first = list.querySelector('.customer-button');
      if (first) {
        first.classList.add('active');
        loadCustomerDetail(Number(first.dataset.userId));
      }
    }
  } catch (err) {
    list.innerHTML = `<li class="empty">Couldn't load customers — ${err.message}</li>`;
  }
}

function bindCustomerButtons() {
  document.querySelectorAll('.customer-button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.customer-button').forEach(el => el.classList.remove('active'));
      button.classList.add('active');
      loadCustomerDetail(Number(button.dataset.userId));
    });
  });
}

async function loadCustomerDetail(userId) {
  const container = document.getElementById('customerProfile');
  try {
    const res = await fetch(`${API}/api/users/${userId}`);
    const user = await res.json();
    if (!res.ok) throw new Error(user.error || 'failed to load customer profile');

    container.innerHTML = `
      <div class="profile-header">
        <div>
          <h3>${user.full_name}</h3>
          <div class="customer-meta">Customer ID: ${user.user_id}</div>
        </div>
        <span class="kyc-badge ${slugify(user.kyc_status)}">${user.kyc_status}</span>
      </div>
      <div class="profile-grid">
        <div class="profile-field">
          <label>Email</label>
          <strong>${maskEmail(user.email)}</strong>
        </div>
        <div class="profile-field">
          <label>Phone</label>
          <strong>${maskPhone(user.phone)}</strong>
        </div>
        <div class="profile-field">
          <label>National ID</label>
          <strong>${user.national_id || '—'}</strong>
        </div>
        <div class="profile-field">
          <label>Date of birth</label>
          <strong>${user.date_of_birth || '—'}</strong>
        </div>
        <div class="profile-field">
          <label>Address</label>
          <strong>${user.address || '—'}</strong>
        </div>
        <div class="profile-field">
          <label>Created</label>
          <strong>${fmtTime(user.created_at)}</strong>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty">Couldn't load secure profile — ${err.message}</div>`;
  }
}

function renderBalanceChart(accounts) {
  const chart = document.getElementById('balanceChart');
  if (!chart) return;

  const grouped = accounts.reduce((acc, account) => {
    const key = account.account_type || 'OTHER';
    acc[key] = (acc[key] || 0) + Number(account.balance || 0);
    return acc;
  }, {});

  const entries = Object.entries(grouped);
  const maxValue = Math.max(...entries.map(([, value]) => value), 1);

  chart.innerHTML = entries.length
    ? entries.map(([label, value]) => `
      <div class="balance-bar-wrap">
        <div class="balance-bar" style="height: ${(value / maxValue) * 120 + 20}px"></div>
        <div class="balance-bar-label">${label.slice(0, 3)}</div>
      </div>
    `).join('')
    : '<div class="empty">No balance data.</div>';
}

function renderCustomerStatusBreakdown(users = []) {
  const container = document.getElementById('customerStatusBreakdown');
  if (!container) return;

  const counts = { VERIFIED: 0, PENDING: 0, REJECTED: 0 };

  if (!users.length) {
    container.innerHTML = '<div class="empty">No customer status data.</div>';
    return;
  }

  users.forEach(user => {
    const status = user.kyc_status || 'PENDING';
    if (status in counts) counts[status] += 1;
  });

  const total = Math.max(Object.values(counts).reduce((sum, value) => sum + value, 0), 1);
  container.innerHTML = Object.entries(counts).map(([status, count]) => `
    <div class="status-row">
      <div class="status-row-top">
        <span>${status}</span>
        <span>${count}</span>
      </div>
      <div class="status-bar"><div class="status-fill ${slugify(status)}" style="width: ${(count / total) * 100}%"></div></div>
    </div>
  `).join('');
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
  await Promise.all([loadAccounts(), loadUsers(), loadAuditLog()]);
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
    setStatusText(statusEl, 'Source and destination accounts must be different.', 'error');
    return;
  }

  btn.disabled = true;
  setStatusText(statusEl, 'Sending…', '');

  try {
    const res = await fetch(`${API}/api/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (res.ok) {
      setStatusText(statusEl, data.result, 'success');
      document.getElementById('amount').value = '';
      document.getElementById('reference').value = '';
      await refreshAll();
    } else {
      setStatusText(statusEl, data.result || data.error || 'Transfer failed.', 'error');
    }
  } catch (err) {
    setStatusText(statusEl, `Network error — ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('customerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const statusEl = document.getElementById('customerStatus');
  const submitBtn = document.getElementById('customerSubmitBtn');

  const payload = {
    full_name: document.getElementById('customerName').value.trim(),
    date_of_birth: document.getElementById('customerDob').value,
    national_id: document.getElementById('customerNationalId').value.trim(),
    email: document.getElementById('customerEmail').value.trim(),
    phone: document.getElementById('customerPhone').value.trim(),
    address: document.getElementById('customerAddress').value.trim(),
  };

  submitBtn.disabled = true;
  setStatusText(statusEl, 'Creating customer…', '');

  try {
    const res = await fetch(`${API}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Customer creation failed');
    }

    setStatusText(statusEl, `Customer created successfully — ID ${data.user_id}`, 'success');
    form.reset();
    await refreshAll();
  } catch (err) {
    setStatusText(statusEl, err.message, 'error');
  } finally {
    submitBtn.disabled = false;
  }
});

checkHealth();
refreshAll();
const customerSearch = document.getElementById('customerSearch');
if (customerSearch) {
  customerSearch.addEventListener('input', () => loadUsers());
}
setInterval(refreshAll, 8000); // keep the ledger live without a manual refresh
