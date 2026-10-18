'use strict';

const API_URL = '';

const STORAGE_KEY = 'sft:transactions';
const SETTINGS_KEY = 'sft:settings';
const CATEGORIES = ['Food', 'Books', 'Transport', 'Entertainment', 'Fees', 'Other'];
const DEFAULT_SETTINGS = { cap: 500, currency: 'USD', rateEur: 0.92, rateRwf: 1400 };
const CHART_HEIGHT = 120;

const $ = (id) => document.getElementById(id);

const el = {
  totalCount: $('total-count'),
  totalAmount: $('total-amount'),
  topCategory: $('top-category'),
  weekTotal: $('week-total'),
  capMessage: $('cap-message'),
  chart: $('chart'),
  search: $('search'),
  matchCase: $('case'),
  sort: $('sort'),
  searchError: $('search-error'),
  list: $('record-list'),
  empty: $('empty'),
  form: $('tx-form'),
  formTitle: $('form-title'),
  formStatus: $('form-status'),
  editId: $('edit-id'),
  description: $('description'),
  amount: $('amount'),
  category: $('category'),
  date: $('date'),
  saveButton: $('save-button'),
  cancelEdit: $('cancel-edit'),
  cap: $('cap'),
  currency: $('base-currency'),
  rateEur: $('rate-eur'),
  rateRwf: $('rate-rwf'),
  exportButton: $('export'),
  resetAll: $('reset-all'),
  importFile: $('import-file'),
  dataStatus: $('data-status'),
};

let transactions = [];
let settings = { ...DEFAULT_SETTINGS };

/* ---------- Storage: backend API or localStorage ---------- */

async function request(path, options = {}) {
  const response = await fetch(API_URL + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`Server responded with ${response.status}`);
  }
  return response.status === 204 ? null : response.json();
}

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

const remoteStore = {
  list: () => request('/transactions'),
  create: (tx) => request('/transactions', { method: 'POST', body: JSON.stringify(tx) }),
  update: (id, tx) =>
    request(`/transactions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(tx) }),
  remove: (id) => request(`/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  clear: () => request('/transactions', { method: 'DELETE' }),
  replaceAll: (list) => request('/transactions', { method: 'PUT', body: JSON.stringify(list) }),
  getSettings: () => request('/settings'),
  saveSettings: (value) => request('/settings', { method: 'PUT', body: JSON.stringify(value) }),
};

const localStore = {
  async list() {
    return readLocal(STORAGE_KEY, []);
  },
  async create(tx) {
    const all = readLocal(STORAGE_KEY, []);
    all.push(tx);
    writeLocal(STORAGE_KEY, all);
    return tx;
  },
  async update(id, tx) {
    const all = readLocal(STORAGE_KEY, []);
    const index = all.findIndex((item) => item.id === id);
    if (index === -1) throw new Error('Transaction not found');
    all[index] = { ...all[index], ...tx, id };
    writeLocal(STORAGE_KEY, all);
    return all[index];
  },
  async remove(id) {
    writeLocal(STORAGE_KEY, readLocal(STORAGE_KEY, []).filter((item) => item.id !== id));
    return null;
  },
  async clear() {
    writeLocal(STORAGE_KEY, []);
    return null;
  },
  async replaceAll(list) {
    writeLocal(STORAGE_KEY, list);
    return list;
  },
  async getSettings() {
    return readLocal(SETTINGS_KEY, DEFAULT_SETTINGS);
  },
  async saveSettings(value) {
    writeLocal(SETTINGS_KEY, value);
    return value;
  },
};

const store = API_URL ? remoteStore : localStore;

/* ---------- Helpers ---------- */

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function todayISO() {
  return toISODate(new Date());
}

function lastSevenDays() {
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const day = new Date();
    day.setDate(day.getDate() - offset);
    days.push(toISODate(day));
  }
  return days;
}

function isRealDate(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return !Number.isNaN(parsed.getTime()) && toISODate(parsed) === value;
}

function convert(usd) {
  if (settings.currency === 'EUR') return usd * settings.rateEur;
  if (settings.currency === 'RWF') return usd * settings.rateRwf;
  return usd;
}

function formatMoney(usd) {
  const currency = settings.currency;
  const digits = currency === 'RWF' ? 0 : 2;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(convert(usd));
}

function setStatus(node, message, isError = false) {
  node.textContent = message;
  node.style.color = isError ? 'var(--danger)' : '';
}

/* ---------- Validation ---------- */

const rules = {
  description: {
    pattern: /^\S(?:.*\S)?$/,
    message: 'Enter a description with no spaces at the start or end.',
  },
  amount: {
    pattern: /^(0|[1-9]\d*)(\.\d{1,2})?$/,
    message: 'Enter a number like 12 or 12.50.',
  },
  date: {
    pattern: /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
    message: 'Pick a valid date.',
  },
};

function showFieldError(field, message) {
  const input = el[field];
  const errorNode = $(`${field}-error`);
  errorNode.textContent = message;
  if (message) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
}

function validateForm() {
  const values = {
    description: el.description.value,
    amount: el.amount.value.trim(),
    category: el.category.value,
    date: el.date.value,
  };
  const errors = {};

  if (!rules.description.pattern.test(values.description)) {
    errors.description = rules.description.message;
  }
  if (!rules.amount.pattern.test(values.amount) || Number(values.amount) <= 0) {
    errors.amount = rules.amount.message;
  }
  if (!CATEGORIES.includes(values.category)) {
    errors.category = 'Choose a category.';
  }
  if (!rules.date.pattern.test(values.date) || !isRealDate(values.date)) {
    errors.date = rules.date.message;
  }

  ['description', 'amount', 'category', 'date'].forEach((field) => {
    showFieldError(field, errors[field] || '');
  });

  const firstInvalid = ['description', 'amount', 'category', 'date'].find((f) => errors[f]);
  if (firstInvalid) el[firstInvalid].focus();

  return {
    valid: !firstInvalid,
    values: {
      description: values.description,
      amount: Math.round(Number(values.amount) * 100) / 100,
      category: values.category,
      date: values.date,
    },
  };
}

/* ---------- Search and sort ---------- */

function searchText(tx) {
  return [tx.description, tx.category, tx.amount.toFixed(2), tx.date].join(' | ');
}

function buildMatcher() {
  const raw = el.search.value.trim();
  const flags = el.matchCase.checked ? '' : 'i';
  el.searchError.textContent = '';

  if (!raw) {
    return { test: () => true, highlight: null };
  }

  const categoryMatch = raw.match(/^@category:(.+)$/i);
  if (categoryMatch) {
    const wanted = categoryMatch[1].trim().toLowerCase();
    return { test: (tx) => tx.category.toLowerCase() === wanted, highlight: null };
  }

  try {
    const regex = new RegExp(raw, flags);
    return {
      test: (tx) => regex.test(searchText(tx)),
      highlight: new RegExp(raw, `${flags}g`),
    };
  } catch (error) {
    el.searchError.textContent = `Invalid pattern: ${error.message}`;
    return { test: () => true, highlight: null };
  }
}

const sorters = {
  'date-desc': (a, b) => b.date.localeCompare(a.date),
  'date-asc': (a, b) => a.date.localeCompare(b.date),
  'desc-asc': (a, b) => a.description.localeCompare(b.description, undefined, { sensitivity: 'base' }),
  'desc-desc': (a, b) => b.description.localeCompare(a.description, undefined, { sensitivity: 'base' }),
  'amount-asc': (a, b) => a.amount - b.amount,
  'amount-desc': (a, b) => b.amount - a.amount,
};

function highlight(text, regex) {
  const fragment = document.createDocumentFragment();
  if (!regex) {
    fragment.append(text);
    return fragment;
  }
  let last = 0;
  for (const match of text.matchAll(regex)) {
    if (match[0] === '') continue;
    fragment.append(text.slice(last, match.index));
    const mark = document.createElement('mark');
    mark.textContent = match[0];
    fragment.append(mark);
    last = match.index + match[0].length;
  }
  fragment.append(text.slice(last));
  return fragment;
}

/* ---------- Rendering ---------- */

function textCell(text, regex) {
  const td = document.createElement('td');
  td.append(highlight(text, regex));
  return td;
}

function actionButton(label, action, description) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.action = action;
  button.setAttribute('aria-label', `${label} ${description}`);
  return button;
}

function renderRows(list, regex) {
  el.list.replaceChildren();
  for (const tx of list) {
    const row = document.createElement('tr');
    row.dataset.id = tx.id;

    const amountCell = document.createElement('td');
    amountCell.textContent = formatMoney(tx.amount);

    const actions = document.createElement('td');
    actions.append(
      actionButton('Edit', 'edit', tx.description),
      ' ',
      actionButton('Delete', 'delete', tx.description)
    );

    row.append(
      textCell(tx.date, regex),
      textCell(tx.description, regex),
      textCell(tx.category, regex),
      amountCell,
      actions
    );
    el.list.append(row);
  }
}

function renderDashboard() {
  const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  const byCategory = new Map();
  for (const tx of transactions) {
    byCategory.set(tx.category, (byCategory.get(tx.category) || 0) + tx.amount);
  }
  let topCategory = '—';
  let topValue = 0;
  for (const [name, value] of byCategory) {
    if (value > topValue) {
      topCategory = name;
      topValue = value;
    }
  }

  const days = lastSevenDays();
  const perDay = days.map((day) => ({
    date: day,
    total: transactions.filter((tx) => tx.date === day).reduce((sum, tx) => sum + tx.amount, 0),
  }));
  const weekTotal = perDay.reduce((sum, day) => sum + day.total, 0);

  el.totalCount.textContent = String(transactions.length);
  el.totalAmount.textContent = formatMoney(total);
  el.topCategory.textContent = topCategory;
  el.weekTotal.textContent = formatMoney(weekTotal);

  renderCapMessage(total);
  renderChart(perDay);
}

function renderCapMessage(total) {
  const cap = settings.cap;
  el.capMessage.classList.remove('ok');
  if (!(cap > 0)) {
    el.capMessage.textContent = '';
    return;
  }
  if (total > cap) {
    el.capMessage.textContent = `You are ${formatMoney(total - cap)} over your spending cap.`;
  } else {
    el.capMessage.classList.add('ok');
    el.capMessage.textContent = `${formatMoney(cap - total)} left before you reach your spending cap.`;
  }
}

function renderChart(perDay) {
  const max = Math.max(...perDay.map((day) => day.total), 0);
  el.chart.replaceChildren();

  const summary = [];
  for (const day of perDay) {
    const name = new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' });

    const column = document.createElement('div');
    const value = document.createElement('span');
    value.textContent = day.total > 0 ? formatMoney(day.total) : '';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${max > 0 ? Math.round((day.total / max) * CHART_HEIGHT) : 0}px`;
    bar.title = `${day.date}: ${formatMoney(day.total)}`;
    const label = document.createElement('span');
    label.textContent = name;

    column.append(value, bar, label);
    el.chart.append(column);
    summary.push(`${name} ${formatMoney(day.total)}`);
  }
  el.chart.setAttribute('aria-label', `Spending over the last 7 days: ${summary.join(', ')}`);
}

function render() {
  const matcher = buildMatcher();
  const visible = transactions.filter(matcher.test).sort(sorters[el.sort.value]);
  renderRows(visible, matcher.highlight);

  el.empty.hidden = visible.length > 0;
  el.empty.textContent = transactions.length
    ? 'No transactions match your search.'
    : 'No transactions found. Add one below.';

  renderDashboard();
}

async function refresh() {
  transactions = await store.list();
  render();
}

/* ---------- Form: add and edit ---------- */

function resetForm() {
  el.form.reset();
  el.editId.value = '';
  el.date.value = todayISO();
  el.formTitle.textContent = 'Add a transaction';
  el.saveButton.textContent = 'Save transaction';
  el.cancelEdit.hidden = true;
  ['description', 'amount', 'category', 'date'].forEach((field) => showFieldError(field, ''));
}

function startEdit(tx) {
  el.editId.value = tx.id;
  el.description.value = tx.description;
  el.amount.value = tx.amount.toFixed(2);
  el.category.value = tx.category;
  el.date.value = tx.date;
  el.formTitle.textContent = 'Edit transaction';
  el.saveButton.textContent = 'Update transaction';
  el.cancelEdit.hidden = false;
  setStatus(el.formStatus, '');
  el.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.description.focus();
}

el.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const { valid, values } = validateForm();
  if (!valid) {
    setStatus(el.formStatus, 'Fix the highlighted fields and try again.', true);
    return;
  }

  const editing = el.editId.value;
  const now = new Date().toISOString();

  try {
    if (editing) {
      await store.update(editing, { ...values, updatedAt: now });
    } else {
      await store.create({ id: uid(), ...values, createdAt: now, updatedAt: now });
    }
    resetForm();
    await refresh();
    setStatus(el.formStatus, editing ? 'Transaction updated.' : 'Transaction saved.');
  } catch (error) {
    setStatus(el.formStatus, `Could not save: ${error.message}`, true);
  }
});

el.cancelEdit.addEventListener('click', () => {
  resetForm();
  setStatus(el.formStatus, 'Edit cancelled.');
});

el.list.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const id = button.closest('tr').dataset.id;
  const tx = transactions.find((item) => item.id === id);
  if (!tx) return;

  if (button.dataset.action === 'edit') {
    startEdit(tx);
    return;
  }

  if (!window.confirm(`Delete "${tx.description}"?`)) return;
  try {
    await store.remove(id);
    if (el.editId.value === id) resetForm();
    await refresh();
    setStatus(el.formStatus, 'Transaction deleted.');
  } catch (error) {
    setStatus(el.formStatus, `Could not delete: ${error.message}`, true);
  }
});

/* ---------- Search controls ---------- */

el.search.addEventListener('input', render);
el.matchCase.addEventListener('change', render);
el.sort.addEventListener('change', render);

document.querySelector('.presets').addEventListener('click', (event) => {
  const button = event.target.closest('button[data-pattern]');
  if (!button) return;
  el.search.value = button.dataset.pattern;
  render();
  el.search.focus();
});

/* ---------- Settings ---------- */

function applySettingsToInputs() {
  el.cap.value = settings.cap;
  el.currency.value = settings.currency;
  el.rateEur.value = settings.rateEur;
  el.rateRwf.value = settings.rateRwf;
}

function sanitizeSettings(raw) {
  const merged = { ...DEFAULT_SETTINGS, ...(raw || {}) };
  const cap = Number(merged.cap);
  const rateEur = Number(merged.rateEur);
  const rateRwf = Number(merged.rateRwf);
  return {
    cap: Number.isFinite(cap) && cap >= 0 ? cap : DEFAULT_SETTINGS.cap,
    currency: ['USD', 'EUR', 'RWF'].includes(merged.currency) ? merged.currency : 'USD',
    rateEur: Number.isFinite(rateEur) && rateEur > 0 ? rateEur : DEFAULT_SETTINGS.rateEur,
    rateRwf: Number.isFinite(rateRwf) && rateRwf > 0 ? rateRwf : DEFAULT_SETTINGS.rateRwf,
  };
}

async function onSettingsChange() {
  settings = sanitizeSettings({
    cap: el.cap.value,
    currency: el.currency.value,
    rateEur: el.rateEur.value,
    rateRwf: el.rateRwf.value,
  });
  render();
  try {
    await store.saveSettings(settings);
    setStatus(el.dataStatus, 'Settings saved.');
  } catch (error) {
    setStatus(el.dataStatus, `Could not save settings: ${error.message}`, true);
  }
}

[el.cap, el.currency, el.rateEur, el.rateRwf].forEach((input) => {
  input.addEventListener('change', onSettingsChange);
});

/* ---------- Backup: export, import, reset ---------- */

function normalizeRecord(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  const amount = Math.round(Number(raw.amount) * 100) / 100;
  const date = typeof raw.date === 'string' ? raw.date : '';
  if (!description || !Number.isFinite(amount) || amount <= 0 || !isRealDate(date)) return null;
  const now = new Date().toISOString();
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : uid(),
    description,
    amount,
    category: CATEGORIES.includes(raw.category) ? raw.category : 'Other',
    date,
    createdAt: raw.createdAt || now,
    updatedAt: raw.updatedAt || now,
  };
}

el.exportButton.addEventListener('click', () => {
  const payload = JSON.stringify({ transactions, settings }, null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `finance-tracker-${todayISO()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  setStatus(el.dataStatus, `Exported ${transactions.length} transactions.`);
});

el.importFile.addEventListener('change', async () => {
  const file = el.importFile.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const rawList = Array.isArray(data) ? data : data.transactions;
    if (!Array.isArray(rawList)) throw new Error('No transactions found in this file.');

    const records = rawList.map(normalizeRecord).filter(Boolean);
    const skipped = rawList.length - records.length;

    if (!window.confirm(`Replace your current data with ${records.length} imported transactions?`)) {
      return;
    }

    await store.replaceAll(records);
    if (!Array.isArray(data) && data.settings) {
      settings = sanitizeSettings(data.settings);
      await store.saveSettings(settings);
      applySettingsToInputs();
    }
    resetForm();
    await refresh();
    setStatus(
      el.dataStatus,
      skipped
        ? `Imported ${records.length} transactions. Skipped ${skipped} invalid records.`
        : `Imported ${records.length} transactions.`
    );
  } catch (error) {
    setStatus(el.dataStatus, `Import failed: ${error.message}`, true);
  } finally {
    el.importFile.value = '';
  }
});

const importLabel = document.querySelector('label[for="import-file"]');
importLabel.tabIndex = 0;
importLabel.setAttribute('role', 'button');
importLabel.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    el.importFile.click();
  }
});

el.resetAll.addEventListener('click', async () => {
  if (!window.confirm('Delete all transactions and reset the dashboard to zero?')) return;
  try {
    await store.clear();
    resetForm();
    await refresh();
    setStatus(el.dataStatus, 'All transactions deleted.');
  } catch (error) {
    setStatus(el.dataStatus, `Could not reset: ${error.message}`, true);
  }
});

/* ---------- Start ---------- */

async function init() {
  resetForm();
  try {
    settings = sanitizeSettings(await store.getSettings());
  } catch {
    settings = { ...DEFAULT_SETTINGS };
  }
  applySettingsToInputs();

  try {
    await refresh();
  } catch (error) {
    render();
    setStatus(el.dataStatus, `Could not load data: ${error.message}`, true);
  }
}

init();