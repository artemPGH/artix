const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bd9FZKJXk-bK0vw_JPVOLigb";
const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentChatId = null;
let currentUser = null;

const els = {
    chatArea: document.getElementById("chat"),
    input: document.getElementById("input"),
    sendBtn: document.getElementById("sendBtn"),
    sidebar: document.getElementById("sidebar"),
    chatList: document.getElementById("chatList"),
    menuBtn: document.getElementById("menuBtn"),
    userEmail: document.getElementById("userEmail"),
    loginBtn: document.getElementById("loginBtn"),
    authModal: document.getElementById("authModal")
};

// --- ИНТЕРФЕЙС ---
els.menuBtn.onclick = () => {
    els.sidebar.classList.toggle("collapsed");
};

els.sendBtn.onclick = sendMessage;

// --- ФУНКЦИИ ---
async function sendMessage() {
    const text = els.input.value.trim();
    if (!text) return;
    els.input.value = "";
    
    appendMessage('user', text);
    
    try {
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(text)}`);
        const data = await res.json();
        let reply = data.results?.map(r => r.text).join("\n\n") || "Нет данных.";
        appendMessage('bot', reply);
    } catch (e) {
        appendMessage('bot', "Ошибка.");
    }
}

function appendMessage(role, text) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    
    if (role === 'bot') {
        // Используем библиотеку marked для Markdown
        div.innerHTML = marked.parse(text);
    } else {
        div.innerText = text;
    }
    
    els.chatArea.appendChild(div);
    els.chatArea.scrollTop = els.chatArea.scrollHeight;
}

// Показ приветствия при загрузке
els.chatArea.innerHTML = `<div class="welcome-container"><h1>ARTIX 1.2 DEV</h1><p>Таймер отключен для разработки.</p></div>`;
