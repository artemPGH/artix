// Настройка API твоего Cloudflare Worker
const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

// Элементы интерфейса
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const modelSelect = document.getElementById("modelSelect");
const modeBadge = document.getElementById("modeBadge");

// Запуск при загрузке страницы
init();

function init() {
    pushBot("ARTIX online ✅. Модель **ARTIX 1** готова к работе.");

    // Обработка кнопки отправить
    sendBtn.addEventListener("click", onSend);

    // Очистка чата
    clearBtn.addEventListener("click", () => {
        chatEl.innerHTML = "";
        pushBot("Чат очищен.");
    });

    // Отправка по Enter
    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    });

    // Автоматический размер текстового поля
    inputEl.addEventListener("input", () => {
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + "px";
    });
}

async function onSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    // Сбрасываем ввод
    inputEl.value = "";
    inputEl.style.height = "auto";

    // Рисуем сообщение юзера
    pushUser(text);

    // Идем за ответом
    modeBadge.textContent = "THINKING...";
    
    const response = await webSearch(text);

    if (response.ok) {
        pushBot(response.text, response.sources);
        modeBadge.textContent = response.model.toUpperCase();
    } else {
        pushBot("Произошла ошибка при поиске. Проверь воркер.");
        modeBadge.textContent = "READY";
    }
}

async function webSearch(query) {
    const model = modelSelect.value;
    const url = `${SEARCH_API}?q=${encodeURIComponent(query)}&model=${model}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { ok: false };
        const data = await res.json();

        if (data.results && data.results.length > 0) {
            let answer = `Нашел информацию по запросу **${query}**:\n\n`;
            data.results.forEach(res => {
                answer += `• **${res.title}**: ${res.text.slice(0, 150)}...\n`;
            });
            return { 
                ok: true, 
                text: answer, 
                model: data.model,
                sources: data.results.map(r => ({ name: r.source, url: r.url }))
            };
        }
        return { ok: true, text: "Результатов не найдено.", model: data.model, sources: [] };
    } catch (e) {
        return { ok: false };
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

    // Превращаем **текст** в жирный для красоты
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
    
    const body = document.createElement("div");
    body.innerHTML = formattedText;
    el.appendChild(body);

    if (sources.length > 0) {
        const srcWrap = document.createElement("div");
        srcWrap.className = "sources";
        srcWrap.innerHTML = "Источники: ";
        sources.forEach((s, i) => {
            const a = document.createElement("a");
            a.href = s.url;
            a.target = "_blank";
            a.textContent = s.name;
            srcWrap.appendChild(a);
            if (i < sources.length - 1) srcWrap.appendChild(document.createTextNode(" · "));
        });
        el.appendChild(srcWrap);
    }

    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
}
