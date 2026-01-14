// Конфигурация Supabase (твои данные из скриншота)
const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bd9FZKJXk-bK0vw_JPVOLigb";

// Инициализация клиента. Используем 'sb', чтобы не конфликтовать с глобальным объектом 'supabase'
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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

// --- ФУНКЦИИ АВТОРИЗАЦИИ ---

// Открыть/закрыть модальное окно
loginBtn.onclick = () => authModal.style.display = "block";
document.getElementById("closeModal").onclick = () => authModal.style.display = "none";

// Переключение между Входом и Регистрацией
document.getElementById("toggleAuth").onclick = (e) => {
    e.preventDefault();
    isSignUpMode = !isSignUpMode;
    document.getElementById("modalTitle").innerText = isSignUpMode ? "Регистрация" : "Вход в ARTIX";
    authBtn.innerText = isSignUpMode ? "Создать аккаунт" : "Войти";
    e.target.innerText = isSignUpMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать профиль";
};

// Обработка кнопки Входа/Регистрации
authBtn.onclick = async () => {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    if (!email || !password) return alert("Введите почту и пароль");

    if (isSignUpMode) {
        const { error } = await sb.auth.signUp({ email, password });
        if (error) alert("Ошибка регистрации: " + error.message);
        else alert("Успешно! Если вы не отключили подтверждение в настройках Supabase, проверьте почту.");
    } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) alert("Ошибка входа: " + error.message);
        else authModal.style.display = "none";
    }
};

// Выход из аккаунта
logoutBtn.onclick = async () => {
    await sb.auth.signOut();
};

// Отслеживание состояния пользователя (вошел или вышел)
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

// --- ФУНКЦИИ ЧАТА ---

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
            let reply = `Вот что удалось найти по запросу **${text}**:\n\n`;
            data.results.forEach(r => {
                reply += `🔹 **${r.title}**\n${r.text}\n\n`;
            });
            pushBot(reply, data.results.map(r => ({ name: r.source, url: r.url })));
        } else {
            pushBot("К сожалению, информации не найдено. Попробуй спросить иначе.");
        }
    } catch (err) {
        pushBot("Ошибка связи с воркером. Проверь статус Cloudflare.");
    } finally {
        document.getElementById("modeBadge").innerText = "READY";
    }
}

sendBtn.onclick = onSend;
inputEl.onkeydown = (e) => { 
    if(e.key === 'Enter' && !e.shiftKey) { 
        e.preventDefault(); 
        onSend(); 
    } 
};

function pushUser(text) {
    const el = document.createElement("div");
    el.className = "msg user";
    el.innerText = text;
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
}

function pushBot(text, sources = []) {
    const el = document.createElement("div");
    el.className = "msg bot";
    
    // Форматирование жирного текста и переносов
    const formatted = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    
    const body = document.createElement("div");
    body.innerHTML = formatted;
    el.appendChild(body);

    if (sources.length > 0) {
        const sDiv = document.createElement("div");
        sDiv.className = "sources";
        sDiv.innerHTML = "Источники: ";
        
        // Удаляем дубликаты ссылок
        const unique = Array.from(new Set(sources.map(s => s.url))).map(url => sources.find(s => s.url === url));
        
        unique.forEach((s, i) => {
            const a = document.createElement("a");
            a.href = s.url;
            a.target = "_blank";
            a.innerText = s.name;
            sDiv.appendChild(a);
            if (i < unique.length - 1) sDiv.appendChild(document.createTextNode(" · "));
        });
        el.appendChild(sDiv);
    }
    
    chatEl.appendChild(el);
    chatEl.scrollTop = chatEl.scrollHeight;
}

document.getElementById("clearBtn").onclick = () => {
    chatEl.innerHTML = "";
    pushBot("Чат очищен.");
};
