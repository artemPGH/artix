// --- КОНФИГУРАЦИЯ ---
const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bD9FZKJXk-bK0vw_JPV0Ligb";
const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

// Проверяем, загрузился ли Supabase
if (!window.supabase) {
    console.error("CRITICAL: Supabase library not loaded!");
    alert("Ошибка: Библиотека Supabase не подключена в HTML.");
}

const { createClient } = window.supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentChatId = null;
let isSignUpMode = false;
let currentUser = null;

// --- ПОЛУЧЕНИЕ ЭЛЕМЕНТОВ (БЕЗОПАСНО) ---
const getEl = (id) => document.getElementById(id);

const els = {
    chatArea: getEl("chat"),
    input: getEl("input"),
    sendBtn: getEl("sendBtn"),
    sidebar: getEl("sidebar"),
    chatList: getEl("chatList"),
    menuBtn: getEl("menuBtn"),
    overlay: getEl("overlay"),
    authModal: getEl("authModal"),
    closeAuthModal: getEl("closeAuthModal"),
    authEmail: getEl("authEmail"),
    authPassword: getEl("authPassword"),
    authBtn: getEl("authBtn"),
    toggleAuth: getEl("toggleAuth"),
    profileModal: getEl("profileModal"),
    closeProfileModal: getEl("closeProfileModal"),
    avatarInput: getEl("avatarInput"),
    profilePreview: getEl("profilePreview"),
    userSection: getEl("userSection"),
    userEmail: getEl("userEmail"),
    userAvatar: getEl("userAvatar"),
    loginBtn: getEl("loginBtn"),
    logoutBtn: getEl("logoutBtn"),
    newChatBtn: getEl("newChatBtn"),
    statusDot: getEl("statusDot"),
    statusText: getEl("statusText"),
    modelSelect: getEl("modelSelect")
};

// --- БЕЗОПАСНЫЕ ОБРАБОТЧИКИ СОБЫТИЙ ---

if (els.menuBtn) {
    els.menuBtn.onclick = () => {
        if (els.sidebar) els.sidebar.classList.toggle(window.innerWidth <= 768 ? "open" : "collapsed");
        if (els.overlay && window.innerWidth <= 768) els.overlay.classList.toggle("active");
    };
}

if (els.overlay) {
    els.overlay.onclick = () => {
        if (els.sidebar) els.sidebar.classList.remove("open");
        els.overlay.classList.remove("active");
    };
}

if (els.input) {
    els.input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

if (els.sendBtn) els.sendBtn.onclick = sendMessage;

if (els.newChatBtn) {
    els.newChatBtn.onclick = () => {
        currentChatId = null;
        document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
        showWelcome();
    };
}

// --- ФУНКЦИИ ИНТЕРФЕЙСА ---

function showWelcome() {
    if (!els.chatArea) return;
    els.chatArea.innerHTML = `
        <div class="welcome-container">
            <img src="./assets/artix-logo.png" class="welcome-logo" onerror="this.style.display='none'">
            <h1>Привет! Я ARTIX.</h1>
            <p>Готов помочь с поиском, кодом и идеями.</p>
        </div>`;
}

async function loadChats() {
    if (!currentUser || !els.chatList) return;
    
    const { data, error } = await sb.from('chats')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Ошибка загрузки чатов:", error.message);
        return;
    }

    els.chatList.innerHTML = "";
    if (data && data.length > 0) {
        data.forEach(chat => {
            const div = document.createElement("div");
            div.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
            div.innerHTML = `
                <span class="chat-title" onclick="window.openChat('${chat.id}', '${chat.title}')">${chat.title}</span>
                <div class="chat-actions">
                    <button class="action-btn" onclick="window.renameChat('${chat.id}', '${chat.title}', event)">✎</button>
                    <button class="action-btn delete" onclick="window.deleteChat('${chat.id}', event)">🗑</button>
                </div>
            `;
            els.chatList.appendChild(div);
        });
    } else {
        els.chatList.innerHTML = '<div style="padding:15px; color:#555; font-size:12px;">История пуста</div>';
    }
}

// Глобальные функции (для onclick в HTML)
window.openChat = async (id, title) => { // ИЗМЕНЕНО: теперь функция async
    currentChatId = id;
    
    if (els.chatArea) {
        els.chatArea.innerHTML = '';
        appendMessage('bot', `_Загрузка истории..._`); // Временный текст пока идет загрузка
    }
    
    if (window.innerWidth <= 768) {
        if (els.sidebar) els.sidebar.classList.remove("open");
        if (els.overlay) els.overlay.classList.remove("active");
    }

    // НОВАЯ ЛОГИКА: Скачиваем сообщения из Supabase
    if (currentUser) {
        try {
            const { data: messages, error } = await sb
                .from('messages')
                .select('*')
                .eq('chat_id', id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            if (els.chatArea) {
                els.chatArea.innerHTML = ''; // Убираем текст "Загрузка истории..."
                if (messages && messages.length > 0) {
                    messages.forEach(msg => {
                        appendMessage(msg.role, msg.content);
                    });
                } else {
                    appendMessage('bot', `_В этом чате пока нет сообщений._`);
                }
            }
        } catch (err) {
            console.error("Ошибка загрузки истории:", err);
            if (els.chatArea) {
                els.chatArea.innerHTML = '';
                appendMessage('bot', `⚠ **Ошибка:** Не удалось загрузить историю.`);
            }
        }
    }

    loadChats(); // Обновляем выделение кнопки в меню
};

window.deleteChat = async (id, event) => {
    event.stopPropagation();
    if (!confirm("Удалить этот чат навсегда?")) return;
    
    const { error } = await sb.from('chats').delete().eq('id', id);
    if (error) alert("Ошибка: " + error.message);
    else {
        if (currentChatId === id) currentChatId = null;
        loadChats();
        if (!currentChatId) showWelcome();
    }
};

window.renameChat = async (id, oldTitle, event) => {
    event.stopPropagation();
    const newTitle = prompt("Введите новое название:", oldTitle);
    if (!newTitle || newTitle === oldTitle) return;

    const { error } = await sb.from('chats').update({ title: newTitle }).eq('id', id);
    if (error) alert("Ошибка при обновлении");
    else loadChats();
};

// --- ЛОГИКА ОТПРАВКИ (ARTIX 1.0 / 1.2) ---

async function sendMessage() {
    if (!els.input) return;
    const text = els.input.value.trim();
    if (!text) return;

    const selectedModel = els.modelSelect ? els.modelSelect.value : "artix-1";

    if (currentUser && !currentChatId) {
        try {
            const title = text.length > 25 ? text.substring(0, 25) + '...' : text;
            const { data } = await sb.from('chats').insert([{ user_id: currentUser.id, title: title }]).select().single();
            if (data) {
                currentChatId = data.id;
                loadChats();
            }
        } catch (e) { console.error("Ошибка создания чата:", e); }
    }

    if (els.chatArea) {
        const welcome = els.chatArea.querySelector('.welcome-container');
        if (welcome) welcome.remove();
    }

    els.input.value = "";
    els.input.style.height = "auto";
    appendMessage('user', text);
    setStatus('thinking');

    // НОВАЯ ЛОГИКА: Сохраняем вопрос пользователя в базу
    if (currentUser && currentChatId) {
        sb.from('messages').insert([{ chat_id: currentChatId, role: 'user', content: text }]).then(({error}) => {
            if (error) console.error("Ошибка сохранения вопроса:", error);
        });
    }

    try {
        const url = `${SEARCH_API}?q=${encodeURIComponent(text)}&model=${selectedModel}`;
        console.log("Запрос:", url); 

        const res = await fetch(url);
        
        if (!res.ok) throw new Error(`Ошибка сервера: ${res.status}`);
        
        const data = await res.json();
        
        if (data.error) throw new Error(data.error);

        const reply = data.results && data.results[0] ? data.results[0].text : "Ответ не получен.";
            
        setStatus('online');
        typeWriter(reply);

        // НОВАЯ ЛОГИКА: Сохраняем ответ ARTIX в базу
        if (currentUser && currentChatId) {
            sb.from('messages').insert([{ chat_id: currentChatId, role: 'bot', content: reply }]).then(({error}) => {
                if (error) console.error("Ошибка сохранения ответа:", error);
            });
        }

    } catch (e) {
        setStatus('online');
        console.error(e);
        appendMessage('bot', `⚠ **Ошибка:** ${e.message}`);
    }
}

function appendMessage(role, text) {
    if (!els.chatArea) return;
    const div = document.createElement("div");
    div.className = `msg ${role}`;
    div.innerHTML = (role === 'bot' && typeof marked !== 'undefined') ? marked.parse(text) : text;
    els.chatArea.appendChild(div);
    els.chatArea.scrollTop = els.chatArea.scrollHeight;
}

function typeWriter(text) {
    if (!els.chatArea) return;
    const div = document.createElement("div");
    div.className = "msg bot";
    els.chatArea.appendChild(div);
    let i = 0;
    
    const useMarked = (typeof marked !== 'undefined');

    function type() {
        if (i < text.length) {
            const content = text.substring(0, i + 1);
            div.innerHTML = useMarked ? marked.parse(content) : content;
            
            i++;
            els.chatArea.scrollTop = els.chatArea.scrollHeight;
            setTimeout(type, 10);
        }
    }
    type();
}

function setStatus(state) {
    if (els.statusDot) els.statusDot.className = state === 'thinking' ? "status-dot thinking" : "status-dot online";
    if (els.statusText) els.statusText.innerText = state === 'thinking' ? "ARTIX думает..." : "Система: Онлайн";
}

// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---

if (els.userSection) {
    els.userSection.onclick = (e) => {
        if (e.target.closest('#loginBtn') || e.target.id === 'loginBtn') {
            if (els.authModal) els.authModal.style.display = "block";
            return;
        }
        if (currentUser && els.profileModal) els.profileModal.style.display = "block";
    };
}

if (els.closeAuthModal) els.closeAuthModal.onclick = () => els.authModal.style.display = "none";
if (els.closeProfileModal) els.closeProfileModal.onclick = () => els.profileModal.style.display = "none";

if (els.toggleAuth) {
    els.toggleAuth.onclick = () => {
        isSignUpMode = !isSignUpMode;
        const title = document.getElementById("modalTitle");
        if (title) title.innerText = isSignUpMode ? "Регистрация" : "Вход в систему";
        if (els.authBtn) els.authBtn.innerText = isSignUpMode ? "Создать аккаунт" : "Продолжить";
    };
}

if (els.authBtn) {
    els.authBtn.onclick = async () => {
        const email = els.authEmail ? els.authEmail.value : "";
        const password = els.authPassword ? els.authPassword.value : "";
        
        if (!email || !password) {
            alert("Введите email и пароль!");
            return;
        }

        const { error } = isSignUpMode 
            ? await sb.auth.signUp({ email, password }) 
            : await sb.auth.signInWithPassword({ email, password });
        
        if (error) alert(error.message);
        else if (els.authModal) els.authModal.style.display = "none";
    };
}

if (els.logoutBtn) {
    els.logoutBtn.onclick = async () => {
        await sb.auth.signOut();
        window.location.reload();
    };
}

// --- АВАТАР ---
function updateAvatarPreview(url) {
    const smallSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;
    const bigSvg = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`;

    if (els.userAvatar) {
        els.userAvatar.innerHTML = url 
            ? `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` 
            : smallSvg;
    }
    
    if (els.profilePreview) {
        els.profilePreview.innerHTML = url 
            ? `<img src="${url}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">` 
            : bigSvg;
    }
}

if (els.avatarInput) {
    els.avatarInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file || !currentUser) return;
        try {
            const filePath = `${currentUser.id}/${Date.now()}`;
            const { error } = await sb.storage.from('avatars').upload(filePath, file);
            if (error) throw error;

            const { data: { publicUrl } } = sb.storage.from('avatars').getPublicUrl(filePath);
            await sb.auth.updateUser({ data: { avatar_url: publicUrl } });
            updateAvatarPreview(publicUrl);
        } catch (err) {
            alert("Ошибка загрузки: " + err.message);
        }
    };
}

// --- СЛУШАТЕЛЬ СЕССИИ ---
sb.auth.onAuthStateChange((event, session) => {
    if (session) {
        currentUser = session.user;
        if (els.userEmail) els.userEmail.innerText = currentUser.email;
        if (els.loginBtn) els.loginBtn.style.display = "none";
        updateAvatarPreview(currentUser.user_metadata?.avatar_url);
        loadChats();
    } else {
        currentUser = null;
        if (els.userEmail) els.userEmail.innerText = "Гость";
        if (els.loginBtn) els.loginBtn.style.display = "block";
        if (els.chatList) els.chatList.innerHTML = "";
        showWelcome();
    }
});
