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
const warningScreen = document.querySelector("#warningScreen");
const warningText = document.querySelector("#warningText");
const warningAction = document.querySelector("#warningAction");
const adminTab = document.querySelector("#adminTab");
const chatTab = document.querySelector("#chatTab");
const chatView = document.querySelector("#chatView");
const adminPanel = document.querySelector("#adminPanel");
const adminError = document.querySelector("#adminError");
let currentUser = null;
let csrfToken = "";
let messageCursor = 0;
let accountCreatedTimeout;
let pollingTimer;
let warningKind = null;

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
    error.accountDeleted = Boolean(data.account_deleted);
    error.deletedUsername = data.deleted_username || "";
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
  messageCursor = 0;
  warningKind = null;
  warningScreen.hidden = true;
  feed.replaceChildren();
  adminPanel.hidden = true;
  chatView.hidden = false;
  chatTab.classList.add("active");
  chatTab.setAttribute("aria-pressed", "true");
  adminTab.classList.remove("active");
  adminTab.setAttribute("aria-pressed", "false");
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
  messageCursor = 0;
  feed.replaceChildren();
  const isCricketAdmin = user.role === "admin" && user.username === "Cricket";
  adminTab.hidden = !isCricketAdmin;
  chatView.hidden = false;
  adminPanel.hidden = true;
  chatTab.classList.add("active");
  chatTab.setAttribute("aria-pressed", "true");
  adminTab.classList.remove("active");
  adminTab.setAttribute("aria-pressed", "false");
  loadMessages();
  clearInterval(pollingTimer);
  pollingTimer = setInterval(loadMessages, 2500);
  if (user.warning_count) {
    showWarning("message", `${user.warning_count === 1 ? "An admin deleted one of your messages" : `An admin deleted ${user.warning_count} of your messages`}. Deleted messages remain in the chat as [DELETED].`);
  }
  if (isCricketAdmin) loadAdminData();
}

function showWarning(kind, message) {
  if (warningKind === "account") return;
  if (warningKind === "message" && kind !== "account") return;
  warningKind = kind;
  document.querySelector("#warningTitle").textContent = kind === "account" ? "Account deleted" : "Message deleted";
  warningText.textContent = message;
  warningAction.textContent = kind === "account" ? "Return to sign in" : "I understand";
  warningScreen.hidden = false;
  warningAction.focus();
}

function addMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  article.dataset.messageId = message.id;
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
  const existing = feed.querySelector(`[data-message-id="${message.id}"]`);
  if (existing) existing.replaceWith(article);
  else feed.append(article);
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
    const data = await api(`/api/messages?after=${messageCursor}`);
    const messages = data.messages || [];
    const initialLoad = messageCursor === 0;
    if (initialLoad && !messages.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "It's quiet in here.";
      feed.replaceChildren(empty);
      messageCursor = data.cursor || 0;
      return;
    }
    for (const message of messages) {
      document.querySelector(".empty-state")?.remove();
      addMessage(message);
      if (!initialLoad && message.is_deleted && message.is_own) {
        showWarning("message", "An admin deleted one of your messages. Deleted messages remain in the chat as [DELETED].");
      }
    }
    messageCursor = data.cursor || messageCursor;
    if (data.warnings && warningKind === null) {
      showWarning("message", "An admin deleted one or more of your messages. Deleted messages remain in the chat as [DELETED].");
    }
    if (messages.length) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollToLatestMessage(initialLoad || reducedMotion ? "auto" : "smooth");
    }
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    }
  }
}

async function initialize() {
  authSubmit.disabled = true;
  try {
    const data = await api("/api/session");
    csrfToken = data.csrf_token;
    authSubmit.disabled = false;
    if (data.account_deleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (data.user) showRoom(data.user);
    else setAuthMode("create");
  } catch {
    authError.textContent = "Could not reach the chat server. Refresh to try again.";
    authError.hidden = false;
  }
}

function showAdminError(message) {
  adminError.textContent = message;
  adminError.hidden = !message;
}

function appendAdminEmpty(container, message) {
  const empty = document.createElement("p");
  empty.className = "admin-empty";
  empty.textContent = message;
  container.append(empty);
}

function formatAdminTime(value) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

async function loadAdminData() {
  if (currentUser?.role !== "admin" || currentUser.username !== "Cricket") return;
  showAdminError("");
  try {
    const [accountData, messageData] = await Promise.all([
      api("/api/admin/accounts"),
      api("/api/admin/messages"),
    ]);
    const accountList = document.querySelector("#adminAccounts");
    const messageList = document.querySelector("#adminMessages");
    accountList.replaceChildren();
    messageList.replaceChildren();

    if (!accountData.accounts.length) appendAdminEmpty(accountList, "No accounts.");
    for (const account of accountData.accounts) {
      const row = document.createElement("div");
      row.className = "admin-row";
      const copy = document.createElement("div");
      copy.className = "admin-row-copy";
      const title = document.createElement("div");
      title.className = "admin-row-title";
      title.textContent = account.username;
      const detail = document.createElement("div");
      detail.className = "admin-row-detail";
      detail.textContent = `${account.role === "admin" ? "Admin" : "Member"} · ${account.message_count} messages · joined ${formatAdminTime(account.created_at)}`;
      copy.append(title, detail);
      row.append(copy);
      if (account.username !== "Cricket" && account.role !== "admin") {
        const button = document.createElement("button");
        button.className = "admin-row-action";
        button.type = "button";
        button.textContent = "Delete account";
        button.addEventListener("click", async () => {
          if (!window.confirm(`Delete ${account.username} and mark all of their messages [DELETED]?`)) return;
          button.disabled = true;
          try {
            await api(`/api/admin/accounts/${account.id}`, { method: "DELETE" });
            await Promise.all([loadAdminData(), loadMessages()]);
          } catch (error) {
            showAdminError(error.message);
            button.disabled = false;
          }
        });
        row.append(button);
      }
      accountList.append(row);
    }

    if (!messageData.messages.length) appendAdminEmpty(messageList, "No messages.");
    for (const message of messageData.messages) {
      const row = document.createElement("div");
      row.className = "admin-row";
      const copy = document.createElement("div");
      copy.className = "admin-row-copy";
      const title = document.createElement("div");
      title.className = "admin-row-title";
      title.textContent = `${message.username} · ${formatAdminTime(message.created_at)}`;
      const detail = document.createElement("div");
      detail.className = "admin-row-detail";
      detail.textContent = message.body;
      copy.append(title, detail);
      row.append(copy);
      if (!message.is_deleted) {
        const button = document.createElement("button");
        button.className = "admin-row-action";
        button.type = "button";
        button.textContent = "Delete message";
        button.addEventListener("click", async () => {
          if (!window.confirm(`Delete this message by ${message.username}? The account will stay active.`)) return;
          button.disabled = true;
          try {
            await api(`/api/admin/messages/${message.id}`, { method: "DELETE" });
            await Promise.all([loadAdminData(), loadMessages()]);
          } catch (error) {
            showAdminError(error.message);
            button.disabled = false;
          }
        });
        row.append(button);
      }
      messageList.append(row);
    }
  } catch (error) {
    if (error.status === 401) showLogin();
    else showAdminError(error.message);
  }
}

function setRoomView(view) {
  if (view === "admin" && (currentUser?.role !== "admin" || currentUser.username !== "Cricket")) return;
  const showAdmin = view === "admin";
  chatView.hidden = showAdmin;
  adminPanel.hidden = !showAdmin;
  chatTab.classList.toggle("active", !showAdmin);
  chatTab.setAttribute("aria-pressed", String(!showAdmin));
  adminTab.classList.toggle("active", showAdmin);
  adminTab.setAttribute("aria-pressed", String(showAdmin));
  if (showAdmin) loadAdminData();
}

document.querySelector("#createMode").addEventListener("click", () => setAuthMode("create"));
document.querySelector("#signInMode").addEventListener("click", () => setAuthMode("signin"));
chatTab.addEventListener("click", () => setRoomView("chat"));
adminTab.addEventListener("click", () => setRoomView("admin"));
document.querySelector("#adminRefresh").addEventListener("click", loadAdminData);
warningAction.addEventListener("click", async () => {
  const kind = warningKind;
  if (kind === "account") {
    try {
      await api("/api/logout", { method: "POST", body: "{}" });
    } finally {
      showLogin();
      usernameInput.focus();
    }
    return;
  }
  try {
    await api("/api/warnings/acknowledge", { method: "POST", body: "{}" });
    currentUser.warning_count = 0;
    warningKind = null;
    warningScreen.hidden = true;
  } catch (error) {
    showWarning("account", error.message);
  }
});
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
    if (error.accountDeleted) {
      showWarning("account", "This account was deleted by an admin. Sign in with an active account.");
    } else {
      authError.textContent = error.message;
      authError.hidden = false;
    }
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
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    }
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