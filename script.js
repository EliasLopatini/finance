/* ==================== Livro-Caixa — script principal ==================== */

const STORAGE_KEY = 'livrocaixa_v1';

const els = {
  dropZone: document.getElementById('dropZone'),
  fileInput: document.getElementById('fileInput'),
  mappingPanel: document.getElementById('mappingPanel'),
  mappingGrid: document.getElementById('mappingGrid'),
  previewTable: document.getElementById('previewTable'),
  confirmMapping: document.getElementById('confirmMapping'),
  summarySection: document.getElementById('summarySection'),
  stamp: document.getElementById('stamp'),
  stampText: document.getElementById('stampText'),
  totalIn: document.getElementById('totalIn'),
  totalOut: document.getElementById('totalOut'),
  totalNet: document.getElementById('totalNet'),
  categoriesPanel: document.getElementById('categoriesPanel'),
  categoryBars: document.getElementById('categoryBars'),
  transactionsPanel: document.getElementById('transactionsPanel'),
  txBody: document.getElementById('txBody'),
  searchInput: document.getElementById('searchInput'),
  filterType: document.getElementById('filterType'),
  resetBtn: document.getElementById('resetBtn'),
  refreshInvest: document.getElementById('refreshInvest'),
  investGrid: document.getElementById('investGrid'),
  investNote: document.getElementById('investNote'),
};

let state = {
  headers: [],
  rows: [],
  mapping: null,   // { date, desc, value, credit, debit }
  transactions: [],
  sort: { key: 'date', dir: 1 },
};

/* ---------------- CSV parsing ---------------- */

function splitCSVLine(line, delimiter) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === delimiter && !inQuotes) {
      out.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function detectDelimiter(lines) {
  const candidates = [';', ',', '\t'];
  let best = { delim: ';', score: -1 };
  for (const d of candidates) {
    const counts = lines.slice(0, 6).map(l => splitCSVLine(l, d).length);
    const mode = counts.sort((a,b) =>
      counts.filter(v=>v===a).length - counts.filter(v=>v===b).length
    ).pop();
    const consistency = counts.filter(c => c === mode).length;
    const score = mode > 1 ? mode * consistency : 0;
    if (score > best.score) best = { delim: d, score };
  }
  return best.delim;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (!lines.length) return { headers: [], rows: [] };
  const delimiter = detectDelimiter(lines);
  const headers = splitCSVLine(lines[0], delimiter);
  const rows = lines.slice(1).map(l => splitCSVLine(l, delimiter));
  // keep only rows that roughly match header length
  const filtered = rows.filter(r => r.length >= headers.length - 1);
  return { headers, rows: filtered };
}

/* ---------------- Column auto-detection ---------------- */

const ALIASES = {
  date: ['data', 'dt', 'data lancamento', 'data lançamento', 'data mov', 'data movimento'],
  desc: ['historico', 'histórico', 'descricao', 'descrição', 'lancamento', 'lançamento',
         'detalhes', 'operacao', 'operação', 'historico da operacao', 'complemento'],
  value: ['valor', 'valor (r$)', 'valor r$', 'valor(r$)', 'montante'],
  credit: ['entrada', 'credito', 'crédito', 'valor credito', 'valor crédito'],
  debit: ['saida', 'saída', 'debito', 'débito', 'valor debito', 'valor débito'],
  balance: ['saldo', 'saldo (r$)', 'saldo atual'],
};

function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function autoDetectMapping(headers) {
  const map = {};
  const normed = headers.map(norm);
  for (const field of Object.keys(ALIASES)) {
    const idx = normed.findIndex(h => ALIASES[field].some(a => norm(a) === h));
    if (idx !== -1) map[field] = idx;
  }
  return map;
}

/* ---------------- Value / date parsing ---------------- */

function parseValor(raw) {
  if (raw == null) return NaN;
  let s = String(raw).trim();
  let forcedSign = null;

  const cd = s.match(/\s?([CD])$/i);
  if (cd) { forcedSign = cd[1].toUpperCase(); s = s.slice(0, cd.index); }

  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/R\$/gi, '').trim();
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (s.startsWith('+')) { s = s.slice(1); }

  if (s.includes(',') && s.includes('.')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  let n = parseFloat(s);
  if (isNaN(n)) return NaN;
  if (neg) n = -Math.abs(n);
  if (forcedSign === 'D') n = -Math.abs(n);
  if (forcedSign === 'C') n = Math.abs(n);
  return n;
}

function parseData(raw) {
  const s = String(raw).trim();
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return new Date(+y, +mo - 1, +d);
  }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const [, y, mo, d] = m;
    return new Date(+y, +mo - 1, +d);
  }
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function fmtBRL(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtDate(d) {
  return d.toLocaleDateString('pt-BR');
}

/* ---------------- Categorization ---------------- */

const CATEGORY_RULES = [
  [/pix/i, 'Pix'],
  [/\bted\b|\bdoc\b|transfer/i, 'Transferência'],
  [/boleto/i, 'Boletos'],
  [/cart[aã]o|compra/i, 'Cartão / compras'],
  [/sal[aá]rio|proventos/i, 'Salário'],
  [/tarifa|manuten[cç][aã]o|anuidade/i, 'Tarifas'],
  [/aplica[cç][aã]o|resgate|investim/i, 'Investimentos'],
  [/energia|agua|água|internet|telefone|luz\b/i, 'Contas de consumo'],
];

function categorize(desc) {
  for (const [rx, name] of CATEGORY_RULES) {
    if (rx.test(desc)) return name;
  }
  return 'Outros';
}

/* ---------------- Build transactions from mapping ---------------- */

function buildTransactions() {
  const m = state.mapping;
  const tx = [];
  for (const row of state.rows) {
    const desc = (m.desc != null ? row[m.desc] : '') || '(sem descrição)';
    const dateRaw = m.date != null ? row[m.date] : null;
    const date = dateRaw ? parseData(dateRaw) : null;
    let value;
    if (m.value != null) {
      value = parseValor(row[m.value]);
    } else if (m.credit != null || m.debit != null) {
      const c = m.credit != null ? parseValor(row[m.credit]) : NaN;
      const d = m.debit != null ? parseValor(row[m.debit]) : NaN;
      if (!isNaN(c) && c !== 0) value = Math.abs(c);
      else if (!isNaN(d) && d !== 0) value = -Math.abs(d);
      else value = NaN;
    }
    if (isNaN(value) || !date) continue;
    tx.push({ date, desc, value, type: value >= 0 ? 'in' : 'out', category: categorize(desc) });
  }
  tx.sort((a, b) => a.date - b.date);
  return tx;
}

/* ---------------- Rendering ---------------- */

function renderAll() {
  const tx = state.transactions;
  const totalIn = tx.filter(t => t.type === 'in').reduce((s, t) => s + t.value, 0);
  const totalOut = tx.filter(t => t.type === 'out').reduce((s, t) => s + t.value, 0);
  const net = totalIn + totalOut;

  els.totalIn.textContent = fmtBRL(totalIn);
  els.totalOut.textContent = fmtBRL(Math.abs(totalOut));
  els.totalNet.textContent = fmtBRL(net);
  els.stampText.textContent = net >= 0 ? 'SALDO POSITIVO' : 'SALDO NEGATIVO';
  els.stamp.classList.toggle('negative', net < 0);
  els.summarySection.hidden = false;

  renderCategories(tx);
  renderTable();
  els.categoriesPanel.hidden = false;
  els.transactionsPanel.hidden = false;
}

function renderCategories(tx) {
  const byCat = {};
  tx.filter(t => t.type === 'out').forEach(t => {
    byCat[t.category] = (byCat[t.category] || 0) + Math.abs(t.value);
  });
  const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const max = entries.length ? entries[0][1] : 1;
  els.categoryBars.innerHTML = entries.map(([name, val]) => `
    <div class="cat-row">
      <span class="cat-name">${name}</span>
      <div class="cat-track"><div class="cat-fill" style="width:${(val / max * 100).toFixed(1)}%"></div></div>
      <span class="cat-value">${fmtBRL(val)}</span>
    </div>
  `).join('') || '<p class="muted">Nenhuma saída encontrada no período.</p>';
}

function renderTable() {
  const q = norm(els.searchInput.value || '');
  const filterType = els.filterType.value;
  let rows = state.transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (q && !norm(t.desc).includes(q)) return false;
    return true;
  });
  const { key, dir } = state.sort;
  rows = rows.slice().sort((a, b) => {
    if (key === 'date') return (a.date - b.date) * dir;
    if (key === 'value') return (a.value - b.value) * dir;
    return a.desc.localeCompare(b.desc) * dir;
  });
  els.txBody.innerHTML = rows.map(t => `
    <tr class="${t.type}">
      <td>${fmtDate(t.date)}</td>
      <td>${t.desc}</td>
      <td class="num">${fmtBRL(t.value)}</td>
    </tr>
  `).join('') || '<tr><td colspan="3" class="muted">Nenhum lançamento encontrado.</td></tr>';
}

document.querySelectorAll('#txTable th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (state.sort.key === key) state.sort.dir *= -1;
    else state.sort = { key, dir: 1 };
    renderTable();
  });
});
els.searchInput.addEventListener('input', renderTable);
els.filterType.addEventListener('change', renderTable);

/* ---------------- Manual mapping UI ---------------- */

const FIELD_LABELS = {
  date: 'Data', desc: 'Descrição', value: 'Valor (única coluna)',
  credit: 'Entrada / crédito (se houver coluna separada)',
  debit: 'Saída / débito (se houver coluna separada)',
};

function needsManualMapping(map) {
  const hasDate = map.date != null;
  const hasDesc = map.desc != null;
  const hasValue = map.value != null || (map.credit != null || map.debit != null);
  return !(hasDate && hasDesc && hasValue);
}

function showMappingUI() {
  els.mappingGrid.innerHTML = Object.keys(FIELD_LABELS).map(field => `
    <div class="mapping-field">
      <label>${FIELD_LABELS[field]}</label>
      <select data-field="${field}">
        <option value="">— não usar —</option>
        ${state.headers.map((h, i) => `<option value="${i}" ${state.mapping[field] === i ? 'selected' : ''}>${h}</option>`).join('')}
      </select>
    </div>
  `).join('');

  const previewRows = state.rows.slice(0, 5);
  els.previewTable.innerHTML = `
    <thead><tr>${state.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${previewRows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  `;
  els.mappingPanel.hidden = false;
}

els.confirmMapping.addEventListener('click', () => {
  const newMap = {};
  els.mappingGrid.querySelectorAll('select').forEach(sel => {
    if (sel.value !== '') newMap[sel.dataset.field] = parseInt(sel.value, 10);
  });
  state.mapping = newMap;
  finishImport();
});

/* ---------------- Import flow ---------------- */

function handleCSVText(text) {
  const { headers, rows } = parseCSV(text);
  state.headers = headers;
  state.rows = rows;
  const auto = autoDetectMapping(headers);
  state.mapping = auto;
  if (needsManualMapping(auto)) {
    showMappingUI();
  } else {
    els.mappingPanel.hidden = true;
    finishImport();
  }
}

function finishImport() {
  state.transactions = buildTransactions();
  renderAll();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    headers: state.headers, rows: state.rows, mapping: state.mapping,
  }));
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    state.headers = data.headers;
    state.rows = data.rows;
    state.mapping = data.mapping;
    finishImport();
  } catch (e) { /* ignore corrupted storage */ }
}

els.resetBtn.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
});

/* ---------------- File input / drag & drop ---------------- */

els.dropZone.addEventListener('click', () => els.fileInput.click());
els.fileInput.addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) readFile(f);
});
['dragover', 'dragleave', 'drop'].forEach(evt => {
  els.dropZone.addEventListener(evt, e => {
    e.preventDefault();
    els.dropZone.classList.toggle('dragover', evt === 'dragover');
  });
});
els.dropZone.addEventListener('drop', e => {
  const f = e.dataTransfer.files[0];
  if (f) readFile(f);
});

function readFile(file) {
  const reader = new FileReader();
  reader.onload = ev => handleCSVText(ev.target.result);
  reader.onerror = () => alert('Não consegui ler o arquivo. Tente exportar o extrato novamente.');
  reader.readAsText(file, 'utf-8');
}

/* ==================== Indicadores de mercado ==================== */

async function loadInvestments() {
  els.investNote.textContent = 'Atualizando…';
  const cards = {
    selic: { label: 'Selic (ano)' },
    cdi: { label: 'CDI (ano)' },
    ipca: { label: 'IPCA 12m' },
    usd: { label: 'Dólar (USD/BRL)' },
    btc: { label: 'Bitcoin (BRL)' },
  };

  const results = await Promise.allSettled([
    fetchBcbLatest(432),                         // Meta Selic anualizada
    fetchBcbLatest(4391),                        // CDI anualizado
    fetchIpca12m(),
    fetchAwesomeApi('USD-BRL'),
    fetchAwesomeApi('BTC-BRL'),
  ]);

  const [selic, cdi, ipca, usd, btc] = results;

  setInvestCard('selic', selic.status === 'fulfilled' ? `${selic.value}% a.a.` : 'indisponível');
  setInvestCard('cdi', cdi.status === 'fulfilled' ? `${cdi.value}% a.a.` : 'indisponível');
  setInvestCard('ipca', ipca.status === 'fulfilled' ? `${ipca.value}%` : 'indisponível');
  setInvestCard('usd', usd.status === 'fulfilled' ? `R$ ${usd.value}` : 'indisponível');
  setInvestCard('btc', btc.status === 'fulfilled' ? `R$ ${btc.value}` : 'indisponível');

  els.investNote.textContent =
    'Fontes: Banco Central do Brasil (SGS) e AwesomeAPI. Atualizado agora.';
}

function setInvestCard(key, text) {
  const labels = { selic: 'Selic (ano)', cdi: 'CDI (ano)', ipca: 'IPCA 12m', usd: 'Dólar', btc: 'Bitcoin' };
  const cardsInOrder = ['selic', 'cdi', 'ipca', 'usd', 'btc'];
  const idx = cardsInOrder.indexOf(key);
  const card = els.investGrid.children[idx];
  card.classList.remove('skeleton');
  card.querySelector('.invest-label').textContent = labels[key];
  card.querySelector('.invest-value').textContent = text;
}

async function fetchBcbLatest(seriesCode) {
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados/ultimos/1?formato=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('bcb fail');
  const data = await res.json();
  const val = parseFloat(data[0].valor.replace(',', '.'));
  return val.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

async function fetchIpca12m() {
  // série 433 = IPCA variação mensal; soma os últimos 12 meses (acumulado aproximado)
  const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados/ultimos/12?formato=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('bcb fail');
  const data = await res.json();
  let acc = 1;
  data.forEach(d => {
    const v = parseFloat(d.valor.replace(',', '.')) / 100;
    acc *= (1 + v);
  });
  const pct = (acc - 1) * 100;
  return pct.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

async function fetchAwesomeApi(pair) {
  const url = `https://economia.awesomeapi.com.br/last/${pair}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('awesomeapi fail');
  const data = await res.json();
  const key = pair.replace('-', '');
  const bid = parseFloat(data[key].bid);
  return bid.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

els.refreshInvest.addEventListener('click', loadInvestments);

/* ---------------- Init ---------------- */

loadFromStorage();
loadInvestments();
