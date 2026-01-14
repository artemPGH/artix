// =======================
// ARTIX — app.js
// Основная логика интерфейса
// =======================

const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

// 1. Получаем элементы со страницы
const elements = {
  chat: document.getElementById("chat"),
  input: document.getElementById("input"),
  sendBtn: document.getElementById("sendBtn"),
  clearBtn: document.getElementById("clearBtn"),
  statusDot: document.getElementById("statusDot"),
  statusText: document.getElementById("statusText"),
  modeBadge: document.getElementById("modeBadge")
};

// Запуск при загрузке
init();

function init() {
  // Приветственное сообщение
  pushBot("ARTIX online ✅\nПиши вопрос — попробую ответить через веб-поиск или посчитать пример.");

  // Слушатели событий (клики, нажатия клавиш)
  elements.sendBtn.addEventListener("click", onSend);
  elements.clearBtn.addEventListener("click", () => (elements.chat.innerHTML = ""));
  
  // Отправка по Enter (но Shift+Enter делает перенос строки)
  elements.input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  });

  // Авто-растягивание поля ввода
  elements.input.addEventListener("input", () => {
    elements.input.style.height = "auto";
    elements.input.style.height = Math.min(elements.input.scrollHeight, 220) + "px";
  });
}

// === ЛОГИКА ОТПРАВКИ ===

async function onSend() {
  const query = (elements.input.value || "").trim();
  if (!query) return; // Если пусто, ничего не делаем

  // Очищаем поле ввода
  elements.input.value = "";
  elements.input.style.height = "auto";

  // 1. Показываем сообщение пользователя
  pushUser(query);

  // Меняем статус на "думаю..."
  setStatus("busy", "думаю...");

  // 2. Пытаемся ответить ЛОКАЛЬНО (калькулятор, время)
  const localAnswer = tryLocalAnswer(query);
  if (localAnswer) {
    setMode("local");
    pushBot(localAnswer.text);
    setStatus("ok", "готов");
    return;
  }

  // 3. Если локально не вышло, идем в ИНТЕРНЕТ (через твой Worker)
  const webResult = await webSearch(query);
  
  if (webResult.ok && webResult.items.length > 0) {
    setMode("web");
    pushBot(webResult.text, webResult.sources);
    setStatus("ok", "готов");
  } else {
    // 4. Если и в интернете ничего нет (Fallback)
    setMode("fallback");
    pushBot("Я не нашёл точных данных в Википедии или StackOverflow.\nПопробуй переформулировать запрос.");
    setStatus("ok", "готов");
  }
}

// === ЛОКАЛЬНЫЕ ФУНКЦИИ (КАЛЬКУЛЯТОР И ВРЕМЯ) ===

function tryLocalAnswer(q) {
  // Проверяем, не математика ли это (только цифры и знаки)
  // Удаляем пробелы для проверки
  const expr = q.replace(/\s+/g, "");
  
  // Регулярка: разрешаем цифры, скобки, +, -, *, /, точки, запятые
  const isMath = /^[0-9()+\-*/.,]+$/.test(expr) && /[+\-*/]/.test(expr);
  
  if (isMath) {
    try {
      // Заменяем запятую на точку для JS
      const safeExpr = expr.replace(/,/g, ".");
      // new Function безопаснее eval, но всё равно требует осторожности
      // Мы уже проверили регуляркой, что там нет букв, так что код выполнить нельзя
      const result = new Function(`return (${safeExpr})`)();
      
      if (!isFinite(result)) return null; // Защита от деления на ноль
      
      // Округляем до 10 знаков, если число дробное
      const formatted = Number.isInteger(result) ? result : result.toFixed(2);
      return { text: `Результат: ${formatted}` };
    } catch (e) {
      return null;
    }
  }

  // Проверка времени
  const lowerQ = q.toLowerCase();
  if (lowerQ.includes("время") || lowerQ.includes("который час")) {
    const time = new Date().toLocaleTimeString("ru-RU", {hour: '2-digit', minute:'2-digit'});
    return { text: `Сейчас: ${time}` };
  }
  
  return null;
}

// === ВЕБ ПОИСК (API) ===

async function webSearch(query) {
  // Тайм-аут 12 секунд, чтобы не висело вечно
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const url = `${SEARCH_API}?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { signal: controller.signal });
    
    clearTimeout(timeoutId);

    if (!response.ok) return { ok: false };

    const data = await response.json();
    const items = data.results || [];

    if (items.length === 0) return { ok: true, items: [] };

    // Формируем красивый ответ из первых 3 результатов
    const topItems = items.slice(0, 3);
    
    let answerText = `Вот что я нашел по запросу "${query}":\n\n`;
    topItems.forEach(item => {
      // Обрезаем слишком длинный текст
      const snippet = item.text.length > 200 ? item.text.slice(0, 200) + "..." : item.text;
      answerText += `🔹 **${item.title}**\n${snippet}\n\n`;
    });

    const sources = topItems.map((item, idx) => ({
      name: item.source || `#${idx + 1}`,
      url: item.url
    }));

    return { ok: true, items, text: answerText, sources };

  } catch (error) {
    return { ok: false };
  }
}

// === UI ФУНКЦИИ (Рисование сообщений) ===

function pushUser(text) {
  const div = document.createElement("div");
  div.className = "msg user";
  div.textContent = text;
  elements.chat.appendChild(div);
  scrollToBottom();
}

function pushBot(text, sources = []) {
  const div = document.createElement("div");
  div.className = "msg bot";

  // Обработка переносов строк и жирного шрифта (простой парсер)
  let formattedText = text
    .replace(/\n/g, "<br>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"); // Меняем **текст** на жирный

  const body = document.createElement("div");
  body.innerHTML = formattedText;
  div.appendChild(body);

  // Если есть источники, добавляем их внизу
  if (sources.length > 0) {
    const srcDiv = document.createElement("div");
    srcDiv.className = "sources";
    srcDiv.innerHTML = "Источники: ";
    
    sources.forEach((s, i) => {
      const a = document.createElement("a");
      a.href = s.url;
      a.target = "_blank";
      a.textContent = s.name;
      srcDiv.appendChild(a);
      if (i < sources.length - 1) srcDiv.appendChild(document.createTextNode(" · "));
    });
    
    div.appendChild(srcDiv);
  }

  elements.chat.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  elements.chat.scrollTop = elements.chat.scrollHeight;
}

function setStatus(kind, text) {
  elements.statusDot.className = `dot ${kind}`; // ok, busy, err
  elements.statusText.textContent = text;
}

function setMode(kind) {
  elements.modeBadge.className = "badge"; // Сброс
  elements.modeBadge.textContent = kind.toUpperCase();
}
