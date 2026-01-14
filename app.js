const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const modelSelect = document.getElementById("modelSelect");
const modeBadge = document.getElementById("modeBadge");

init();

function init() {
    pushBot("ARTIX online ✅. Чем я могу помочь сегодня?");

    sendBtn.addEventListener("click", onSend);

    clearBtn.addEventListener("click", () => {
        chatEl.innerHTML = "";
        pushBot("История очищена.");
    });

    inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
        }
    });

    inputEl.addEventListener("input", () => {
        inputEl.style.height = "auto";
        inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + "px";
    });
}

async function onSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";
    inputEl.style.height = "auto";

    pushUser(text);
    modeBadge.textContent = "THINKING...";

    const result = await webSearch(text);

    if (result.ok && result.results.length > 0) {
        let responseText = `Вот что удалось найти по запросу **${text}**:\n\n`;
        result.results.forEach(item => {
            responseText += `🔹 **${item.title}**\n${item.text}\n\n`;
        });
        
        pushBot(responseText, result.results.map(r => ({ name: r.source, url: r.url })));
    } else {
        pushBot("К сожалению, по этому запросу ничего не нашлось в базе знаний. Попробуй спросить иначе!");
    }
    
    modeBadge.textContent = result.model ? result.model.toUpperCase() : "READY";
}

async function webSearch(query) {
    const model = modelSelect.value;
    const url = `${SEARCH_API}?q=${encodeURIComponent(query)}&model=${model}`;

    try {
        const res = await fetch(url);
        if (!res.ok) return { ok: false };
        return await res.json();
    } catch (e) {
        console.error("Search error:", e);
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

    const formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
    
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
