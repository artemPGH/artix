// --- НАСТРОЙКИ ---
const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bD9FZKJXk-bK0vw_JPV0Ligb";
const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentChatId = null;
let isSignUpMode = false;
let currentUser = null;

const els = {
    chatArea: document.getElementById("chat"),
    input: document.getElementById("input"),
    sendBtn: document.getElementById("sendBtn"),
    sidebar: document.getElementById("sidebar"),
    chatList: document.getElementById("chatList"),
    menuBtn: document.getElementById("menuBtn"),
    closeSidebarBtn: document.getElementById("closeSidebarBtn"),
    overlay: document.getElementById("overlay"),
    
    // Auth Modal
    authModal: document.getElementById("authModal"),
    closeAuthModal: document.getElementById("closeAuthModal"),
    authEmail: document.getElementById("authEmail"),
    authPassword: document.getElementById("authPassword"),
    authBtn: document.getElementById("authBtn"),
    toggleAuth: document.getElementById("toggleAuth"),
    
    // Profile Modal
    profileModal: document.getElementById("profileModal"),
    closeProfileModal: document.getElementById("closeProfileModal"),
    newPassword: document.getElementById("newPassword"),
    savePasswordBtn: document.getElementById("savePasswordBtn"),
    avatarInput: document.getElementById("avatarInput"),
    profilePreview: document.getElementById("profilePreview"),
    
    // User Section
    userSection: document.getElementById("userSection"),
    userEmail: document.getElementById("userEmail"),
    userAvatar: document.getElementById("userAvatar"),
    loginBtn: document.getElementById("loginBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    
    newChatBtn: document.getElementById("newChatBtn"),
    statusDot: document.getElementById("statusDot"),
    statusText: document.getElementById("statusText")
};

// --- ИНТЕРФЕЙС ---
function toggleMenu() {
    if (window.innerWidth <= 768) {
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});
els.sendBtn.onclick = sendMessage;

// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---

// Клик по профилю в сайдбаре
els.userSection.onclick = () => {
    if (currentUser) {
        // Если вошли — открываем настройки
        els.profileModal.style.display = "block";
        updateAvatarPreview(currentUser.user_metadata?.avatar_url);
    } else {
        // Если гость — открываем вход
        els.authModal.style.display = "block";
    }
};

// Закрытие модалок
els.closeAuthModal.onclick = () => els.authModal.style.display = "none";
els.closeProfileModal.onclick = () => els.profileModal.style.display = "none";

// Логика Входа/Регистрации
els.toggleAuth.onclick = () => {
    isSignUpMode = !isSignUpMode;
    document.querySelector("#modalTitle").innerText = isSignUpMode ? "Регистрация" : "Вход в систему";
    els.authBtn.innerText = isSignUpMode ? "Создать аккаунт" : "Продолжить";
    els.toggleAuth.innerText = isSignUpMode ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать";
};

els.authBtn.onclick = async () => {
    const email = els.authEmail.value;
    const password = els.authPassword.value;
    if (!email || !password) return alert("Заполните поля");

    const { error } = isSignUpMode 
        ? await sb.auth.signUp({ email, password })
        : await sb.auth.signInWithPassword({ email, password });

    if (error) alert(error.message);
    else els.authModal.style.display = "none";
};

// Выход
els.logoutBtn.onclick = async () => {
    await sb.auth.signOut();
    window.location.reload();
};

// --- ФУНКЦИИ ПРОФИЛЯ ---

// Загрузка аватарки
els.avatarInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    // Показываем прелоадер
    els.profilePreview.innerHTML = "⌛";

    try {
        const filePath = `${currentUser.id}/${Date.now()}_${file.name}`;
        // Загружаем в Storage
        const { error: uploadError } = await sb.storage.from('avatars').upload(filePath, file);
        if (uploadError) throw uploadError;

        // Получаем публичную ссылку
        const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(filePath);

        // Обновляем профиль пользователя
        const { error: updateError } = await sb.auth.updateUser({
            data: { avatar_url: publicUrl }
        });
        if (updateError) throw updateError;

        // Обновляем UI
        updateAvatarPreview(publicUrl);
        alert("Аватар обновлен!");
    } catch (err) {
        alert("Ошибка загрузки: " + err.message);
        updateAvatarPreview(null);
    }
};

// Смена пароля
els.savePasswordBtn.onclick = async () => {
    const newPass = els.newPassword.value;
    if (!newPass) return alert("Введите новый пароль");
    
    const { error } = await sb.auth.updateUser({ password: newPass });
    if (error) alert("Ошибка: " + error.message);
    else {
        alert("Пароль изменен");
        els.newPassword.value = "";
    }
};

function updateAvatarPreview(url) {
    const html = url ? `<img src="${url}" alt="Avatar">` : `👤`;
    els.profilePreview.innerHTML = html;
    els.userAvatar.innerHTML = html;
}

// --- СОСТОЯНИЕ ПОЛЬЗОВАТЕЛЯ ---

sb.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        els.userEmail.innerText = currentUser.email;
        els.loginBtn.style.display = "none"; // Скрываем кнопку "Войти" внутри профиля
        updateAvatarPreview(currentUser.user_metadata?.avatar_url);
        
        loadChats();
        if(!currentChatId) showWelcome();
    } else {
        currentUser = null;
        els.userEmail.innerText = "Гость";
        els.loginBtn.style.display = "block";
        els.userAvatar.innerHTML = "👤";
        els.chatList.innerHTML = "";
        showWelcome();
    }
});

// --- ЧАТЫ (Логика та же) ---

async function loadChats() {
    if (!currentUser) return;
    const { data } = await sb.from('chats').select('*').order('created_at', { ascending: false });
    
    els.chatList.innerHTML = "";
    if (data && data.length > 0) {
        data.forEach(chat => {
            const div = document.createElement("div");
            div.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
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

window.openChat = async (id) => {
    currentChatId = id;
    els.chatArea.innerHTML = "";
    loadChats();
    const { data } = await sb.from('messages').select('*').eq('chat_id', id).order('created_at', { ascending: true });
    if (data) data.forEach(msg => appendMessage(msg.role, msg.content, msg.role === 'bot' ? [] : false, false));
    if (window.innerWidth < 768) toggleMenu();
};

window.deleteChat = async (id) => {
    if(!confirm("Удалить?")) return;
    await sb.from('chats').delete().eq('id', id);
    if(currentChatId === id) { currentChatId = null; showWelcome(); }
    loadChats();
};

window.renameChat = async (id, oldTitle) => {
    const newTitle = prompt("Название:", oldTitle);
    if(newTitle && newTitle !== oldTitle) {
        await sb.from('chats').update({ title: newTitle }).eq('id', id);
        loadChats();
    }
};

els.newChatBtn.onclick = async () => {
    if (!currentUser) return alert("Войдите в систему");
    currentChatId = null;
    loadChats();
    showWelcome();
};

function showWelcome() {
    els.chatArea.innerHTML = `
        <div class="welcome-container">
            <img src="./assets/artix-logo.png" alt="Logo" class="welcome-logo">
            <h1>Привет! Я ARTIX.</h1>
            <p>Готов помочь с поиском, кодом и идеями.</p>
        </div>
    `;
}

// --- ОТПРАВКА ---

async function sendMessage() {
    const text = els.input.value.trim();
    if (!text) return;
    
    // Удаляем приветствие при первом сообщении
    const welcome = els.chatArea.querySelector('.welcome-container');
    if (welcome) welcome.remove();

    els.input.value = "";
    els.input.style.height = "auto";

    if (currentUser && !currentChatId) {
        const { data } = await sb.from('chats').insert([{ user_id: currentUser.id, title: text.substring(0, 20) + '...' }]).select();
        if (data) { currentChatId = data[0].id; loadChats(); }
    }

    appendMessage('user', text);
    setStatus('thinking');

    try {
        const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(text)}&model=ARTIX-1`);
        const data = await res.json();
        let reply = data.results?.length > 0 ? data.results.map(r => `🔹 **${r.title}**\n${r.text}`).join("\n\n") : "Ничего не найдено.";
        let sources = data.results?.map(r => ({ name: r.source, url: r.url })) || [];
        
        appendMessage('bot', reply, sources);
    } catch (e) {
        appendMessage('bot', "Ошибка соединения.");
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

    if (save && currentChatId) sb.from('messages').insert([{ chat_id: currentChatId, role, content: text }]).then();
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
