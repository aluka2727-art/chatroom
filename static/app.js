const accountForm = document.querySelector("#accountForm");
const usernameInput = document.querySelector("#usernameInput");
const passwordInput = document.querySelector("#passwordInput");
const confirmInput = document.querySelector("#confirmInput");
const authError = document.querySelector("#authError");
const loginScreen = document.querySelector("#loginScreen");
const room = document.querySelector("#room");
const feed = document.querySelector("#feed");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const accountCreatedNotice = document.querySelector("#accountCreatedNotice");
const authSubmit = document.querySelector("#authSubmit");
let currentUser = null;
let csrfToken = "";
let lastMessageId = 0;
let accountCreatedTimeout;
let pollingTimer;

async function api(path, options = {}, retryCsrf = true) {
  const method = (options.method || "GET").toUpperCase();
  if (method !== "GET" && !csrfToken) {
    const sessionData = await api("/api/session");
    csrfToken = sessionData.csrf_token;
  }
  const headers = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-Token"] = csrfToken;
  const response = await fetch(path, { ...options, headers, credentials: "same-origin", cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (response.status === 400 && method !== "GET" && retryCsrf && data.error === "The request expired. Refresh and try again.") {
    const sessionData = await api("/api/session");
    csrfToken = sessionData.csrf_token;
    return api(path, options, false);
  }
  if (!response.ok) {
    const error = new Error(data.error || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function setAuthMode(mode) {
  const signingIn = mode === "signin";
  accountForm.dataset.mode = mode;
  document.querySelector("#createMode").classList.toggle("active", !signingIn);
  document.querySelector("#createMode").setAttribute("aria-pressed", String(!signingIn));
  document.querySelector("#signInMode").classList.toggle("active", signingIn);
  document.querySelector("#signInMode").setAttribute("aria-pressed", String(signingIn));
  document.querySelector("#usernameGroup").hidden = !signingIn;
  document.querySelector("#confirmGroup").hidden = signingIn;
  usernameInput.required = signingIn;
  confirmInput.required = !signingIn;
  passwordInput.autocomplete = signingIn ? "current-password" : "new-password";
  document.querySelector("#loginCopy").textContent = signingIn
    ? "Sign in with your animal username and password."
    : "Create an account with a password. We’ll give you an animal name.";
  document.querySelector("#authSubmit").textContent = signingIn ? "Sign in" : "Create account";
  authError.hidden = true;
  accountForm.reset();
}

function showLogin() {
  clearInterval(pollingTimer);
  currentUser = null;
  lastMessageId = 0;
  feed.replaceChildren();
  room.hidden = true;
  loginScreen.hidden = false;
  setAuthMode("signin");
}

function showAccountCreated(username) {
  accountCreatedNotice.textContent = `Account Created, Your animal username is ${username}.`;
  accountCreatedNotice.hidden = false;
  clearTimeout(accountCreatedTimeout);
  accountCreatedTimeout = setTimeout(() => {
    accountCreatedNotice.hidden = true;
  }, 7000);
}

function showRoom(user) {
  currentUser = user;
  loginScreen.hidden = true;
  room.hidden = false;
  document.querySelector("#animalName").textContent = user.username;
  passwordInput.value = "";
  confirmInput.value = "";
  lastMessageId = 0;
  feed.replaceChildren();
  loadMessages();
  clearInterval(pollingTimer);
  pollingTimer = setInterval(loadMessages, 2500);
}

function addMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.classList.toggle("own", message.is_own && message.username !== "[DELETED]");
  avatar.classList.toggle("deleted", message.username === "[DELETED]");
  avatar.textContent = message.username === "[DELETED]" ? "?" : message.username[0];
  avatar.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const author = document.createElement("span");
  author.className = "message-author";
  author.classList.toggle("deleted", message.username === "[DELETED]");
  author.textContent = message.username;
  const time = document.createElement("time");
  time.className = "message-time";
  time.dateTime = message.created_at;
  time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = message.text;

  meta.append(author, time);
  content.append(meta, text);
  article.append(avatar, content);
  feed.append(article);
}

function scrollToLatestMessage(behavior = "smooth") {
  const scroll = () => {
    feed.scrollTop = feed.scrollHeight;
  };
  requestAnimationFrame(() => {
    scroll();
    requestAnimationFrame(scroll);
  });
  document.fonts?.ready.then(scroll);
}

async function loadMessages() {
  if (!currentUser) return;
  try {
    const data = await api(`/api/messages?after=${lastMessageId}`);
    const messages = data.messages || [];
    const initialLoad = lastMessageId === 0;
    if (initialLoad && !messages.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "It's quiet in here.";
      feed.replaceChildren(empty);
      return;
    }
    for (const message of messages) {
      document.querySelector(".empty-state")?.remove();
      addMessage(message);
      lastMessageId = Math.max(lastMessageId, message.id);
    }
    if (messages.length) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollToLatestMessage(initialLoad || reducedMotion ? "auto" : "smooth");
    }
  } catch (error) {
    if (error.status === 401) showLogin();
  }
}

async function initialize() {
  authSubmit.disabled = true;
  try {
    const data = await api("/api/session");
    csrfToken = data.csrf_token;
    authSubmit.disabled = false;
    if (data.user) showRoom(data.user);
    else setAuthMode("create");
  } catch {
    authError.textContent = "Could not reach the chat server. Refresh to try again.";
    authError.hidden = false;
  }
}

document.querySelector("#createMode").addEventListener("click", () => setAuthMode("create"));
document.querySelector("#signInMode").addEventListener("click", () => setAuthMode("signin"));
accountForm.addEventListener("submit", async event => {
  event.preventDefault();
  authError.hidden = true;
  authSubmit.disabled = true;
  try {
    const mode = accountForm.dataset.mode;
    const data = await api("/api/auth", {
      method: "POST",
      body: JSON.stringify({
        mode,
        username: usernameInput.value.trim(),
        password: passwordInput.value,
        confirm_password: confirmInput.value,
      }),
    });
    csrfToken = data.csrf_token;
    showRoom(data.user);
    if (mode === "create") showAccountCreated(data.user.username);
  } catch (error) {
    authError.textContent = error.message;
    authError.hidden = false;
  } finally {
    authSubmit.disabled = false;
  }
});

document.querySelector("#switchAccount").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
    showLogin();
    usernameInput.focus();
  } catch (error) {
    if (error.status === 401) showLogin();
  }
});

messageInput.addEventListener("input", () => {
  sendButton.disabled = !messageInput.value.trim();
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 110)}px`;
});
document.querySelector("#messageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sendButton.disabled) return;
  sendButton.disabled = true;
  try {
    await api("/api/messages", { method: "POST", body: JSON.stringify({ text }) });
    messageInput.value = "";
    messageInput.style.height = "34px";
    await loadMessages();
    scrollToLatestMessage();
  } catch (error) {
    if (error.status === 401) showLogin();
  } finally {
    sendButton.disabled = !messageInput.value.trim();
  }
});
messageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!sendButton.disabled) document.querySelector("#messageForm").requestSubmit();
  }
});
document.querySelector("#emojiButton").addEventListener("click", () => {
  messageInput.value += " ☺";
  messageInput.dispatchEvent(new Event("input"));
  messageInput.focus();
});

initialize();