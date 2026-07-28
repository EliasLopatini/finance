/* ---------------- Storage ---------------- */
const STORAGE_KEY = "caderneta_transacoes_v1";

function loadTx() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Erro ao ler dados salvos:", e);
    return [];
  }
}

function saveTx(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

let transactions = loadTx();
let currentMonth = new Date();
currentMonth.setDate(1);

/* ---------------- Helpers ---------------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function toCents(v) {
  return Math.round(v * 100);
}

function formatBRL(cents) {
  const v = cents / 100;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function parseDateInput(str) {
  // expects yyyy-mm-dd from <input type=date>
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function monthLabel(d) {
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove("show"), 2200);
}

/* ---------------- Tabs ---------------- */
const tabs = document.querySelectorAll(".tabs button");
tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
    document.getElementById("view-" + btn.dataset.view).classList.add("active");
    if (btn.dataset.view === "extrato") renderLedger();
  });
});

/* ---------------- Dashboard / Ledger render ---------------- */
function txInMonth(d) {
  return transactions.filter((t) => {
    const dt = new Date(t.date);
    return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
  });
}

function renderDashboard() {
  const all = transactions;
  const balanceCents = all.reduce((s, t) => s + (t.type === "in" ? t.amount : -t.amount), 0);
  const monthTx = txInMonth(currentMonth);
  const inCents = monthTx.filter((t) => t.type === "in").reduce((s, t) => s + t.amount, 0);
  const outCents = monthTx.filter((t) => t.type === "out").reduce((s, t) => s + t.amount, 0);

  const balEl = document.getElementById("balance-value");
  balEl.textContent = formatBRL(balanceCents);
  balEl.classList.toggle("negative", balanceCents < 0);

  document.getElementById("in-value").textContent = formatBRL(inCents);
  document.getElementById("out-value").textContent = formatBRL(outCents);
}

function renderLedger() {
  document.getElementById("month-label").textContent = monthLabel(currentMonth);
  const monthTx = txInMonth(currentMonth).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  const container = document.getElementById("ledger-list");
  container.innerHTML = "";

  if (monthTx.length === 0) {
    container.innerHTML = `<div class="empty-state"><span class="big">Nada por aqui</span>Adicione um lançamento ou importe um extrato em PDF.</div>`;
    return;
  }

  let lastDay = null;
  monthTx.forEach((t) => {
    const dt = new Date(t.date);
    const dayKey = dt.getDate();
    if (dayKey !== lastDay) {
      const label = document.createElement("div");
      label.className = "ledger-group-label";
      label.textContent = dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
      container.appendChild(label);
      lastDay = dayKey;
    }
    const row = document.createElement("div");
    row.className = "ledger-row";
    row.innerHTML = `
      <div class="day">${String(dt.getDate()).padStart(2, "0")}</div>
      <div class="desc">${escapeHtml(t.desc)}${t.category ? `<span class="cat">${escapeHtml(t.category)}</span>` : ""}</div>
      <div class="amount ${t.type}">${t.type === "in" ? "+" : "−"} ${formatBRL(t.amount)}</div>
      <button class="del" aria-label="Excluir lançamento" data-id="${t.id}">✕</button>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll(".del").forEach((btn) => {
    btn.addEventListener("click", () => {
      transactions = transactions.filter((t) => t.id !== btn.dataset.id);
      saveTx(transactions);
      renderLedger();
      renderDashboard();
      showToast("Lançamento excluído");
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById("month-prev").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() - 1);
  renderLedger();
});
document.getElementById("month-next").addEventListener("click", () => {
  currentMonth.setMonth(currentMonth.getMonth() + 1);
  renderLedger();
});

/* ---------------- Manual add form ---------------- */
let addType = "out";
document.getElementById("add-type-in").addEventListener("click", () => setAddType("in"));
document.getElementById("add-type-out").addEventListener("click", () => setAddType("out"));

function setAddType(type) {
  addType = type;
  document.getElementById("add-type-in").classList.toggle("active", type === "in");
  document.getElementById("add-type-out").classList.toggle("active", type === "out");
}
setAddType("out");

document.getElementById("form-add").addEventListener("submit", (e) => {
  e.preventDefault();
  const date = document.getElementById("add-date").value;
  const desc = document.getElementById("add-desc").value.trim();
  const category = document.getElementById("add-category").value.trim();
  const amount = parseFloat(document.getElementById("add-amount").value.replace(",", "."));

  if (!date || !desc || isNaN(amount) || amount <= 0) {
    showToast("Preencha data, descrição e valor válidos");
    return;
  }

  transactions.push({
    id: uid(),
    date,
    desc,
    category,
    amount: toCents(amount),
    type: addType,
    source: "manual",
  });
  saveTx(transactions);
  renderDashboard();
  showToast("Lançamento adicionado");
  e.target.reset();
  document.getElementById("add-date").value = isoDate(new Date());
});

document.getElementById("add-date").value = isoDate(new Date());

/* ---------------- PDF Import ---------------- */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("pdf-input");

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => {
  if (e.target.files.length) handlePdf(e.target.files[0]);
});

async function handlePdf(file) {
  showToast("Lendo PDF…");
  try {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const lines = groupByLine(content.items);
      fullText += lines.join("\n") + "\n";
    }
    const parsed = parseStatementText(fullText);
    if (parsed.length === 0) {
      showToast("Não encontrei lançamentos automaticamente. Adicione manualmente.");
      return;
    }
    renderReview(parsed);
  } catch (err) {
    console.error(err);
    showToast("Não consegui ler esse PDF.");
  }
}

// Group PDF.js text items into visual lines using their y-position
function groupByLine(items) {
  const rows = {};
  items.forEach((it) => {
    const y = Math.round(it.transform[5]);
    if (!rows[y]) rows[y] = [];
    rows[y].push(it);
  });
  const ys = Object.keys(rows).map(Number).sort((a, b) => b - a);
  return ys.map((y) =>
    rows[y]
      .sort((a, b) => a.transform[4] - b.transform[4])
      .map((it) => it.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  ).filter(Boolean);
}

// Generic heuristic parser for Brazilian bank statement text
function parseStatementText(text) {
  const lines = text.split("\n");
  const dateRe = /\b(\d{2}\/\d{2}\/\d{4}|\d{2}\/\d{2})\b/;
  const valueRe = /(-?\s?R?\$?\s?-?\d{1,3}(?:\.\d{3})*,\d{2})\s*(D|C)?\s*$/i;
  const results = [];
  const currentYear = new Date().getFullYear();

  lines.forEach((line) => {
    const dm = line.match(dateRe);
    const vm = line.match(valueRe);
    if (!dm || !vm) return;

    let [d, m, y] = dm[1].split("/");
    if (!y) y = String(currentYear);
    if (y.length === 2) y = "20" + y;

    let valStr = vm[1].replace(/R\$|\s/g, "");
    const isNegativeSign = valStr.trim().startsWith("-");
    valStr = valStr.replace(/-/g, "");
    valStr = valStr.replace(/\./g, "").replace(",", ".");
    let amount = parseFloat(valStr);
    if (isNaN(amount) || amount === 0) return;

    const marker = (vm[2] || "").toUpperCase();
    let type = "out";
    if (marker === "C") type = "in";
    else if (marker === "D") type = "out";
    else if (isNegativeSign) type = "out";
    else type = "in"; // no marker, positive number in statement -> assume credit; user reviews anyway

    // description = line minus date and value tokens
    let desc = line.replace(dm[0], "").replace(vm[0], "").trim();
    desc = desc.replace(/\s{2,}/g, " ");
    if (!desc) desc = "Lançamento importado";

    const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
    if (isNaN(dateObj.getTime())) return;

    results.push({
      id: uid(),
      date: isoDate(dateObj),
      desc: desc.slice(0, 80),
      category: "",
      amount: toCents(amount),
      type,
      source: "pdf",
    });
  });

  return results;
}

/* ---------------- Import review screen ---------------- */
function renderReview(parsed) {
  document.getElementById("dropzone-wrap").style.display = "none";
  const reviewWrap = document.getElementById("review-wrap");
  reviewWrap.style.display = "block";
  document.getElementById("import-summary").textContent =
    `${parsed.length} lançamento(s) encontrado(s). Revise antes de confirmar — remova ou ajuste o que precisar.`;

  const list = document.getElementById("review-list");
  list.innerHTML = "";

  parsed.forEach((t, idx) => {
    const row = document.createElement("div");
    row.className = "review-row";
    row.dataset.idx = idx;
    row.innerHTML = `
      <input type="checkbox" checked class="rv-include">
      <div class="fields">
        <input type="date" class="rv-date" value="${t.date}">
        <select class="rv-type">
          <option value="out" ${t.type === "out" ? "selected" : ""}>Saída</option>
          <option value="in" ${t.type === "in" ? "selected" : ""}>Entrada</option>
        </select>
        <input type="text" class="rv-desc full" value="${escapeAttr(t.desc)}">
        <input type="number" step="0.01" class="rv-amount full" value="${(t.amount / 100).toFixed(2)}">
      </div>
    `;
    list.appendChild(row);
  });

  reviewWrap._parsed = parsed;

  document.getElementById("btn-confirm-import").onclick = () => confirmImport();
  document.getElementById("btn-cancel-import").onclick = () => resetImportView();
}

function escapeAttr(str) {
  return str.replace(/"/g, "&quot;");
}

function confirmImport() {
  const rows = document.querySelectorAll("#review-list .review-row");
  let count = 0;
  rows.forEach((row) => {
    if (!row.querySelector(".rv-include").checked) return;
    const date = row.querySelector(".rv-date").value;
    const type = row.querySelector(".rv-type").value;
    const desc = row.querySelector(".rv-desc").value.trim() || "Lançamento importado";
    const amount = parseFloat(row.querySelector(".rv-amount").value);
    if (!date || isNaN(amount) || amount <= 0) return;
    transactions.push({
      id: uid(),
      date,
      desc,
      category: "",
      amount: toCents(amount),
      type,
      source: "pdf",
    });
    count++;
  });
  saveTx(transactions);
  renderDashboard();
  showToast(`${count} lançamento(s) importado(s)`);
  resetImportView();
}

function resetImportView() {
  document.getElementById("review-wrap").style.display = "none";
  document.getElementById("dropzone-wrap").style.display = "block";
  fileInput.value = "";
}

/* ---------------- Backup / restore ---------------- */
document.getElementById("btn-export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(transactions, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `caderneta-backup-${isoDate(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import-backup-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!Array.isArray(data)) throw new Error("formato inválido");
      transactions = data;
      saveTx(transactions);
      renderDashboard();
      renderLedger();
      showToast("Backup restaurado");
    } catch (err) {
      showToast("Arquivo de backup inválido");
    }
  };
  reader.readAsText(file);
  e.target.value = "";
});

/* ---------------- Service worker ---------------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

/* ---------------- Init ---------------- */
renderDashboard();
renderLedger();
