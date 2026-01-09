/**
 * ARTIX minimal client
 * - Web search via Cloudflare Worker:
 *   https://artix-search.facts-com99.workers.dev/api/search?q=...
 * - Local model stub (runLocalModel) — заменишь на свой OrtRun
 *
 * IMPORTANT:
 * - никакого "fallback" в UI
 * - статус:
 *   ok    => локальная модель ответила
 *   web   => локальная модель упала, но web дал результаты
 *   err   => всё упало / результатов нет
 */

const WORKER_BASE = "https://artix-search.facts-com99.workers.dev";

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

function setStatus(kind, text) {
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusText");
  if (!dot || !label) return;

  dot.classList.remove("busy", "err", "web", "ok");

  if (kind === "busy") dot.classList.add("busy");
  else if (kind === "err") dot.classList.add("err");
  else if (kind === "web") dot.classList.add("web");
  else dot.classList.add("ok");

  label.textContent = text || "";
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function addMessage(role, text, sources = []) {
  const wrap = document.createElement("div");
  wrap.className = `msg ${role}`;
  wrap.innerHTML = escapeHtml(text || "");

  if (sources && sources.length) {
    const src = document.createElement("div");
    src.className = "sources";
    const links = sources.slice(0, 6).map((r, idx) => {
      const title = r.source || r.title || `Источник ${idx + 1}`;
      const url = r.url || "";
      if (!url) return escapeHtml(title);
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(title)}</a>`;
    });
    src.innerHTML = `Источники: ${links.join(" · ")}`;
    wrap.appendChild(src);
  }

  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function fetchWebSearch(query) {
  const url = `${WORKER_BASE}/api/search?q=${encodeURIComponent(query)}`;
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) throw new Error(`search http ${resp.status}`);
  const data = await resp.json();

  const results = Array.isArray(data.results) ? data.results : [];
  return results;
}

function buildWebAnswer(query, results) {
  if (!results || results.length === 0) {
    return `Не нашёл нормальные источники по запросу "${query}". Попробуй уточнить (добавь слово/контекст).`;
  }

  const top = results.slice(0, 3);
  let out = `Вот что удалось найти по запросу "${query}":\n\n`;

  for (const r of top) {
    const title = r.title || "Без названия";
    const text = (r.text || "").trim();

    out += `• ${title}\n`;
    if (text) out += `${text}\n`;
    out += `\n`;
  }

  return out.trim();
}

/**
 * ЗАГЛУШКА локальной модели.
 * Заменишь на свой реальный код (OrtRun / onnxruntime-web).
 *
 * Договор:
 * - должна вернуть строку-ответ
 * - либо бросить ошибку (throw), если модель не смогла
 */
async function runLocalModel(query, webResults) {
  // === ВАЖНО ===
  // Сейчас заглушка специально "падает" для демонстрации web-режима.
  // Когда подключишь OrtRun — убери throw и верни настоящий ответ.
  throw new Error("Local model not connected (OrtRun)");
}

/**
 * Основная логика ответа:
 * 1) пытаемся web-search (чтобы всегда был план Б)
 * 2) пытаемся локальную модель
 * 3) если локальная упала — отвечаем web
 *    и ставим статус web/err
 */
async function answerUser(query) {
  setStatus("busy", "думаю…");

  // 1) web search — мягко (если упал, не убиваем всё)
  let webResults = [];
  try {
    webResults = await fetchWebSearch(query);
  } catch (e) {
    webResults = [];
  }

  // 2) локальная модель
  try {
    const modelAnswer = await runLocalModel(query, webResults);
    addMessage("bot", modelAnswer || "…", webResults);
    setStatus("ok", "готово");
    return;
  } catch (e) {
    // 3) fallback в web (но НЕ пишем "fallback")
    const webAnswer = buildWebAnswer(query, webResults);
    addMessage("bot", webAnswer, webResults);

    if (webResults.length > 0) setStatus("web", "поиск");
    else setStatus("err", "ошибка");
  }
}

function normalizeQuery(s) {
  return String(s || "").trim();
}

function autosizeTextarea(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 180) + "px";
}

async function onSend() {
  const q = normalizeQuery(inputEl.value);
  if (!q) return;

  addMessage("user", q);
  inputEl.value = "";
  autosizeTextarea(inputEl);

  await answerUser(q);
}

sendBtn.addEventListener("click", onSend);

inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    onSend();
  }
});

inputEl.addEventListener("input", () => autosizeTextarea(inputEl));

clearBtn.addEventListener("click", () => {
  chatEl.innerHTML = "";
  setStatus("ok", "готов");
});

setStatus("ok", "готов");
autosizeTextarea(inputEl);
