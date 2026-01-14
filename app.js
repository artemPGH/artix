// ТВОИ ДАННЫЕ ИЗ SUPABASE
const SUPABASE_URL = "https://ptetkaidxtignrlhrbpj.supabase.co";
const SUPABASE_KEY = "sb_publishable_Y5HdMr6bd9FZKJXk-bK0vw_JPVOLigb";
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SEARCH_API = "https://artix-search.facts-com99.workers.dev/api/search";

// Элементы
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authModal = document.getElementById("authModal");
const userEmailText = document.getElementById("userEmail");

let isSignUp = false;

// --- ЛОГИКА АВТОРИЗАЦИИ ---

// Открыть модалку
loginBtn.onclick = () => authModal.style.display = "block";
document.getElementById("closeModal").onclick = () => authModal.style.display = "none";

// Переключение Вход / Регистрация
document.getElementById("toggleAuth").onclick = (e) => {
    e.preventDefault();
    isSignUp = !isSignUp;
    document.getElementById("modalTitle").innerText = isSignUp ? "Регистрация" : "Вход в ARTIX";
    document.getElementById("authBtn").innerText = isSignUp ? "Создать аккаунт" : "Войти";
    e.target.innerText = isSignUp ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Создать";
};

// Кнопка действия (Вход или Регистрация)
document.getElementById("authBtn").onclick = async () => {
    const email = document.getElementById("authEmail").value;
    const password = document.getElementById("authPassword").value;

    if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) alert(error.message);
        else alert("Проверь почту для подтверждения!");
    } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) alert(error.message);
        else authModal.style.display = "none";
    }
};

// Выход
logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
};

// Следим за состоянием пользователя
supabase.auth.onAuthStateChange((event, session) => {
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

// --- ЛОГИКА ЧАТА ---

async function onSend() {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = "";
    pushUser(text);

    const res = await fetch(`${SEARCH_API}?q=${encodeURIComponent(text)}&model=ARTIX-1`);
    const data = await res.json();

    if (data.ok && data.results.length > 0) {
        let reply = `Нашел информацию:\n\n`;
        data.results.forEach(r => reply += `🔹 **${r.title}**\n${r.text}\n\n`);
        pushBot(reply, data.results.map(r => ({name: r.source, url: r.url})));
    } else {
        pushBot("Ничего не нашлось. Попробуй другой запрос.");
    }
}

sendBtn.onclick = onSend;
inputEl.onkeydown = (e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } };

function pushUser(t) {
    const d = document.createElement("div"); d.className="msg user"; d.innerText=t;
    chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight;
}

function pushBot(t, src=[]) {
    const d = document.createElement("div"); d.className="msg bot";
    d.innerHTML = t.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
    if(src.length > 0) {
        const sDiv = document.createElement("div"); sDiv.className="sources"; sDiv.innerText="Источники: ";
        src.forEach(s => {
            const a = document.createElement("a"); a.href=s.url; a.target="_blank"; a.innerText=s.name + " ";
            sDiv.appendChild(a);
        });
        d.appendChild(sDiv);
    }
    chatEl.appendChild(d); chatEl.scrollTop = chatEl.scrollHeight;
}

document.getElementById("clearBtn").onclick = () => { chatEl.innerHTML = ""; pushBot("Чат очищен."); };
