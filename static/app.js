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
const replyPreview = document.querySelector("#replyPreview");
const replyPreviewText = document.querySelector("#replyPreviewText");
const messageError = document.querySelector("#messageError");
const accountCreatedNotice = document.querySelector("#accountCreatedNotice");
const authSubmit = document.querySelector("#authSubmit");
const warningScreen = document.querySelector("#warningScreen");
const warningText = document.querySelector("#warningText");
const warningAction = document.querySelector("#warningAction");
const adminTab = document.querySelector("#adminTab");
const chatTab = document.querySelector("#chatTab");
const dmTab = document.querySelector("#dmTab");
const chatView = document.querySelector("#chatView");
const adminPanel = document.querySelector("#adminPanel");
const adminError = document.querySelector("#adminError");
const dmPanel = document.querySelector("#dmPanel");
const dmError = document.querySelector("#dmError");
const dmContacts = document.querySelector("#dmContacts");
const dmFeed = document.querySelector("#dmFeed");
const dmMessageInput = document.querySelector("#dmMessageInput");
const dmSendButton = document.querySelector("#dmSendButton");
const dmReplyPreview = document.querySelector("#dmReplyPreview");
const dmReplyPreviewText = document.querySelector("#dmReplyPreviewText");
const pushToggle = document.querySelector("#pushToggle");
let currentUser = null;
let csrfToken = "";
let messageCursor = 0;
let replyingTo = null;
let replyingToDm = null;
let selectedDmUser = null;
let dmMessageCursor = 0;
let dmContactsSnapshot = "";
let activeView = "chat";
let accountCreatedTimeout;
let pollingTimer;
let warningKind = null;
let pendingDmPartnerId = null;

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
  clearReply();
  messageError.hidden = true;
  warningScreen.hidden = true;
  feed.replaceChildren();
  dmFeed.replaceChildren();
  dmContacts.replaceChildren();
  selectedDmUser = null;
  dmMessageCursor = 0;
  dmContactsSnapshot = "";
  dmMessageInput.value = "";
  clearDmReply();
  dmMessageInput.disabled = true;
  dmMessageInput.style.height = "34px";
  dmMessageInput.placeholder = "Choose someone to message...";
  dmSendButton.disabled = true;
  pendingDmPartnerId = null;
  resetPushToggle();
  activeView = "chat";
  adminPanel.hidden = true;
  dmPanel.hidden = true;
  chatView.hidden = false;
  chatTab.classList.add("active");
  chatTab.setAttribute("aria-pressed", "true");
  dmTab.classList.remove("active");
  dmTab.setAttribute("aria-pressed", "false");
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
  clearReply();
  messageError.hidden = true;
  feed.replaceChildren();
  dmFeed.replaceChildren();
  dmContacts.replaceChildren();
  selectedDmUser = null;
  dmMessageCursor = 0;
  dmContactsSnapshot = "";
  dmMessageInput.value = "";
  clearDmReply();
  dmMessageInput.disabled = true;
  dmMessageInput.style.height = "34px";
  dmMessageInput.placeholder = "Choose someone to message...";
  dmSendButton.disabled = true;
  activeView = "chat";
  const isAdmin = user.role === "admin";
  adminTab.hidden = !isAdmin;
  chatView.hidden = false;
  dmPanel.hidden = true;
  adminPanel.hidden = true;
  chatTab.classList.add("active");
  chatTab.setAttribute("aria-pressed", "true");
  dmTab.classList.remove("active");
  dmTab.setAttribute("aria-pressed", "false");
  adminTab.classList.remove("active");
  adminTab.setAttribute("aria-pressed", "false");
  loadMessages();
  clearInterval(pollingTimer);
  pollingTimer = setInterval(() => {
    loadMessages();
    if (activeView === "dms") {
      loadDmContacts();
      loadDmMessages();
    }
  }, 2500);
  if (user.warning_count) {
    showWarning("message", `${user.warning_count === 1 ? "An admin deleted one of your messages" : `An admin deleted ${user.warning_count} of your messages`}. Deleted messages remain in the chat as [DELETED].`);
  }
  if (isAdmin) loadAdminData();
  pendingDmPartnerId = readDmDeepLink();
  refreshPushToggle();
  if (pendingDmPartnerId) setRoomView("dms");
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

  if (message.reply_to) {
    content.append(createReplyQuote(message.reply_to));
  }

  meta.append(author, time);
  content.append(meta, text);
  if (!message.is_deleted && message.username !== "[DELETED]") {
    const replyButton = document.createElement("button");
    replyButton.className = "message-reply";
    replyButton.type = "button";
    replyButton.textContent = "Reply";
    replyButton.setAttribute("aria-label", `Reply to ${message.username}'s message`);
    replyButton.addEventListener("click", () => selectReply(message));
    meta.append(replyButton);
  }
  article.append(avatar, content);
  const existing = feed.querySelector(`[data-message-id="${message.id}"]`);
  if (existing) existing.replaceWith(article);
  else feed.append(article);
}

function createReplyQuote(replyTo) {
  const quote = document.createElement("blockquote");
  quote.className = "reply-quote";
  const quoteAuthor = document.createElement("cite");
  quoteAuthor.textContent = replyTo.username;
  const quoteText = document.createElement("span");
  quoteText.textContent = replyTo.text;
  quote.append(quoteAuthor, quoteText);
  return quote;
}

function selectReply(message) {
  replyingTo = {
    id: message.id,
    username: message.username,
    text: message.text,
  };
  replyPreviewText.textContent = `${replyingTo.username}: ${replyingTo.text}`;
  replyPreview.hidden = false;
  messageError.hidden = true;
  messageInput.focus();
}

function clearReply() {
  replyingTo = null;
  replyPreview.hidden = true;
  replyPreviewText.textContent = "";
}

function selectDmReply(message) {
  replyingToDm = {
    id: message.id,
    username: message.username,
    text: message.text,
  };
  dmReplyPreviewText.textContent = `${replyingToDm.username}: ${replyingToDm.text}`;
  dmReplyPreview.hidden = false;
  dmMessageInput.focus();
}

function clearDmReply() {
  replyingToDm = null;
  dmReplyPreview.hidden = true;
  dmReplyPreviewText.textContent = "";
}

function scrollToLatestMessage(behavior = "smooth", targetFeed = feed) {
  const scroll = () => {
    targetFeed.scrollTop = targetFeed.scrollHeight;
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

function showDmError(message) {
  dmError.textContent = message;
  dmError.hidden = !message;
}

function renderDmContacts(contacts) {
  dmContacts.replaceChildren();
  if (!contacts.length) {
    const empty = document.createElement("p");
    empty.className = "dm-contact-empty";
    empty.textContent = "There are no other room members yet.";
    dmContacts.append(empty);
    return;
  }
  for (const contact of contacts) {
    const button = document.createElement("button");
    button.className = "dm-contact";
    button.type = "button";
    button.classList.toggle("active", selectedDmUser?.id === contact.id);
    button.setAttribute("aria-pressed", String(selectedDmUser?.id === contact.id));
    const name = document.createElement("span");
    name.className = "dm-contact-name";
    name.textContent = contact.username;
    const preview = document.createElement("span");
    preview.className = "dm-contact-preview";
    preview.textContent = contact.last_message || "Start a conversation";
    button.append(name, preview);
    button.addEventListener("click", () => selectDmContact(contact));
    dmContacts.append(button);
  }
}

async function loadDmContacts() {
  if (!currentUser) return;
  try {
    const data = await api("/api/dms");
    const contacts = data.contacts || [];
    const snapshot = JSON.stringify(contacts);
    const pendingId = pendingDmPartnerId;
    if (snapshot === dmContactsSnapshot && !pendingId) return;
    dmContactsSnapshot = snapshot;
    if (pendingId) {
      pendingDmPartnerId = null;
      clearDmDeepLink();
      const contact = contacts.find(item => item.id === pendingId);
      if (contact) {
        selectDmContact(contact);
        return;
      }
    }
    if (selectedDmUser) {
      selectedDmUser = contacts.find(contact => contact.id === selectedDmUser.id) || null;
      if (!selectedDmUser) {
        dmMessageCursor = 0;
        dmFeed.replaceChildren();
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Your private conversations will appear here.";
        dmFeed.append(empty);
        document.querySelector("#dmConversationTitle").textContent = "Choose someone to message";
        document.querySelector("#dmConversationSubtitle").textContent = "Select a room member to start a private conversation.";
        dmMessageInput.value = "";
        dmMessageInput.disabled = true;
        dmMessageInput.style.height = "34px";
        dmMessageInput.placeholder = "Choose someone to message...";
        dmSendButton.disabled = true;
      }
    }
    renderDmContacts(contacts);
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      showDmError(error.message);
    }
  }
}

function selectDmContact(contact) {
  selectedDmUser = contact;
  dmMessageCursor = 0;
  clearDmReply();
  dmFeed.replaceChildren();
  dmMessageInput.value = "";
  dmMessageInput.style.height = "34px";
  dmMessageInput.disabled = false;
  dmMessageInput.placeholder = `Message ${contact.username}...`;
  dmSendButton.disabled = true;
  document.querySelector("#dmConversationTitle").textContent = contact.username;
  document.querySelector("#dmConversationSubtitle").textContent = "Private conversation";
  renderDmContacts(JSON.parse(dmContactsSnapshot || "[]"));
  showDmError("");
  loadDmMessages();
}

function addDmMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  article.dataset.messageId = message.id;
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.classList.toggle("own", message.is_own);
  avatar.textContent = message.username[0];
  avatar.setAttribute("aria-hidden", "true");

  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const author = document.createElement("span");
  author.className = "message-author";
  author.textContent = message.username;
  const time = document.createElement("time");
  time.className = "message-time";
  time.dateTime = message.created_at;
  time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const text = document.createElement("p");
  text.className = "message-text";
  text.textContent = message.text;
  if (message.reply_to) content.append(createReplyQuote(message.reply_to));
  meta.append(author, time);
  if (message.reply_to !== undefined && message.username) {
    const replyButton = document.createElement("button");
    replyButton.className = "message-reply";
    replyButton.type = "button";
    replyButton.textContent = "Reply";
    replyButton.setAttribute("aria-label", `Reply to ${message.username}'s message`);
    replyButton.addEventListener("click", () => selectDmReply(message));
    meta.append(replyButton);
  }
  content.append(meta, text);
  article.append(avatar, content);
  const existing = dmFeed.querySelector(`[data-message-id="${message.id}"]`);
  if (existing) existing.replaceWith(article);
  else dmFeed.append(article);
}

async function loadDmMessages() {
  if (!currentUser || !selectedDmUser) return;
  const accountId = selectedDmUser.id;
  try {
    const data = await api(`/api/dms/${accountId}?after=${dmMessageCursor}`);
    if (selectedDmUser?.id !== accountId) return;
    const messages = data.messages || [];
    const initialLoad = dmMessageCursor === 0;
    if (initialLoad && !messages.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No messages yet. Say hello!";
      dmFeed.replaceChildren(empty);
    }
    for (const message of messages) {
      dmFeed.querySelector(".empty-state")?.remove();
      addDmMessage(message);
    }
    dmMessageCursor = Math.max(dmMessageCursor, data.cursor || 0);
    if (messages.length) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollToLatestMessage(initialLoad || reducedMotion ? "auto" : "smooth", dmFeed);
    }
    showDmError("");
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      showDmError(error.message);
    }
  }
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
  if (currentUser?.role !== "admin") return;
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

function readDmDeepLink() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") !== "dms") return null;
  const partnerId = Number(params.get("with"));
  return Number.isInteger(partnerId) && partnerId > 0 ? partnerId : null;
}

function clearDmDeepLink() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("view") && !url.searchParams.has("with")) return;
  url.searchParams.delete("view");
  url.searchParams.delete("with");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function resetPushToggle() {
  pushToggle.disabled = true;
  pushToggle.setAttribute("aria-pressed", "false");
  pushToggle.textContent = "Enable notifications";
  delete pushToggle.dataset.publicKey;
}

function setPushToggle(state) {
  const labels = {
    unavailable: "Notifications unavailable",
    blocked: "Notifications blocked",
    off: "Enable notifications",
    on: "Notifications on",
  };
  pushToggle.disabled = state !== "on" && state !== "off";
  pushToggle.setAttribute("aria-pressed", String(state === "on"));
  pushToggle.textContent = labels[state];
}

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) output[index] = raw.charCodeAt(index);
  return output;
}

async function refreshPushToggle() {
  if (!currentUser || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    setPushToggle("unavailable");
    return;
  }
  if (Notification.permission === "denied") {
    setPushToggle("blocked");
    return;
  }
  try {
    const config = await api("/api/push/config");
    if (!config.enabled || !config.public_key) {
      setPushToggle("unavailable");
      return;
    }
    pushToggle.dataset.publicKey = config.public_key;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription();
    setPushToggle(subscription ? "on" : "off");
  } catch {
    setPushToggle("unavailable");
  }
}

async function disablePushSubscription() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  try {
    await api("/api/push/subscriptions", {
      method: "DELETE",
      body: JSON.stringify({ endpoint }),
    });
  } catch {
    // Still remove the browser subscription so the next account on this device does not inherit it.
  }
  await subscription.unsubscribe();
}

async function togglePushNotifications() {
  if (!currentUser || pushToggle.disabled) return;
  pushToggle.disabled = true;
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const existing = await registration.pushManager.getSubscription();
    if (existing) {
      const endpoint = existing.endpoint;
      await existing.unsubscribe();
      await api("/api/push/subscriptions", {
        method: "DELETE",
        body: JSON.stringify({ endpoint }),
      });
      setPushToggle("off");
      showDmError("");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setPushToggle(permission === "denied" ? "blocked" : "off");
      if (permission === "denied") showDmError("Notification permission was denied.");
      return;
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(pushToggle.dataset.publicKey),
    });
    await api("/api/push/subscriptions", {
      method: "POST",
      body: JSON.stringify(subscription.toJSON()),
    });
    setPushToggle("on");
    showDmError("");
  } catch (error) {
    showDmError(error.message || "Could not update notifications.");
    await refreshPushToggle();
  }
}

function setRoomView(view) {
  if (view === "admin" && currentUser?.role !== "admin") return;
  activeView = view;
  const showChat = view === "chat";
  const showDms = view === "dms";
  const showAdmin = view === "admin";
  chatView.hidden = !showChat;
  dmPanel.hidden = !showDms;
  adminPanel.hidden = !showAdmin;
  chatTab.classList.toggle("active", showChat);
  chatTab.setAttribute("aria-pressed", String(showChat));
  dmTab.classList.toggle("active", showDms);
  dmTab.setAttribute("aria-pressed", String(showDms));
  adminTab.classList.toggle("active", showAdmin);
  adminTab.setAttribute("aria-pressed", String(showAdmin));
  if (showDms) {
    showDmError("");
    loadDmContacts();
    loadDmMessages();
  }
  if (showAdmin) loadAdminData();
}

document.querySelector("#createMode").addEventListener("click", () => setAuthMode("create"));
document.querySelector("#signInMode").addEventListener("click", () => setAuthMode("signin"));
chatTab.addEventListener("click", () => setRoomView("chat"));
dmTab.addEventListener("click", () => setRoomView("dms"));
adminTab.addEventListener("click", () => setRoomView("admin"));
document.querySelector("#adminRefresh").addEventListener("click", loadAdminData);
document.querySelector("#dmRefresh").addEventListener("click", () => {
  dmContactsSnapshot = "";
  loadDmContacts();
  loadDmMessages();
});
warningAction.addEventListener("click", async () => {
  const kind = warningKind;
  if (kind === "account") {
    try {
      await disablePushSubscription();
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
    await disablePushSubscription();
    await api("/api/logout", { method: "POST", body: "{}" });
    showLogin();
    usernameInput.focus();
  } catch (error) {
    if (error.status === 401) showLogin();
  }
});
pushToggle.addEventListener("click", togglePushNotifications);
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", event => {
    if (event.data?.type !== "open-dm" || !currentUser) return;
    const target = new URL(event.data.url, window.location.origin);
    const partnerId = Number(target.searchParams.get("with"));
    if (target.searchParams.get("view") !== "dms" || !Number.isInteger(partnerId) || partnerId < 1) return;
    pendingDmPartnerId = partnerId;
    setRoomView("dms");
  });
}

messageInput.addEventListener("input", () => {
  sendButton.disabled = !messageInput.value.trim();
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 110)}px`;
  messageError.hidden = true;
});
document.querySelector("#cancelReply").addEventListener("click", clearReply);
document.querySelector("#cancelDmReply").addEventListener("click", clearDmReply);
document.querySelector("#messageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sendButton.disabled) return;
  sendButton.disabled = true;
  try {
    const payload = { text };
    if (replyingTo) payload.reply_to_id = replyingTo.id;
    await api("/api/messages", { method: "POST", body: JSON.stringify(payload) });
    messageInput.value = "";
    messageInput.style.height = "34px";
    clearReply();
    messageError.hidden = true;
    await loadMessages();
    scrollToLatestMessage();
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      messageError.textContent = error.message;
      messageError.hidden = false;
    }
  } finally {
    sendButton.disabled = !messageInput.value.trim();
  }
});
dmMessageInput.addEventListener("input", () => {
  dmSendButton.disabled = !selectedDmUser || !dmMessageInput.value.trim();
  dmMessageInput.style.height = "auto";
  dmMessageInput.style.height = `${Math.min(dmMessageInput.scrollHeight, 110)}px`;
});
document.querySelector("#dmMessageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const text = dmMessageInput.value.trim();
  if (!text || !selectedDmUser || dmSendButton.disabled) return;
  dmSendButton.disabled = true;
  try {
    const payload = { text };
    if (replyingToDm) payload.reply_to_id = replyingToDm.id;
    await api(`/api/dms/${selectedDmUser.id}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    dmMessageInput.value = "";
    dmMessageInput.style.height = "34px";
    clearDmReply();
    dmContactsSnapshot = "";
    await Promise.all([loadDmMessages(), loadDmContacts()]);
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      showDmError(error.message);
    }
  } finally {
    dmSendButton.disabled = !selectedDmUser || !dmMessageInput.value.trim();
  }
});
dmMessageInput.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!dmSendButton.disabled) document.querySelector("#dmMessageForm").requestSubmit();
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