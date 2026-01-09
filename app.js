// =======================
// ARTIX — app.js (NO IMPORTS)
// Работает на GitHub Pages / любом статическом хостинге
// =======================

// Поменяй при желании на относительный путь, если проксируешь через свой домен:
const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

// UI
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const modeBadge = document.getElementById("modeBadge");

init();

function init() {
  // Самодиагностика: если это сообщение не появилось — app.js НЕ запустился
  pushBot("ARTIX online ✅\nПиши вопрос — попробую ответить через веб-поиск или локально.");

  sendBtn.addEventListener("click", onSend);
  clearBtn.addEventListener("click", () => (chatEl.innerHTML = ""));
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });

  autoGrow(inputEl);
  inputEl.addEventListener("input", () => autoGrow(inputEl));
}

function autoGrow(el) {
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 220) + "px";
}

function setStatus(kind, text) {
  statusDot.classList.remove("ok", "busy", "err");
  statusDot.classList.add(kind);
  statusText.textContent = text;
}

function setMode(kind) {
  // kind: "web" | "local" | "fallback"
  modeBadge.classList.remove("badge-web", "badge-local", "badge-fallback");
  if (kind === "web") {
    modeBadge.textContent = "web";
    modeBadge.classList.add("badge-web");
  } else if (kind === "local") {
    modeBadge.textContent = "local";
    modeBadge.classList.add("badge-local");
  } else {
    modeBadge.textContent = "fallback";
    modeBadge.classList.add("badge-fallback");
  }
}

function pushUser(text) {
  const el = document.createElement("div");
  el.className = "msg user";
  el.textContent = text;
  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function pushBot(text, sources = []) {
  const el = document.createElement("div");
  el.className = "msg bot";

  const body = document.createElement("div");
  body.textContent = text;
  el.appendChild(body);

  if (sources.length) {
    const src = document.createElement("div");
    src.className = "sources";
    src.textContent = "Источники: ";
    sources.forEach((s, idx) => {
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.textContent = s.name || `#${idx + 1}`;
      src.appendChild(a);
      if (idx !== sources.length - 1) src.appendChild(document.createTextNode(" · "));
    });
    el.appendChild(src);
  }

  chatEl.appendChild(el);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function onSend() {
  const q = (inputEl.value || "").trim();
  if (!q) return;

  inputEl.value = "";
  autoGrow(inputEl);

  pushUser(q);

  setStatus("busy", "думаю…");

  // 1) Локальные быстрые ответы (калькулятор/время/дата)
  const local = tryLocalAnswer(q);
  if (local) {
    setMode("local");
    setStatus("ok", "готов");
    pushBot(local.text, local.sources || []);
    return;
  }

  // 2) Веб-поиск через Cloudflare Worker
  const web = await webSearch(q);
  if (web.ok && web.items.length) {
    setMode("web");
    setStatus("ok", "готов");
    pushBot(web.text, web.sources);
    return;
  }

  // 3) Фоллбек (когда веб не дал результатов) — тут можно потом подключить другую ИИ
  setMode("fallback");
  setStatus("ok", "готов");
  pushBot(
    "Я не нашёл релевантных источников по этому запросу через веб-поиск.\n" +
    "Попробуй уточнить: добавь контекст, язык или конкретику (например: «что такое chatgpt простыми словами»)."
  );
}

function tryLocalAnswer(q) {
  // простая математика типа "12 + 421" / "4*5" / "53758+4"
  const expr = q.replace(/\s+/g, "");
  if (/^[0-9()+\-*/.,]+$/.test(expr) && /[+\-*/]/.test(expr)) {
    const val = safeCalc(expr);
    if (val !== null) return { text: `Ответ: ${val}` };
  }

  // время/дата
  const lq = q.toLowerCase();
  if (lq.includes("какое") && lq.includes("время")) {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return { text: `Сейчас: ${hh}:${mm}` };
  }

  if (lq.includes("какой") && (lq.includes("день") || lq.includes("дата"))) {
    const d = new Date();
    return { text: `Сегодня: ${d.toLocaleDateString("ru-RU", { weekday: "long", year:"numeric", month:"long", day:"numeric" })}` };
  }

  return null;
}

// Без eval. Разрешаем только цифры и операции, + скобки
function safeCalc(expr) {
  // заменим запятую на точку
  expr = expr.replace(/,/g, ".");
  // защита
  if (!/^[0-9()+\-*/.]+$/.test(expr)) return null;

  try {
    // Простейший парсер через Function, но с жёсткой фильтрацией (без букв и т.п.)
    // Если хочешь вообще без Function — скажи, сделаю полноценный shunting-yard.
    const fn = new Function(`"use strict"; return (${expr});`);
    const res = fn();
    if (typeof res !== "number" || !isFinite(res)) return null;
    // красивый вывод: целые без .0
    return Number.isInteger(res) ? String(res) : String(round(res, 10));
  } catch {
    return null;
  }
}

function round(n, digits) {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

async function webSearch(query) {
  const url = `${SEARCH_API}?q=${encodeURIComponent(query)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);

  try {
    const r = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Accept": "application/json"
      }
    });

    clearTimeout(t);

    if (!r.ok) {
      return { ok: false, items: [], text: "" };
    }

    const data = await r.json();

    const items = Array.isArray(data.results) ? data.results : [];
    if (!items.length) return { ok: true, items: [], text: "" };

    // Собираем краткий ответ из top результатов
    const top = items.slice(0, 3);

    const lines = [];
    lines.push(`Вот что удалось найти по запросу “${query}”:`);
    lines.push("");

    top.forEach((it) => {
      const title = (it.title || "Источник").trim();
      const snippet = cleanSnippet(it.text || "");
      lines.push(`• ${title}${snippet ? ` — ${snippet}` : ""}`);
    });

    const sources = top.map((it, idx) => ({
      name: guessSourceName(it.url) || `#${idx + 1}`,
      url: it.url
    }));

    return {
      ok: true,
      items,
      text: lines.join("\n"),
      sources
    };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, items: [], text: "" };
  }
}

function cleanSnippet(text) {
  // твоему воркеру иногда прилетает огромный кусок википедии.
  // Здесь режем до адекватного вида.
  const s = String(text)
    .replace(/\s+/g, " ")
    .trim();

  if (!s) return "";
  // лимит
  return s.length > 220 ? (s.slice(0, 220).trim() + "…") : s;
}

function guessSourceName(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host.includes("wikipedia")) return "Wikipedia";
    return host;
  } catch {
    return "";
  }
}
