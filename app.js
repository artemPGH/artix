// --- НАСТРОЙКИ ---
const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bd9FZKJXk-bK0vw_JPVOLigb"; // Используем стандартный ключ
const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

// Инициализация Supabase (исправленный метод)
const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Переменные состояния
let currentChatId = null;
let isSignUpMode = false;

// Элементы DOM
const els = {
    chatArea: document.getElementById("chat"),
    input: document.getElementById("input"),
    sendBtn: document.getElementById("sendBtn"),
    sidebar: document.getElementById("sidebar"),
    chatList: document.getElementById("chatList"),
    menuBtn: document.getElementById("menuBtn"),
    closeSidebarBtn: document.getElementById("closeSidebarBtn"),
    overlay: document.getElementById("overlay"),
    authModal: document.getElementById("authModal"),
    userEmail: document.getElementById("userEmail"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText"),
    newChatBtn: document.getElementById("newChatBtn"),
    authBtn: document.getElementById("authBtn"),
    toggleAuth: document.getElementById("toggleAuth")
};

// --- 1. ЛОГИКА ИНТЕРФЕЙСА ---

// Открытие/закрытие меню
function toggleMenu() {
    els.sidebar.classList.toggle("open");
    els.overlay.classList.toggle("active");
}

els.menuBtn.onclick = toggleMenu;
els.closeSidebarBtn.onclick = toggleMenu;
els.overlay.onclick = toggleMenu;

// Автоматическое расширение поля ввода
els.input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value === '') this.style.height = 'auto';
});

// Отправка по Enter
els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

els.sendBtn.onclick = sendMessage;

// --- 2. ЛОГИКА АВТОРИЗАЦИИ ---

els.loginBtn.onclick = () => els.authModal.style.display = "block";
document.getElementById("closeModal").onclick = () => els.authModal.style.display = "none";

els.toggleAuth.onclick = () => {
    isSignUpMode = !isSignUpMode;
    document.querySelector("#authModal h2").innerText = isSignUpMode ? "Регистрация" : "Вход в систему";
    els.authBtn.innerText = isSignUpMode ? "Создать аккаунт" : "Продолжить";
    els.toggleAuth.innerText = isSignUpMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать";
};

els.authBtn.onclick = async () => {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;
    
    if (!email || !password) return alert("Заполните все поля");

    try {
        const { error } = isSignUpMode 
            ? await sb.auth.signUp({ email, password })
            : await sb.auth.signInWithPassword({ email, password });

        if (error) throw error;
        
        els.authModal.style.display = "none";
        if (isSignUpMode) alert("Аккаунт создан! Теперь можно войти.");
        
    } catch (err) {
        alert("Ошибка: " + err.message);
    }
};

els.logoutBtn.onclick = async () => {
    await sb.auth.signOut();
    window.location.reload(); // Перезагружаем страницу для очистки
};

// Проверка статуса пользователя
sb.auth.onAuthStateChange((event, session) => {
    if (session) {
        els.userEmail.innerText = session.user.email;
        els.loginBtn.style.display = "none";
        els.logoutBtn.style.display = "inline-block";
        document.querySelector(".placeholder-text").style.display = "none";
        loadChats(); // Загружаем чаты при входе
    } else {
        els.userEmail.innerText = "Гость";
        els.loginBtn.style.display = "inline-block";
        els.logoutBtn.style.display = "none";
        els.chatList.innerHTML = '<div class="placeholder-text">Войдите для сохранения истории</div>';
    }
});

// --- 3. ЧАТЫ И СООБЩЕНИЯ ---

async function loadChats() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data } = await sb.from('chats').select('*').order('created_at', { ascending: false });
    
    els.chatList.innerHTML = "";
    if (data && data.length > 0) {
        data.forEach(chat => {
            const div = document.createElement("div");
            div.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
            div.innerText = chat.title || "Новый чат";
            div.onclick = () => openChat(chat.id);
            els.chatList.appendChild(div);
        });
    } else {
        els.chatList.innerHTML = '<div class="placeholder-text">История пуста</div>';
    }
}

els.newChatBtn.onclick = async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return alert("Сначала войдите в аккаунт");

    // Создаем новый чат в базе
    const { data, error } = await sb.from('chats').insert([{ user_id: user.id, title: 'Новый диалог' }]).select();
    
    if (error) return alert("Ошибка создания чата");
    
    if (data) {
        openChat(data[0].id);
        loadChats(); // Обновляем список
    }
};

async function openChat(chatId) {
    currentChatId = chatId;
    els.chatArea.innerHTML = ""; // Очищаем экран
    loadChats(); // Чтобы обновить подсветку активного чата

    // Загружаем сообщения
    const { data } = await sb.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    
    if (data) {
        data.forEach(msg => appendMessage(msg.role, msg.content, false));
    }
    
    // На мобильном закрываем меню
    if (window.innerWidth < 768) toggleMenu();
}

async function sendMessage() {
    const text = els.input.value.trim();
    if (!text) return;

    els.input.value = "";
    els.input.style.height = "auto";
    
    // Если чат не выбран, создаем новый (если пользователь залогинен)
    const { data: { user } } = await sb.auth.getUser();
    if (user && !currentChatId) {
        const { data } = await sb.from('chats').insert([{ user_id: user.id, title: text.substring(0, 20) + '...' }]).select();
        if (data) currentChatId = data[0].id;
        loadChats();
    }

    appendMessage('user', text);
    setStatus('thinking');

    try {
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(text)}&model=ARTIX-1`);
        const data = await res.json();
        
        let replyText = "Не удалось найти информацию.";
        let sources = [];

        if (data.ok && data.results.length > 0) {
            replyText = data.results.map(r => `🔹 **${r.title}**\n${r.text}`).join("\n\n");
            sources = data.results.map(r => ({ name: r.source, url: r.url }));
        }

        appendMessage('bot', replyText, sources);
        
    } catch (e) {
        appendMessage('bot', "Ошибка соединения с сервером.");
    } finally {
        setStatus('online');
    }
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

function appendMessage(role, text, sources = []) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    
    // Преобразуем текст (жирный шрифт, переносы)
    let html = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    
    // Если есть источники (только для бота)
    if (role === 'bot' && sources.length > 0) {
        const uniqueSources = [...new Map(sources.map(item => [item['url'], item])).values()];
        let sourcesHtml = `<div class="sources">Sources: `;
        uniqueSources.forEach(s => {
            sourcesHtml += `<a href="${s.url}" target="_blank">${s.name}</a>`;
        });
        sourcesHtml += `</div>`;
        html += sourcesHtml;
    }

    div.innerHTML = html;
    els.chatArea.appendChild(div);
    els.chatArea.scrollTop = els.chatArea.scrollHeight;

    // Сохраняем в базу, если есть ID чата и это новое сообщение
    if (currentChatId && sources !== false) { // sources=false используется как флаг "не сохранять при загрузке"
        sb.from('messages').insert([{ chat_id: currentChatId, role, content: text }]).then();
    }
}

function setStatus(state) {
    if (state === 'thinking') {
        els.statusDot.className = "status-dot thinking";
        els.statusText.innerText = "Думаю...";
    } else {
        els.statusDot.className = "status-dot online";
        els.statusText.innerText = "Система: Онлайн";
    }
}
