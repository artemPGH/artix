// --- НАСТРОЙКИ ---
const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bd9FZKJXk-bK0vw_JPVOLigb";
const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Переменные
let currentChatId = null;
let isSignUpMode = false;

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

// --- ФУНКЦИЯ ПРИВЕТСТВИЯ ---
function showWelcome() {
    els.chatArea.innerHTML = `
        <div class="welcome-container">
            <img src="./assets/artix-logo.png" alt="Logo" class="welcome-logo">
            <h1>Привет! Я ARTIX.</h1>
            <p>Готов помочь с поиском, кодом и идеями.</p>
        </div>
    `;
}

// --- ИНТЕРФЕЙС ---
// Универсальная функция переключения меню
function toggleMenu() {
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
        els.sidebar.classList.toggle("open");
        els.overlay.classList.toggle("active");
    } else {
        els.sidebar.classList.toggle("collapsed");
    }
}

els.menuBtn.onclick = toggleMenu;
els.closeSidebarBtn.onclick = toggleMenu;
els.overlay.onclick = toggleMenu;

els.input.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    if(this.value === '') this.style.height = 'auto';
});

els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});
els.sendBtn.onclick = sendMessage;

// --- АВТОРИЗАЦИЯ ---
els.loginBtn.onclick = () => els.authModal.style.display = "block";
document.getElementById("closeModal").onclick = () => els.authModal.style.display = "none";

els.toggleAuth.onclick = () => {
    isSignUpMode = !isSignUpMode;
    document.querySelector("#modalTitle").innerText = isSignUpMode ? "Регистрация" : "Вход в систему";
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
    window.location.reload();
};

sb.auth.onAuthStateChange((event, session) => {
    if (session) {
        els.userEmail.innerText = session.user.email;
        els.loginBtn.style.display = "none";
        els.logoutBtn.style.display = "inline-block";
        loadChats();
        if(!currentChatId) showWelcome();
    } else {
        els.userEmail.innerText = "Гость";
        els.loginBtn.style.display = "inline-block";
        els.logoutBtn.style.display = "none";
        els.chatList.innerHTML = '<div style="padding:10px; opacity:0.5; font-size:12px;">Войдите для сохранения истории</div>';
        showWelcome();
    }
});

// --- ЧАТЫ (Загрузка, Создание, Удаление, Переименование) ---

async function loadChats() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const { data } = await sb.from('chats').select('*').order('created_at', { ascending: false });
    
    els.chatList.innerHTML = "";
    if (data && data.length > 0) {
        data.forEach(chat => {
            const div = document.createElement("div");
            div.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
            
            // HTML для элемента списка с кнопками
            div.innerHTML = `
                <span class="chat-title" onclick="openChat('${chat.id}')">${chat.title || "Новый чат"}</span>
                <div class="chat-actions">
                    <button class="action-btn" onclick="renameChat('${chat.id}', '${chat.title}')">✏️</button>
                    <button class="action-btn delete" onclick="deleteChat('${chat.id}')">🗑️</button>
                </div>
            `;
            els.chatList.appendChild(div);
        });
    } else {
        els.chatList.innerHTML = '<div style="padding:10px; opacity:0.5; font-size:12px;">Нет истории</div>';
    }
}

// Удаление чата
window.deleteChat = async (id) => {
    if(!confirm("Удалить этот чат?")) return;
    await sb.from('chats').delete().eq('id', id);
    if(currentChatId === id) {
        currentChatId = null;
        showWelcome();
    }
    loadChats();
};

// Переименование чата
window.renameChat = async (id, oldTitle) => {
    const newTitle = prompt("Новое название:", oldTitle);
    if(newTitle && newTitle !== oldTitle) {
        await sb.from('chats').update({ title: newTitle }).eq('id', id);
        loadChats();
    }
};

// Открытие чата (глобальная функция для вызова из HTML)
window.openChat = async (chatId) => {
    currentChatId = chatId;
    els.chatArea.innerHTML = ""; 
    loadChats(); 

    const { data } = await sb.from('messages').select('*').eq('chat_id', chatId).order('created_at', { ascending: true });
    
    if (data && data.length > 0) {
        data.forEach(msg => appendMessage(msg.role, msg.content, msg.role === 'bot' ? [] : false, false));
    } else {
        showWelcome();
    }
    
    if (window.innerWidth < 768) toggleMenu();
};

els.newChatBtn.onclick = async () => {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return alert("Сначала войдите в аккаунт");
    
    // Сбрасываем текущий ID и показываем приветствие
    currentChatId = null;
    loadChats(); // Убираем выделение старого чата
    showWelcome();
};

// --- ОТПРАВКА СООБЩЕНИЙ ---

async function sendMessage() {
    const text = els.input.value.trim();
    if (!text) return;

    els.input.value = "";
    els.input.style.height = "auto";
    
    // Очищаем приветствие при первом сообщении
    if (!currentChatId && els.chatArea.querySelector('.welcome-container')) {
        els.chatArea.innerHTML = "";
    } else if (currentChatId) {
        const hasWelcome = els.chatArea.querySelector('.welcome-container');
        if(hasWelcome) els.chatArea.innerHTML = "";
    }

    // Если чата нет, создаем его
    const { data: { user } } = await sb.auth.getUser();
    if (user && !currentChatId) {
        const { data } = await sb.from('chats').insert([{ user_id: user.id, title: text.substring(0, 20) + '...' }]).select();
        if (data) {
            currentChatId = data[0].id;
            loadChats();
        }
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

function appendMessage(role, text, sources = [], save = true) {
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    let html = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    
    if (role === 'bot' && sources && sources.length > 0) {
        const unique = [...new Map(sources.map(item => [item['url'], item])).values()];
        html += `<div class="sources">Sources: ` + unique.map(s => `<a href="${s.url}" target="_blank">${s.name}</a>`).join('') + `</div>`;
    }
    div.innerHTML = html;
    els.chatArea.appendChild(div);
    els.chatArea.scrollTop = els.chatArea.scrollHeight;

    if (save && currentChatId) {
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
