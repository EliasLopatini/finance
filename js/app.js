(() => {
  'use strict';

  const STORAGE_KEY = 'financas_transactions_v1';
  const HIDE_KEY = 'financas_hide_balance_v1';

  const CATEGORIES = [
    'Alimentação', 'Mercado', 'Transporte', 'Saúde', 'Lazer',
    'Casa', 'Educação', 'Assinaturas', 'Transferência', 'Salário/Receita', 'Outros'
  ];

  const CATEGORY_ICONS = {
    'Alimentação': '🍔', 'Mercado': '🛒', 'Transporte': '🚗', 'Saúde': '💊',
    'Lazer': '🎬', 'Casa': '🏠', 'Educação': '📚', 'Assinaturas': '🔁',
    'Transferência': '↔️', 'Salário/Receita': '💰', 'Outros': '📌'
  };

  const KEYWORD_RULES = [
    [/ifood|restaurante|lanchonete|padaria|pizzaria|burguer|acai/i, 'Alimentação'],
    [/mercado|supermercado|atacad|hortifruti|sacolao/i, 'Mercado'],
    [/uber|99app|posto|combustivel|estacionamento|pedagio|ipva/i, 'Transporte'],
    [/farmacia|drogaria|hospital|clinica|laboratorio|plano de saude/i, 'Saúde'],
    [/cinema|ingresso|show|teatro|parque/i, 'Lazer'],
    [/aluguel|condominio|energia|copel|cemig|enel|sabesp|luz|agua|internet|vivo|claro|tim |oi /i, 'Casa'],
    [/escola|faculdade|curso|udemy|colegio|mensalidade/i, 'Educação'],
    [/netflix|spotify|amazon prime|disney|hbo|youtube premium/i, 'Assinaturas'],
    [/pix |ted |doc |transferencia/i, 'Transferência'],
    [/salario|pagamento sal|deposito|proventos|pro-labore/i, 'Salário/Receita'],
  ];

  function autoCategorize(description) {
    const desc = description.toLowerCase();
    for (const [regex, cat] of KEYWORD_RULES) {
      if (regex.test(desc)) return cat;
    }
    return 'Outros';
  }

  // ===== STATE =====
  let transactions = loadTransactions();
  let currentView = 'inicio';
  let pendingImport = [];
  let sheetTargetId = null;

  function loadTransactions() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('Erro ao carregar dados salvos', e);
      return [];
    }
  }

  function saveTransactions() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }

  function formatBRL(value) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const date = new Date(+y, +m - 1, +d);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    if (sameDay(date, today)) return 'Hoje';
    if (sameDay(date, yesterday)) return 'Ontem';
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  // ===== NAVIGATION =====
  function navigate(viewName) {
    currentView = viewName;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById('view-' + viewName).classList.add('active');
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.nav === viewName));
    if (viewName === 'extrato') renderExtrato();
    if (viewName === 'investimentos') initInvestimentos();
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.nav));
  });

  // ===== RENDER: DASHBOARD =====
  function computeStats() {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let income = 0, expense = 0, balance = 0;
    transactions.forEach(t => {
      balance += t.amount;
      if (t.date.startsWith(monthKey)) {
        if (t.amount >= 0) income += t.amount; else expense += Math.abs(t.amount);
      }
    });
    return { balance, income, expense };
  }

  function renderTxItem(t) {
    const isPos = t.amount >= 0;
    return `
      <div class="tx-item" data-id="${t.id}">
        <div class="tx-icon">${CATEGORY_ICONS[t.category] || '📌'}</div>
        <div class="tx-mid">
          <div class="tx-desc">${escapeHtml(t.description)}</div>
          <div class="tx-cat">${t.category}</div>
        </div>
        <div class="tx-amount ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : '-'} ${formatBRL(Math.abs(t.amount))}</div>
      </div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderDashboard() {
    const { balance, income, expense } = computeStats();
    const hidden = localStorage.getItem(HIDE_KEY) === '1';

    document.getElementById('balance-value').textContent = hidden ? '••••••' : formatBRL(balance);
    document.getElementById('stat-income').textContent = hidden ? '••••' : formatBRL(income);
    document.getElementById('stat-expense').textContent = hidden ? '••••' : formatBRL(expense);
    document.getElementById('eye-open').style.display = hidden ? 'none' : 'block';
    document.getElementById('eye-closed').style.display = hidden ? 'block' : 'none';

    const recent = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
    const list = document.getElementById('recent-list');
    list.innerHTML = recent.length
      ? recent.map(renderTxItem).join('')
      : '<p class="empty-hint">Nenhum lançamento ainda. Importe seu extrato do Sicredi na aba Importar.</p>';

    const today = new Date();
    document.getElementById('today-date').textContent = today.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    attachTxClickHandlers(list);
  }

  document.getElementById('btn-toggle-balance').addEventListener('click', () => {
    const hidden = localStorage.getItem(HIDE_KEY) === '1';
    localStorage.setItem(HIDE_KEY, hidden ? '0' : '1');
    renderDashboard();
  });

  // ===== RENDER: EXTRATO =====
  function populateCategoryFilter() {
    const select = document.getElementById('filter-category');
    if (select.options.length > 1) return;
    CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  function renderExtrato() {
    populateCategoryFilter();
    const search = document.getElementById('search-tx').value.toLowerCase();
    const filterCat = document.getElementById('filter-category').value;

    let list = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (search) list = list.filter(t => t.description.toLowerCase().includes(search));
    if (filterCat) list = list.filter(t => t.category === filterCat);

    const container = document.getElementById('full-list');
    document.getElementById('extrato-empty').hidden = transactions.length > 0;

    if (!list.length) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    let lastGroup = null;
    list.forEach(t => {
      const label = formatDateLabel(t.date);
      if (label !== lastGroup) {
        html += `<div class="tx-group-label">${label}</div>`;
        lastGroup = label;
      }
      html += renderTxItem(t);
    });
    container.innerHTML = html;
    attachTxClickHandlers(container);
  }

  document.getElementById('search-tx').addEventListener('input', renderExtrato);
  document.getElementById('filter-category').addEventListener('change', renderExtrato);

  // ===== CATEGORY EDIT SHEET =====
  function attachTxClickHandlers(container) {
    container.querySelectorAll('.tx-item').forEach(el => {
      el.addEventListener('click', () => openCategorySheet(el.dataset.id));
    });
  }

  function openCategorySheet(id) {
    sheetTargetId = id;
    const isSaved = transactions.some(t => t.id === id);
    const tx = transactions.find(t => t.id === id) || pendingImport.find(t => t.id === id);
    const grid = document.getElementById('sheet-category-list');
    grid.innerHTML = CATEGORIES.map(cat => `
      <button class="category-chip ${tx && tx.category === cat ? 'selected' : ''}" data-cat="${cat}">
        ${CATEGORY_ICONS[cat]} ${cat}
      </button>`).join('');
    grid.querySelectorAll('.category-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.cat;
        const target = transactions.find(t => t.id === sheetTargetId);
        if (target) { target.category = cat; saveTransactions(); }
        const targetPending = pendingImport.find(t => t.id === sheetTargetId);
        if (targetPending) { targetPending.category = cat; renderImportPreview(); }
        closeSheet();
        renderDashboard();
        if (currentView === 'extrato') renderExtrato();
      });
    });

    const deleteBtn = document.getElementById('sheet-delete');
    if (isSaved) {
      deleteBtn.hidden = false;
      deleteBtn.textContent = 'Excluir lançamento';
    } else {
      deleteBtn.hidden = false;
      deleteBtn.textContent = 'Remover da importação';
    }
    document.getElementById('sheet-overlay').classList.add('show');
  }

  document.getElementById('sheet-delete').addEventListener('click', () => {
    const isSaved = transactions.some(t => t.id === sheetTargetId);
    if (isSaved) {
      const tx = transactions.find(t => t.id === sheetTargetId);
      const label = tx ? `"${tx.description}" (${formatBRL(Math.abs(tx.amount))})` : 'este lançamento';
      if (!confirm(`Excluir ${label}? Essa ação não pode ser desfeita.`)) return;
      transactions = transactions.filter(t => t.id !== sheetTargetId);
      saveTransactions();
      renderDashboard();
      if (currentView === 'extrato') renderExtrato();
    } else {
      pendingImport = pendingImport.filter(t => t.id !== sheetTargetId);
      renderImportPreview();
    }
    closeSheet();
  });

  function closeSheet() {
    document.getElementById('sheet-overlay').classList.remove('show');
  }
  document.getElementById('sheet-close').addEventListener('click', closeSheet);
  document.getElementById('sheet-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-overlay') closeSheet();
  });

  // ===== IMPORT OFX =====
  const fileInput = document.getElementById('file-input');
  document.getElementById('upload-box').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = OfxParser.parse(ev.target.result);
        const existingIds = new Set(transactions.map(t => t.id));
        pendingImport = parsed.map(t => ({
          ...t,
          category: autoCategorize(t.description),
          isDuplicate: existingIds.has(t.id)
        }));
        renderImportPreview();
      } catch (err) {
        alert(err.message || 'Não consegui ler este arquivo. Confirme se é um OFX válido do Sicredi.');
      }
    };
    reader.onerror = () => alert('Erro ao ler o arquivo.');
    reader.readAsText(file, 'ISO-8859-1');
    fileInput.value = '';
  });

  function renderImportPreview() {
    const preview = document.getElementById('import-preview');
    if (!pendingImport.length) { preview.hidden = true; return; }
    preview.hidden = false;

    const newCount = pendingImport.filter(t => !t.isDuplicate).length;
    const dupCount = pendingImport.length - newCount;
    document.getElementById('import-summary').textContent =
      `${newCount} novo(s)${dupCount ? `, ${dupCount} já importado(s)` : ''}`;

    const list = document.getElementById('preview-list');
    let html = '';
    let lastGroup = null;
    pendingImport.forEach(t => {
      const label = formatDateLabel(t.date);
      if (label !== lastGroup) { html += `<div class="tx-group-label">${label}</div>`; lastGroup = label; }
      const dupBadge = t.isDuplicate ? ' <span class="muted">(duplicado)</span>' : '';
      html += `<div class="tx-item" data-id="${t.id}" style="opacity:${t.isDuplicate ? 0.45 : 1}">
        <div class="tx-icon">${CATEGORY_ICONS[t.category]}</div>
        <div class="tx-mid">
          <div class="tx-desc">${escapeHtml(t.description)}${dupBadge}</div>
          <div class="tx-cat">${t.category}</div>
        </div>
        <div class="tx-amount ${t.amount >= 0 ? 'pos' : 'neg'}">${t.amount >= 0 ? '+' : '-'} ${formatBRL(Math.abs(t.amount))}</div>
      </div>`;
    });
    list.innerHTML = html;
    list.querySelectorAll('.tx-item').forEach(el => {
      el.addEventListener('click', () => openCategorySheet(el.dataset.id));
    });
  }

  document.getElementById('btn-cancel-import').addEventListener('click', () => {
    pendingImport = [];
    document.getElementById('import-preview').hidden = true;
  });

  document.getElementById('btn-confirm-import').addEventListener('click', () => {
    const newOnes = pendingImport.filter(t => !t.isDuplicate);
    transactions = transactions.concat(newOnes.map(({ isDuplicate, ...rest }) => rest));
    saveTransactions();
    pendingImport = [];
    document.getElementById('import-preview').hidden = true;
    renderDashboard();
    navigate('inicio');
  });

  // ===== INVESTIMENTOS =====
  let ratesCache = null;
  async function initInvestimentos() {
    if (ratesCache) return;
    try {
      ratesCache = await Investments.loadRates();
      document.getElementById('rate-selic').textContent = ratesCache.selic != null ? ratesCache.selic.toFixed(2) + '%' : '—';
      document.getElementById('rate-cdi').textContent = ratesCache.cdi != null ? ratesCache.cdi.toFixed(2) + '%' : '—';
      document.getElementById('rate-ipca').textContent = ratesCache.ipca != null ? ratesCache.ipca.toFixed(2) + '%' : '—';
      document.getElementById('rates-updated').textContent = ratesCache.updatedAt
        ? `Atualizado em ${ratesCache.updatedAt} · fonte: Banco Central (SGS)`
        : 'Não foi possível atualizar agora — verifique sua conexão.';
    } catch (e) {
      document.getElementById('rates-updated').textContent = 'Não foi possível buscar as taxas agora.';
    }
  }

  document.getElementById('btn-calcular').addEventListener('click', () => {
    const valor = parseFloat(document.getElementById('calc-valor').value);
    const meses = parseInt(document.getElementById('calc-meses').value, 10);
    if (!valor || !meses || valor <= 0 || meses <= 0) {
      alert('Preencha um valor e um período válidos.');
      return;
    }
    const rates = ratesCache || { selic: null, cdi: null };
    const results = Investments.simulate(valor, meses, rates);
    const box = document.getElementById('calc-results');
    box.hidden = false;
    box.innerHTML = results.map(r => `
      <div class="calc-result-row">
        <span class="name">${r.name} <span class="muted">(${r.rateAA.toFixed(2)}% a.a.)</span></span>
        <span class="val">${formatBRL(r.result)}</span>
      </div>`).join('');
  });

  // ===== ADICIONAR LANÇAMENTO MANUAL =====
  let addTipo = 'saida';

  function populateAddCategorySelect() {
    const select = document.getElementById('add-categoria');
    if (select.options.length) return;
    CATEGORIES.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat; opt.textContent = `${CATEGORY_ICONS[cat]} ${cat}`;
      select.appendChild(opt);
    });
  }

  function openAddSheet() {
    populateAddCategorySelect();
    document.getElementById('add-desc').value = '';
    document.getElementById('add-valor').value = '';
    document.getElementById('add-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('add-categoria').value = 'Outros';
    document.getElementById('add-error').hidden = true;
    addTipo = 'saida';
    document.querySelectorAll('#tipo-segmented .segment').forEach(s => s.classList.toggle('active', s.dataset.tipo === 'saida'));
    document.getElementById('sheet-add-overlay').classList.add('show');
  }

  function closeAddSheet() {
    document.getElementById('sheet-add-overlay').classList.remove('show');
  }

  document.getElementById('btn-add-tx').addEventListener('click', openAddSheet);
  document.getElementById('btn-add-cancel').addEventListener('click', closeAddSheet);
  document.getElementById('sheet-add-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'sheet-add-overlay') closeAddSheet();
  });

  document.querySelectorAll('#tipo-segmented .segment').forEach(btn => {
    btn.addEventListener('click', () => {
      addTipo = btn.dataset.tipo;
      document.querySelectorAll('#tipo-segmented .segment').forEach(s => s.classList.toggle('active', s === btn));
    });
  });

  document.getElementById('btn-add-confirm').addEventListener('click', () => {
    const desc = document.getElementById('add-desc').value.trim();
    const valorRaw = document.getElementById('add-valor').value.replace(',', '.');
    const valor = parseFloat(valorRaw);
    const data = document.getElementById('add-data').value;
    const categoria = document.getElementById('add-categoria').value;
    const errorBox = document.getElementById('add-error');

    if (!desc) { errorBox.textContent = 'Digite uma descrição.'; errorBox.hidden = false; return; }
    if (!valor || valor <= 0) { errorBox.textContent = 'Digite um valor maior que zero.'; errorBox.hidden = false; return; }
    if (!data) { errorBox.textContent = 'Escolha uma data.'; errorBox.hidden = false; return; }

    const amount = addTipo === 'entrada' ? Math.abs(valor) : -Math.abs(valor);
    const id = 'manual_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

    transactions.push({ id, date: data, description: desc, amount, category: categoria });
    saveTransactions();
    closeAddSheet();
    renderDashboard();
    if (currentView === 'extrato') renderExtrato();
  });

  // ===== INIT =====
  renderDashboard();

  // registra service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
