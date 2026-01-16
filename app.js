const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bd9FZKJXk-bK0vw_JPVOLigb";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

let currentChatId = null;
let isSignUpMode = false;

// Элементы
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const chatList = document.getElementById("chatList");
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");

// --- УПРАВЛЕНИЕ ИНТЕРФЕЙСОМ ---

document.getElementById("menuBtn").onclick = () => {
    sidebar.classList.add("open");
    overlay.classList.add("active");
};

overlay.onclick = () => {
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
};

// --- АВТОРИЗАЦИЯ ---

document.getElementById("loginBtn").onclick = () => document.getElementById("authModal").style.display = "block";
document.getElementById("closeModal").onclick = () => document.getElementById("authModal").style.display = "none";

sb.auth.onAuthStateChange((event, session) => {
    if (session) {
        document.getElementById("userEmail").innerText = session.user.email;
        document.getElementById("loginBtn").style.display = "none";
        document.getElementById("logoutBtn").style.display = "inline-block";
        loadChats();
    } else {
        document.getElementById("userEmail").innerText = "Гость";
        document.getElementById("loginBtn").style.display = "inline-block";
        document.getElementById("logoutBtn").style.display = "none";
        chatList.innerHTML = "";
    }
});

// --- РАБОТА С ЧАТАМИ ---

async function loadChats() {
    const { data, error } = await sb.from('chats').select('*').order('created_at', { ascending: false });
    if (data) {
        chatList.innerHTML = "";
        data.forEach(chat => {
            const el = document.createElement("div");
            el.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
            el.innerText = chat.title;
            el.onclick = () => selectChat(chat.id);
            chatList.appendChild(el);
        });
    }
}

async function selectChat(id) {
    currentChatId = id;
    sidebar.classList.remove("open");
    overlay.classList.remove("active");
    chatEl.innerHTML = "";
    loadMessages(id);
    loadChats();
}

async function loadMessages(chatId) {
    const { data } = await sb.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    if (data) data.forEach(m => m.role === 'user' ? pushUser(m.content, false) : pushBot(m.content, [], false));
}

document.getElementById("newChatBtn").onclick = async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return alert("Войдите, чтобы создавать чаты");

    const { data, error } = await sb.from('chats').insert([{ user_id: user.id, title: 'Новый чат' }]).select();
    if (data) selectChat(data[0].id);
};

// --- ЛОГИКА ОТПРАВКИ ---

async function onSend() {
    const text = inputEl.value.trim();
    if (!text) return;

    inputEl.value = "";
    pushUser(text, true);

    document.getElementById("modeBadge").innerText = "THINKING...";

    try {
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(text)}`);
        const data = await res.json();
        
        let reply = "Ничего не найдено.";
        let sources = [];

        if (data.ok && data.results.length > 0) {
            reply = `Нашел информацию по запросу **${text}**:\n\n`;
            data.results.forEach(r => reply += `🔹 **${r.title}**\n${r.text}\n\n`);
            sources = data.results.map(r => ({ name: r.source, url: r.url }));
        }

        pushBot(reply, sources, true);
    } catch (e) {
        pushBot("Ошибка поиска.");
    } finally {
        document.getElementById("modeBadge").innerText = "READY";
    }
}

document.getElementById("sendBtn").onclick = onSend;

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function pushUser(text, save = true) {
    const el = document.createElement("div"); el.className = "msg user"; el.innerText = text;
    chatEl.appendChild(el); chatEl.scrollTop = chatEl.scrollHeight;
    if (save && currentChatId) sb.from('messages').insert([{ chat_id: currentChatId, role: 'user', content: text }]).then();
}

function pushBot(text, sources = [], save = true) {
    const el = document.createElement("div"); el.className = "msg bot";
    el.innerHTML = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    
    if (sources.length > 0) {
        const sDiv = document.createElement("div"); sDiv.className = "sources"; sDiv.innerText = "Источники: ";
        sources.forEach(s => sDiv.innerHTML += `<a href="${s.url}" target="_blank">${s.name}</a> `);
        el.appendChild(sDiv);
    }

    chatEl.appendChild(el); chatEl.scrollTop = chatEl.scrollHeight;
    if (save && currentChatId) sb.from('messages').insert([{ chat_id: currentChatId, role: 'bot', content: text }]).then();
}
