// Конфигурация Supabase
const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
// ВНИМАНИЕ: Если этот ключ не сработает, скопируй еще раз "anon public" из панели Supabase
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bd9FZKJXk-bK0vw_JPVOLigb";

// Используем глобальное имя для создания клиента
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

// Элементы интерфейса
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authModal = document.getElementById("authModal");
const userEmailText = document.getElementById("userEmail");
const authBtn = document.getElementById("authBtn");
const modelSelect = document.getElementById("modelSelect");

let isSignUpMode = false;

// --- АВТОРИЗАЦИЯ ---

loginBtn.onclick = () => authModal.style.display = "block";
document.getElementById("closeModal").onclick = () => authModal.style.display = "none";

document.getElementById("toggleAuth").onclick = (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    document.getElementById("modalTitle").innerText = isSignUpMode ? "Регистрация" : "Вход в ARTIX";
    authBtn.innerText = isSignUpMode ? "Создать аккаунт" : "Войти";
    e.target.innerText = isSignUpMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать профиль";
};

authBtn.onclick = async () => {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    if (!email || !password) return alert("Введите данные");

    try {
        if (isSignUpMode) {
            const { error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            alert("Готово! Проверьте почту (или войдите, если подтверждение отключено).");
        } else {
            const { error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            authModal.style.display = "none";
        }
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
};

logoutBtn.onclick = async () => {
    await sb.auth.signOut();
};

sb.auth.onAuthStateChange((event, session) => {
    if (session) {
        userEmailText.innerText = session.user.email;
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
    } else {
        userEmailText.innerText = "Гость";
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
    }
});

// --- ЧАТ ---

async function onSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    
    inputEl.value = "";
    inputEl.style.height = "auto";
    pushUser(text);

    document.getElementById("modeBadge").innerText = "THINKING...";

    try {
        const model = modelSelect.value;
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(text)}&model=${model}`);
        const data = await res.json();

        if (data.ok && data.results && data.results.length > 0) {
            let reply = `Результаты по запросу **${text}**:\n\n`;
            data.results.forEach(r => reply += `🔹 **${r.title}**\n${r.text}\n\n`);
            pushBot(reply, data.results.map(r => ({ name: r.source, url: r.url })));
        } else {
            pushBot("Информации не найдено.");
        }
    } catch (err) {
        pushBot("Ошибка подключения к поиску.");
    } finally {
        document.getElementById("modeBadge").innerText = "READY";
    }
}

sendBtn.onclick = onSend;
inputEl.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } };

function pushUser(t) {
    const el = document.createElement("div"); el.className = "msg user"; el.innerText = t;
    chatEl.appendChild(el); chatEl.scrollTop = chatEl.scrollHeight;
}

function pushBot(t, sources = []) {
    const el = document.createElement("div"); el.className = "msg bot";
    const formatted = t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    const body = document.createElement("div"); body.innerHTML = formatted;
    el.appendChild(body);

    if (sources.length > 0) {
        const sDiv = document.createElement("div"); sDiv.className = "sources"; sDiv.innerHTML = "Источники: ";
        const unique = Array.from(new Set(sources.map(s => s.url))).map(url => sources.find(s => s.url === url));
        unique.forEach((s, i) => {
            const a = document.createElement("a"); a.href = s.url; a.target = "_blank"; a.innerText = s.name;
            sDiv.appendChild(a);
            if (i < unique.length - 1) sDiv.appendChild(document.createTextNode(" · "));
        });
        el.appendChild(sDiv);
    }
    chatEl.appendChild(el); chatEl.scrollTop = chatEl.scrollHeight;
}

document.getElementById("clearBtn").onclick = () => { chatEl.innerHTML = ""; pushBot("Чат очищен."); };
