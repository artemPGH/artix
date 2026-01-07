// ====== CONFIG ======
const WORKER_BASE = "https://artix-search.facts-com99.workers.dev";
const SEARCH_ENDPOINT = `${WORKER_BASE}/api/search`;

// Локальная модель через transformers.js (если уже подключал раньше)
// Если у тебя сейчас из-за неё падает OrtRun — мы не ломаем чат: будет fallback.
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2";

env.allowLocalModels = false;
env.useBrowserCache = true;

// Важно: без crossOriginIsolated нет SharedArrayBuffer -> ставим 1 поток
env.backends.onnx.wasm.numThreads = (globalThis.crossOriginIsolated ? 2 : 1);

let generatorPromise = null;

function setStatus(kind, text) {
  const dot = document.getElementById("statusDot");
  const label = document.getElementById("statusText");
  dot.classList.remove("busy", "err");
  if (kind === "busy") dot.classList.add("busy");
  if (kind === "err") dot.classList.add("err");
  label.textContent = text;
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

// очень простая разметка: если есть ``` то делаем code block
function renderBotText(text) {
  const s = String(text || "").trim();
  if (!s) return `<div>Я не смог сформировать ответ.</div>`;

  // code fence
  const parts = s.split("```");
  if (parts.length === 1) return `<div>${escapeHtml(s)}</div>`;

  let html = "";
  for (let i = 0; i < parts.length; i++) {
    const chunk = parts[i];
    if (i % 2 === 0) {
      if (chunk.trim()) html += `<div>${escapeHtml(chunk.trim())}</div>`;
    } else {
      // inside fence: optional first line = lang
      const lines = chunk.split("\n");
      let code = chunk;
      if (lines.length > 1 && lines[0].length <= 20) {
        code = lines.slice(1).join("\n");
      }
      html += `<pre class="code"><code>${escapeHtml(code.trim())}</code></pre>`;
    }
  }
  return html;
}

function addMessage(role, html, sources = []) {
  const chat = document.getElementById("chat");
  const el = document.createElement("div");
  el.className = `msg ${role === "user" ? "user" : "bot"}`;

  if (role === "user") {
    el.textContent = html;
  } else {
    el.innerHTML = html;

    if (sources && sources.length) {
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.innerHTML =
        `<span>Источники:</span>` +
        sources
          .slice(0, 4)
          .map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">${escapeHtml(s.source)}</a>`)
          .join("");
      el.appendChild(meta);
    }
  }

  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
}

function clearChat() {
  const chat = document.getElementById("chat");
  chat.innerHTML = "";
  addMessage("bot", renderBotText("Привет! Я ARTIX. Пиши вопрос или вставляй код — помогу и/или найду информацию."));
}

function autoGrow(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 220) + "px";
}

// ====== Heuristics ======

function isMathQuery(q) {
  // очень простая проверка арифметики
  return /^[\d\s()+\-*/.^]+$/.test(q.trim());
}

function safeEvalMath(q) {
  // Безопасный мини-калькулятор: только цифры/операторы/скобки
  // (не идеал, но лучше чем eval на всё подряд)
  const expr = q.trim();
  if (!isMathQuery(expr)) return null;
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(`"use strict"; return (${expr});`);
    const v = fn();
    if (typeof v === "number" && Number.isFinite(v)) return v;
    return null;
  } catch {
    return null;
  }
}

function buildFallbackAnswer(q, results) {
  if (!results.length) {
    return `Я ничего не нашёл по запросу: "${q}". Попробуй уточнить (добавь контекст/ключевые слова).`;
  }

  // Берём первые 2–3 сниппета и склеиваем
  const top = results.slice(0, 3);
  let text = `Вот что удалось найти по запросу "${q}":\n\n`;
  for (const r of top) {
    text += `• ${r.title}: ${r.text}\n\n`;
  }
  text += `Если хочешь — вставь код/ошибку целиком, я разберу пошагово.`;
  return text.trim();
}

// ====== Model loader (optional) ======

async function getGenerator() {
  if (!generatorPromise) {
    setStatus("busy", "загружаю модель…");
    generatorPromise = pipeline("text-generation", "Xenova/Qwen1.5-0.5B-Chat");
  }
  return generatorPromise;
}

function buildPrompt(q, results) {
  const context = results
    .slice(0, 4)
    .map((r, i) => `Источник ${i + 1}: ${r.source}\nЗаголовок: ${r.title}\nТекст: ${r.text}\nURL: ${r.url}`)
    .join("\n\n");

  return [
    "Ты — ассистент по программированию и фактам. Отвечай по-русски.",
    "Если вопрос про код — давай рабочий пример и короткое объяснение.",
    "Если используешь источники — опирайся ТОЛЬКО на контекст ниже.",
    "Если контекста мало — скажи, что именно уточнить.",
    "",
    "КОНТЕКСТ:",
    context || "(контекста нет)",
    "",
    `ВОПРОС: ${q}`,
    "",
    "ОТВЕТ:",
  ].join("\n");
}

// ====== Main send ======

async function send() {
  const input = document.getElementById("input");
  const q = input.value.trim();
  if (!q) return;

  input.value = "";
  autoGrow(input);

  addMessage("user", q);

  // 1) математика моментально
  const math = safeEvalMath(q);
  if (math !== null) {
    addMessage("bot", renderBotText(`Ответ: ${math}`));
    return;
  }

  setStatus("busy", "ищу…");

  // 2) web search
  let results = [];
  try {
    const r = await fetch(`${SEARCH_ENDPOINT}?q=${encodeURIComponent(q)}&limit=6`, { method: "GET" });
    const data = await r.json();
    results = Array.isArray(data?.results) ? data.results : [];
  } catch (_) {
    results = [];
  }

  // 3) пробуем локальную модель, но не ломаемся если она падает
  try {
    const gen = await getGenerator();
    setStatus("busy", "думаю…");

    const prompt = buildPrompt(q, results);
    const out = await gen(prompt, {
      max_new_tokens: 220,
      temperature: 0.4,
      top_p: 0.9,
      repetition_penalty: 1.05,
    });

    const text = out?.[0]?.generated_text || "";
    // generated_text содержит prompt + ответ — берём всё после "ОТВЕТ:"
    const idx = text.lastIndexOf("ОТВЕТ:");
    const answer = idx >= 0 ? text.slice(idx + "ОТВЕТ:".length).trim() : text.trim();

    if (!answer) throw new Error("empty answer");

    addMessage("bot", renderBotText(answer), results);
    setStatus("ok", "готов");
  } catch (e) {
    // Это твой OrtRun error code 6 — здесь будет fallback
    const fb = buildFallbackAnswer(q, results);
    addMessage("bot", renderBotText(fb), results);
    setStatus("err", "fallback");
  }
}

function init() {
  const input = document.getElementById("input");
  const btnSend = document.getElementById("btnSend");
  const btnClear = document.getElementById("btnClear");

  btnSend.addEventListener("click", send);
  btnClear.addEventListener("click", clearChat);

  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  clearChat();
  setStatus("ok", "готов");
}

init();
