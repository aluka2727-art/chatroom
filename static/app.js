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
const versionNotesScreen = document.querySelector("#versionNotesScreen");
const APP_VERSION = "1.11.2";
const VERSION_NOTES_STORAGE_KEY = "pigin-seen-version";
const VERSION_NOTES = {
  "1.11.2": [
    "Chat should feel snappier with less lag when several people are online.",
    "Casual swearing is allowed; sexual insults, slurs, and disrespect are still blocked.",
  ],
  "1.11.1": [
    "Animal usernames stay private in search once you set a display name.",
    "Profile photos resize automatically so larger uploads can be saved.",
    "Reading messages on one device clears notifications and badges on your other devices.",
  ],
  "1.11.0": [
    "Set a custom display name and profile photo in Settings — they show in DMs only.",
    "World Chat stays anonymous with your animal username.",
    "DMs only list people you’ve already texted; search a username to start a new chat.",
    "Sign in with either your animal username or your display name.",
    "Searchable emoji picker in chat and DMs.",
    "Stronger free message filtering for swearing, insults, and common evasions.",
  ],
};
const warningText = document.querySelector("#warningText");
const warningAction = document.querySelector("#warningAction");
const adminTab = document.querySelector("#adminTab");
const chatTab = document.querySelector("#chatTab");
const dmTab = document.querySelector("#dmTab");
const settingsTab = document.querySelector("#settingsTab");
const menuButton = document.querySelector("#menuButton");
const menuBackdrop = document.querySelector("#menuBackdrop");
const sideTabs = document.querySelector("#sideTabs");
const compactMenu = window.matchMedia("(max-width: 900px)");
const chatView = document.querySelector("#chatView");
const adminPanel = document.querySelector("#adminPanel");
const settingsPanel = document.querySelector("#settingsPanel");
const adminError = document.querySelector("#adminError");
const dmPanel = document.querySelector("#dmPanel");
const dmSidebar = document.querySelector("#dmSidebar");
const dmConversation = document.querySelector("#dmConversation");
const dmBackButton = document.querySelector("#dmBackButton");
const dmError = document.querySelector("#dmError");
const dmContacts = document.querySelector("#dmContacts");
const dmFeed = document.querySelector("#dmFeed");
const dmMessageInput = document.querySelector("#dmMessageInput");
const dmSendButton = document.querySelector("#dmSendButton");
const dmMessageError = document.querySelector("#dmMessageError");
const dmReplyPreview = document.querySelector("#dmReplyPreview");
const dmReplyPreviewText = document.querySelector("#dmReplyPreviewText");
const pushToggle = document.querySelector("#pushToggle");
const pushHintText = document.querySelector("#pushHintText");
const themeToggle = document.querySelector("#themeToggle");
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
let messagesLoading = false;
let dmContactsLoading = false;
let dmMessagesLoading = false;
let presenceLastSentAt = 0;
const POLL_VISIBLE_MS = 4000;
const POLL_HIDDEN_MS = 15000;
const PRESENCE_MIN_INTERVAL_MS = 8000;
let warningKind = null;
let pendingDmPartnerId = null;
let pushHint = "";
let pushEndpoint = "";
let enablingPush = false;
let presenceClientMemory = "";
let readSyncEpoch = 0;
let displayedBadgeCount = null;
let unreadState = { group: 0, dms: 0, total: 0, conversations: {} };

function presenceClientId() {
  if (presenceClientMemory) return presenceClientMemory;
  const key = "pigin-presence-client";
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    const id = Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    presenceClientMemory = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    return presenceClientMemory;
  }
}

function updateDmUnreadDots() {
  for (const button of dmContacts.querySelectorAll(".dm-contact")) {
    const count = unreadState.conversations[button.dataset.accountId] || 0;
    button.classList.toggle("has-unread", count > 0);
    const name = button.querySelector(".dm-contact-name")?.textContent || "Conversation";
    if (count > 0) button.setAttribute("aria-label", `${name}, ${count} unread`);
    else button.removeAttribute("aria-label");
  }
}

function applyUnread(summary) {
  const conversations = { ...(summary?.conversations || {}) };
  let group = summary?.group || 0;
  let direct = summary?.dms || 0;
  if (document.visibilityState === "visible" && activeView === "chat") group = 0;
  if (document.visibilityState === "visible" && activeView === "dms" && selectedDmUser) {
    const key = String(selectedDmUser.id);
    direct -= conversations[key] || 0;
    delete conversations[key];
  }
  group = Math.max(0, group);
  direct = Math.max(0, direct);
  unreadState = { group, dms: direct, total: group + direct, conversations };
  chatTab.classList.toggle("has-unread", group > 0);
  dmTab.classList.toggle("has-unread", direct > 0);
  chatTab.setAttribute("aria-label", group > 0 ? `Chat, ${group} unread` : "Chat");
  dmTab.setAttribute("aria-label", direct > 0 ? `Direct messages, ${direct} unread` : "Direct messages");
  updateMenuButton();
  updateDmUnreadDots();
  updateAppBadge(unreadState.total);
}

function updateFaviconBadge(count) {
  const links = [...document.querySelectorAll("link[rel='icon']")];
  for (const link of links) {
    if (!link.dataset.baseHref) link.dataset.baseHref = link.getAttribute("href");
  }
  if (!count) {
    for (const link of links) link.setAttribute("href", link.dataset.baseHref);
    return;
  }
  const source = links.find(link => link.dataset.baseHref?.includes("favicon-32")) || links[0];
  if (!source?.dataset.baseHref) return;
  const image = new Image();
  image.onload = () => {
    if (displayedBadgeCount !== count) return;
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, 32, 32);
    context.beginPath();
    context.fillStyle = "#d23b2f";
    context.arc(23, 9, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = "#fff";
    context.font = "700 12px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(count > 9 ? "9+" : String(count), 23, 9.5);
    const url = canvas.toDataURL("image/png");
    for (const link of links) link.setAttribute("href", url);
  };
  image.src = source.dataset.baseHref;
}

function updateAppBadge(total) {
  const count = Math.max(0, Number(total) || 0);
  const badge = count > 0 && navigator.setAppBadge
    ? navigator.setAppBadge(count)
    : navigator.clearAppBadge?.();
  Promise.resolve(badge).catch(() => {});
  if (displayedBadgeCount === count) return;
  displayedBadgeCount = count;
  updateFaviconBadge(count);
}

async function syncReadState(fallback, force = false) {
  const epoch = ++readSyncEpoch;
  const viewingChat = document.visibilityState === "visible" && activeView === "chat";
  const viewingDm = document.visibilityState === "visible" && activeView === "dms" && selectedDmUser;
  try {
    let summary = fallback;
    let markedRead = false;
    if (viewingChat && (force || (fallback?.group || 0) > 0)) {
      summary = await api("/api/reads", { method: "POST", body: JSON.stringify({ kind: "chat" }) });
      markedRead = true;
    } else if (
      viewingDm
      && (force || (fallback?.conversations?.[String(selectedDmUser.id)] || 0) > 0)
    ) {
      summary = await api("/api/reads", {
        method: "POST",
        body: JSON.stringify({ kind: "dm", partner_id: selectedDmUser.id }),
      });
      markedRead = true;
    }
    if (epoch !== readSyncEpoch || !summary) return;
    applyUnread(summary);
    if (markedRead) closeAppNotifications();
  } catch (error) {
    if (epoch === readSyncEpoch && error.status === 401) showLogin();
  }
}

async function reportPresence(visible) {
  if (!currentUser || !pushEndpoint) return;
  try {
    await api("/api/push/presence", {
      method: "POST",
      body: JSON.stringify({
        endpoint: pushEndpoint,
        client_id: presenceClientId(),
        visible: Boolean(visible),
        reported_at: Date.now(),
      }),
    });
  } catch (error) {
    if (error.status === 401) showLogin();
  }
}

async function closeAppNotifications() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const notifications = await registration?.getNotifications?.() || [];
  for (const notification of notifications) notification.close();
}

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
    ? "Sign in with your animal username or display name, and password."
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
  versionNotesScreen.hidden = true;
  feed.replaceChildren();
  dmFeed.replaceChildren();
  dmContacts.replaceChildren();
  dmContactsSnapshot = "";
  resetDmConversationPane();
  pendingDmPartnerId = null;
  pushEndpoint = "";
  resetPushToggle();
  setMenuOpen(false);
  applyUnread({ group: 0, dms: 0, total: 0, conversations: {} });
  activeView = "chat";
  adminPanel.hidden = true;
  settingsPanel.hidden = true;
  dmPanel.hidden = true;
  chatView.hidden = false;
  chatTab.classList.add("active");
  chatTab.setAttribute("aria-pressed", "true");
  dmTab.classList.remove("active");
  dmTab.setAttribute("aria-pressed", "false");
  settingsTab.classList.remove("active");
  settingsTab.setAttribute("aria-pressed", "false");
  adminTab.classList.remove("active");
  adminTab.setAttribute("aria-pressed", "false");
  room.hidden = true;
  loginScreen.hidden = false;
  setAuthMode("signin");
}

function showAccountCreated(username) {
  accountCreatedNotice.textContent = `Account created. Your animal username is ${username}. Set a display name anytime in Settings.`;
  accountCreatedNotice.hidden = false;
  clearTimeout(accountCreatedTimeout);
  accountCreatedTimeout = setTimeout(() => {
    accountCreatedNotice.hidden = true;
  }, 7000);
}

function publicNameFor(person) {
  return person.public_name || person.display_name || person.username || "";
}

function fillAvatarElement(element, person, { own = false, deleted = false } = {}) {
  const name = publicNameFor(person);
  element.classList.toggle("own", own && !deleted);
  element.classList.toggle("deleted", deleted);
  element.classList.toggle("has-image", Boolean(person.avatar_url) && !deleted);
  element.replaceChildren();
  if (person.avatar_url && !deleted) {
    const image = document.createElement("img");
    image.src = person.avatar_url;
    image.alt = "";
    element.append(image);
  } else {
    element.textContent = deleted || !name ? "?" : name[0].toUpperCase();
  }
}

function showProfileError(message) {
  const profileError = document.querySelector("#profileError");
  profileError.textContent = message || "";
  profileError.hidden = !message;
}

const AVATAR_MAX_BYTES = 256 * 1024;
const AVATAR_MAX_EDGE = 512;

function bustAvatarUrl(url) {
  if (!url) return null;
  const base = url.split("?")[0];
  return `${base}?v=${Date.now()}`;
}

async function prepareAvatarUpload(file) {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Use a JPEG, PNG, or WebP image.");
  }
  if (file.size <= AVATAR_MAX_BYTES && file.type !== "image/heic" && file.type !== "image/heif") {
    return file;
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Could not read that image. Try a JPEG, PNG, or WebP under 256 KB.");
  }
  const scale = Math.min(1, AVATAR_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close?.();
    throw new Error("Could not prepare that photo.");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  for (const quality of [0.86, 0.72, 0.58, 0.44, 0.32]) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= AVATAR_MAX_BYTES) {
      return new File([blob], "avatar.jpg", { type: "image/jpeg", lastModified: Date.now() });
    }
  }
  throw new Error("That photo is still too large after resizing. Try a smaller image.");
}

async function uploadAvatarFile(file, retryCsrf = true) {
  if (!csrfToken) {
    const sessionData = await api("/api/session");
    csrfToken = sessionData.csrf_token;
  }
  const body = new FormData();
  body.append("avatar", file);
  const response = await fetch("/api/profile/avatar", {
    method: "POST",
    headers: { Accept: "application/json", "X-CSRF-Token": csrfToken },
    body,
    credentials: "same-origin",
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (
    response.status === 400
    && retryCsrf
    && data.error === "The request expired. Refresh and try again."
  ) {
    const sessionData = await api("/api/session");
    csrfToken = sessionData.csrf_token;
    return uploadAvatarFile(file, false);
  }
  if (!response.ok) {
    const error = new Error(data.error || "Could not upload that photo.");
    error.status = response.status;
    throw error;
  }
  if (data.csrf_token) csrfToken = data.csrf_token;
  if (data.user?.avatar_url) data.user.avatar_url = bustAvatarUrl(data.user.avatar_url);
  return data;
}

function refreshProfileSettings() {
  if (!currentUser) return;
  const settingsAvatar = document.querySelector("#settingsAvatar");
  const displayNameInput = document.querySelector("#displayNameInput");
  const removeAvatarButton = document.querySelector("#removeAvatarButton");
  document.querySelector("#settingsAnimalName").textContent = currentUser.username;
  displayNameInput.value = currentUser.display_name || "";
  fillAvatarElement(settingsAvatar, currentUser);
  removeAvatarButton.hidden = !currentUser.avatar_url;
  showProfileError("");
}

function applyCurrentUser(user) {
  currentUser = user;
  document.querySelector("#animalName").textContent = publicNameFor(user);
  refreshProfileSettings();
}

function showRoom(user) {
  applyCurrentUser(user);
  loginScreen.hidden = true;
  room.hidden = false;
  passwordInput.value = "";
  confirmInput.value = "";
  messageCursor = 0;
  clearReply();
  messageError.hidden = true;
  feed.replaceChildren();
  dmFeed.replaceChildren();
  dmContacts.replaceChildren();
  dmContactsSnapshot = "";
  resetDmConversationPane();
  activeView = "chat";
  const isAdmin = user.role === "admin";
  adminTab.hidden = !isAdmin;
  chatView.hidden = false;
  dmPanel.hidden = true;
  settingsPanel.hidden = true;
  adminPanel.hidden = true;
  chatTab.classList.add("active");
  chatTab.setAttribute("aria-pressed", "true");
  dmTab.classList.remove("active");
  dmTab.setAttribute("aria-pressed", "false");
  settingsTab.classList.remove("active");
  settingsTab.setAttribute("aria-pressed", "false");
  adminTab.classList.remove("active");
  adminTab.setAttribute("aria-pressed", "false");
  updateRoomTitle("chat");
  startPolling();
  if (user.warning_count) {
    showWarning("message", `${user.warning_count === 1 ? "An admin deleted one of your messages" : `An admin deleted ${user.warning_count} of your messages`}. Deleted messages remain in the chat as [DELETED].`);
  } else {
    maybeShowVersionNotes();
  }
  if (isAdmin) loadAdminData();
  pendingDmPartnerId = readDmDeepLink();
  refreshPushToggle();
  if (pendingDmPartnerId) setRoomView("dms");
  applyRememberedShare();
}

function showWarning(kind, message) {
  if (warningKind === "account") return;
  if (warningKind === "message" && kind !== "account") return;
  warningKind = kind;
  versionNotesScreen.hidden = true;
  document.querySelector("#warningTitle").textContent = kind === "account" ? "Account deleted" : "Message deleted";
  warningText.textContent = message;
  warningAction.textContent = kind === "account" ? "Return to sign in" : "I understand";
  warningScreen.hidden = false;
  warningAction.focus();
}

function hasSeenCurrentVersionNotes() {
  try {
    return localStorage.getItem(VERSION_NOTES_STORAGE_KEY) === APP_VERSION;
  } catch (error) {
    return true;
  }
}

function markCurrentVersionNotesSeen() {
  try {
    localStorage.setItem(VERSION_NOTES_STORAGE_KEY, APP_VERSION);
  } catch (error) {}
}

function maybeShowVersionNotes() {
  if (!currentUser || !warningScreen.hidden || warningKind) return;
  if (hasSeenCurrentVersionNotes()) return;
  const notes = VERSION_NOTES[APP_VERSION] || [];
  if (!notes.length) {
    markCurrentVersionNotesSeen();
    return;
  }
  document.querySelector("#versionNotesTitle").textContent = `What's new in v${APP_VERSION}`;
  const list = document.querySelector("#versionNotesList");
  list.replaceChildren();
  for (const note of notes) {
    const item = document.createElement("li");
    item.textContent = note;
    list.append(item);
  }
  versionNotesScreen.hidden = false;
  document.querySelector("#versionNotesAction").focus();
}

function dismissVersionNotes() {
  markCurrentVersionNotesSeen();
  versionNotesScreen.hidden = true;
}

function linkHref(value) {
  const candidate = value.startsWith("www.") ? `https://${value}` : value;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function splitTrailingPunctuation(value) {
  let end = value.length;
  while (end > 0) {
    const mark = value[end - 1];
    if (!/[),.;:!?\]]$/.test(mark)) break;
    if (mark === ")" || mark === "]") {
      const head = value.slice(0, end);
      const opens = (head.match(/\(/g) || []).length + (head.match(/\[/g) || []).length;
      const closes = (head.match(/\)/g) || []).length + (head.match(/\]/g) || []).length;
      if (opens >= closes) break;
    }
    end -= 1;
  }
  return [value.slice(0, end), value.slice(end)];
}

function isImageHref(href) {
  try {
    return /\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(new URL(href).pathname);
  } catch {
    return false;
  }
}

function createMessageLink(href, label) {
  const link = document.createElement("a");
  link.className = "message-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = label;
  return link;
}

function createMessageImage(href) {
  const link = document.createElement("a");
  link.className = "message-link message-image-link";
  link.href = href;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  const image = document.createElement("img");
  image.className = "message-image";
  image.src = href;
  image.alt = "Shared image";
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => {
    link.replaceWith(createMessageLink(href, href));
  });
  link.append(image);
  return link;
}

function fillRichText(element, text, { images = true } = {}) {
  element.replaceChildren();
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const raw = match[0];
    const start = match.index;
    if (start > 0 && /[A-Za-z0-9/]/.test(text[start - 1])) {
      element.append(document.createTextNode(text.slice(cursor, start + raw.length)));
      cursor = start + raw.length;
      continue;
    }
    if (start > cursor) element.append(document.createTextNode(text.slice(cursor, start)));
    const [core, trailing] = splitTrailingPunctuation(raw);
    const href = linkHref(core);
    if (href && images && isImageHref(href)) element.append(createMessageImage(href));
    else if (href) element.append(createMessageLink(href, core));
    else element.append(document.createTextNode(core));
    if (trailing) element.append(document.createTextNode(trailing));
    cursor = start + raw.length;
  }
  if (cursor < text.length) element.append(document.createTextNode(text.slice(cursor)));
}

function addMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  article.dataset.messageId = message.id;
  const deleted = message.username === "[DELETED]";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  fillAvatarElement(avatar, message, { own: message.is_own, deleted });

  const content = document.createElement("div");
  content.className = "message-content";
  const meta = document.createElement("div");
  meta.className = "message-meta";
  const author = document.createElement("span");
  author.className = "message-author";
  author.classList.toggle("deleted", deleted);
  author.textContent = message.username;
  const time = document.createElement("time");
  time.className = "message-time";
  time.dateTime = message.created_at;
  time.textContent = new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const text = document.createElement("p");
  text.className = "message-text";
  fillRichText(text, message.text);

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
  fillRichText(quoteText, replyTo.text, { images: false });
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

function startPolling() {
  clearInterval(pollingTimer);
  const tick = () => {
    loadMessages();
    if (activeView === "dms") {
      loadDmContacts();
      loadDmMessages();
    }
  };
  tick();
  const interval = document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
  pollingTimer = setInterval(tick, interval);
}

async function loadMessages() {
  if (!currentUser || messagesLoading) return;
  messagesLoading = true;
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
    } else {
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
    }
    await syncReadState(data.unread);
    if (document.visibilityState === "visible") {
      const now = Date.now();
      if (now - presenceLastSentAt >= PRESENCE_MIN_INTERVAL_MS) {
        presenceLastSentAt = now;
        reportPresence(true);
      }
    }
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    }
  } finally {
    messagesLoading = false;
  }
}

async function initialize() {
  captureIncomingShare();
  authSubmit.disabled = true;
  try {
    const data = await api("/api/session");
    csrfToken = data.csrf_token;
    authSubmit.disabled = false;
    if (data.account_deleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (data.user) showRoom(data.user);
    else {
      setAuthMode("create");
      updateAppBadge(0);
    }
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

function createDmPersonButton(person, { preview = "", active = false, onClick }) {
  const button = document.createElement("button");
  button.className = "dm-contact";
  button.type = "button";
  button.classList.toggle("active", active);
  button.dataset.accountId = String(person.id);
  button.setAttribute("aria-pressed", String(active));
  const avatar = document.createElement("div");
  avatar.className = "dm-contact-avatar message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  fillAvatarElement(avatar, person);
  const copy = document.createElement("span");
  copy.className = "dm-contact-copy";
  const name = document.createElement("span");
  name.className = "dm-contact-name";
  name.textContent = person.username;
  const previewEl = document.createElement("span");
  previewEl.className = "dm-contact-preview";
  previewEl.textContent = preview || person.animal_username || "Start a conversation";
  copy.append(name, previewEl);
  const dot = document.createElement("span");
  dot.className = "unread-dot";
  dot.setAttribute("aria-hidden", "true");
  button.append(avatar, copy, dot);
  button.addEventListener("click", onClick);
  return button;
}

function renderDmContacts(contacts) {
  dmContacts.replaceChildren();
  if (!contacts.length) {
    const empty = document.createElement("p");
    empty.className = "dm-contact-empty";
    empty.textContent = "No conversations yet. Search for a username above to start one.";
    dmContacts.append(empty);
    return;
  }
  for (const contact of contacts) {
    dmContacts.append(createDmPersonButton(contact, {
      preview: contact.last_message || "Conversation",
      active: selectedDmUser?.id === contact.id,
      onClick: () => selectDmContact(contact),
    }));
  }
  updateDmUnreadDots();
}

function clearDmSearchResults() {
  const results = document.querySelector("#dmSearchResults");
  results.hidden = true;
  results.replaceChildren();
}

function renderDmSearchResults(people, query) {
  const results = document.querySelector("#dmSearchResults");
  results.replaceChildren();
  if (!query) {
    results.hidden = true;
    return;
  }
  results.hidden = false;
  if (!people.length) {
    const empty = document.createElement("p");
    empty.className = "dm-search-empty";
    empty.textContent = `No one matched “${query}”. Try a display name, or an animal name if they haven’t set one.`;
    results.append(empty);
    return;
  }
  for (const person of people) {
    results.append(createDmPersonButton(person, {
      preview: "Start a conversation",
      active: selectedDmUser?.id === person.id,
      onClick: () => {
        document.querySelector("#dmSearchInput").value = "";
        clearDmSearchResults();
        selectDmContact(person);
      },
    }));
  }
}

let dmSearchTimer = 0;
async function searchDmPeople(query) {
  const trimmed = query.trim();
  if (!trimmed) {
    clearDmSearchResults();
    return;
  }
  try {
    const data = await api(`/api/dms/search?q=${encodeURIComponent(trimmed)}`);
    renderDmSearchResults(data.results || [], trimmed);
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

async function loadDmContacts() {
  if (!currentUser || dmContactsLoading) return;
  dmContactsLoading = true;
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
      if (!selectedDmUser) resetDmConversationPane();
      else showDmConversationPage();
    } else {
      showDmContactsPage();
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
  } finally {
    dmContactsLoading = false;
  }
}

function showDmContactsPage() {
  dmSidebar.hidden = false;
  dmConversation.hidden = true;
  dmPanel.classList.remove("show-conversation");
}

function showDmConversationPage() {
  dmSidebar.hidden = true;
  dmConversation.hidden = false;
  dmPanel.classList.add("show-conversation");
}

function resetDmConversationPane() {
  selectedDmUser = null;
  dmMessageCursor = 0;
  clearDmReply();
  dmFeed.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "Your private conversations will appear here.";
  dmFeed.append(empty);
  document.querySelector("#dmConversationTitle").textContent = "Choose someone to message";
  document.querySelector("#dmConversationSubtitle").textContent = "Search for a username or open an existing conversation.";
  dmMessageInput.value = "";
  dmMessageInput.disabled = true;
  dmMessageInput.style.height = "34px";
  dmMessageInput.placeholder = "Choose someone to message...";
  dmSendButton.disabled = true;
  dmMessageError.hidden = true;
  syncDmEmojiButtons();
  clearDmSearchResults();
  showDmContactsPage();
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
  syncDmEmojiButtons();
  document.querySelector("#dmConversationTitle").textContent = contact.username;
  document.querySelector("#dmConversationSubtitle").textContent = "Private conversation";
  renderDmContacts(JSON.parse(dmContactsSnapshot || "[]"));
  showDmConversationPage();
  showDmError("");
  dmMessageError.hidden = true;
  loadDmMessages();
  syncReadState(unreadState, true);
}

function addDmMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  article.dataset.messageId = message.id;
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  fillAvatarElement(avatar, message, { own: message.is_own });

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
  fillRichText(text, message.text);
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
  if (!currentUser || !selectedDmUser || dmMessagesLoading) return;
  const accountId = selectedDmUser.id;
  dmMessagesLoading = true;
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
  } finally {
    dmMessagesLoading = false;
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
      title.textContent = account.public_name || account.username;
      const detail = document.createElement("div");
      detail.className = "admin-row-detail";
      const animalLabel = account.display_name ? ` · animal ${account.username}` : "";
      detail.textContent = `${account.role === "admin" ? "Admin" : "Member"}${animalLabel} · ${account.message_count} messages · joined ${formatAdminTime(account.created_at)}`;
      copy.append(title, detail);
      row.append(copy);
      if (account.username !== "Cricket" && account.role !== "admin") {
        const button = document.createElement("button");
        button.className = "admin-row-action";
        button.type = "button";
        button.textContent = "Delete account";
        button.addEventListener("click", async () => {
          if (!window.confirm(`Delete ${account.public_name || account.username} and mark all of their messages [DELETED]?`)) return;
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

function firstSharedUrl(value) {
  const match = String(value || "").match(/https?:\/\/[^\s]+/i);
  return match ? match[0].replace(/[),.;:!?]+$/, "") : "";
}

function incomingShareDraft() {
  const params = new URLSearchParams(window.location.search);
  const title = (params.get("title") || "").trim();
  const text = (params.get("text") || "").trim();
  const sharedUrl = (params.get("url") || "").trim();
  const link = sharedUrl || firstSharedUrl(text);
  const parts = [];
  if (title && title !== link && !(text && text.includes(title))) parts.push(title);
  if (text && text !== link) parts.push(text);
  if (link && !parts.some(part => part.includes(link))) parts.push(link);
  return parts.join("\n").trim().slice(0, 500);
}

function captureIncomingShare() {
  if (window.location.pathname !== "/share") return;
  const draft = incomingShareDraft();
  if (draft) {
    try {
      sessionStorage.setItem("pigin-share", draft);
    } catch {
      // The shared link still applies if storage is blocked and the room is already open.
    }
  }
  window.history.replaceState(null, "", "/");
}

function applyRememberedShare() {
  let draft = "";
  try {
    draft = sessionStorage.getItem("pigin-share") || "";
    if (draft) sessionStorage.removeItem("pigin-share");
  } catch {
    draft = "";
  }
  if (!draft && window.location.pathname === "/share") draft = incomingShareDraft();
  if (!draft) return;
  if (activeView !== "chat") setRoomView("chat");
  messageInput.value = draft;
  messageInput.dispatchEvent(new Event("input"));
  if (warningScreen.hidden) messageInput.focus();
}

function clearDmDeepLink() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("view") && !url.searchParams.has("with")) return;
  url.searchParams.delete("view");
  url.searchParams.delete("with");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isHomeScreenApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function notificationsWanted() {
  try {
    return localStorage.getItem("pigin-notifications") !== "off";
  } catch {
    return true;
  }
}

function setNotificationsWanted(on) {
  try {
    if (on) localStorage.removeItem("pigin-notifications");
    else localStorage.setItem("pigin-notifications", "off");
  } catch {
    // The choice still applies for this visit when storage is blocked.
  }
}

function setPushHint(text) {
  pushHint = text;
  pushHintText.textContent = text || "Alerts for new chat and direct messages.";
}

function resetPushToggle() {
  pushHint = "";
  pushToggle.disabled = true;
  pushToggle.dataset.state = "";
  pushToggle.setAttribute("aria-pressed", "false");
  pushToggle.textContent = "Enable notifications";
  pushHintText.textContent = "Alerts for new chat and direct messages.";
  delete pushToggle.dataset.publicKey;
}

function setPushToggle(state, hint = "") {
  const labels = {
    unavailable: "Notifications unavailable",
    install: "Add to Home Screen",
    blocked: "Notifications blocked",
    off: "Enable notifications",
    on: "Notifications on",
  };
  const defaults = {
    on: "You'll get alerts for new chat and direct messages.",
    off: "Notifications are off on this device.",
  };
  pushToggle.dataset.state = state;
  pushToggle.disabled = state !== "on" && state !== "off" && state !== "install";
  pushToggle.setAttribute("aria-pressed", String(state === "on"));
  pushToggle.textContent = labels[state];
  setPushHint(hint || defaults[state] || "");
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
  if (!currentUser) {
    resetPushToggle();
    return;
  }
  if (isIos() && !isHomeScreenApp()) {
    setPushToggle("install", "iPhone only delivers these alerts from the Home Screen. In Safari, tap Share, then Add to Home Screen, then open PIGIN from that icon.");
    return;
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const hint = isIos()
      ? "Remove the PIGIN icon from your Home Screen, add it again from Safari, then open PIGIN from that icon."
      : "Notifications are unavailable in this browser.";
    setPushToggle("unavailable", hint);
    return;
  }
  if (Notification.permission === "denied") {
    setPushToggle("blocked", "Notification permission was denied. Allow notifications for PIGIN in your phone settings.");
    return;
  }
  try {
    const config = await api("/api/push/config");
    if (!config.enabled || !config.public_key) {
      setPushToggle("unavailable", "Notifications are not configured on this server yet.");
      return;
    }
    pushToggle.dataset.publicKey = config.public_key;
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription = await registration.pushManager.getSubscription();
    pushEndpoint = subscription?.endpoint || "";
    if (subscription) {
      setNotificationsWanted(true);
      setPushToggle("on");
      reportPresence(document.visibilityState === "visible");
      return;
    }
    if (notificationsWanted()) {
      await enablePushNotifications();
      return;
    }
    setPushToggle("off");
  } catch (error) {
    setPushToggle("unavailable", error.message || "Notifications are unavailable in this browser.");
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
  pushEndpoint = "";
}

async function enablePushNotifications() {
  if (enablingPush || !currentUser || !pushToggle.dataset.publicKey) return;
  enablingPush = true;
  pushToggle.disabled = true;
  pushToggle.textContent = "Notifications on";
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") {
      setPushToggle(permission === "denied" ? "blocked" : "off");
      if (permission === "denied") setPushHint("Notification permission was denied. Allow notifications for PIGIN in your phone settings.");
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
    pushEndpoint = subscription.endpoint;
    setNotificationsWanted(true);
    setPushToggle("on");
    reportPresence(document.visibilityState === "visible");
  } catch (error) {
    setPushToggle("off", error.message || "Could not turn notifications on.");
  } finally {
    enablingPush = false;
  }
}

async function togglePushNotifications() {
  if (!currentUser || pushToggle.disabled || enablingPush) return;
  if (pushToggle.dataset.state === "install") return;
  if (pushToggle.dataset.state === "on") {
    setNotificationsWanted(false);
    pushToggle.disabled = true;
    try {
      await disablePushSubscription();
      setPushToggle("off");
    } catch (error) {
      setPushToggle("on", error.message || "Could not update notifications.");
    }
    return;
  }
  setNotificationsWanted(true);
  await enablePushNotifications();
}

function applyTheme(theme) {
  const dark = theme === "dark";
  if (dark) document.documentElement.dataset.theme = "dark";
  else delete document.documentElement.dataset.theme;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", dark ? "#121816" : "#f6f7f3");
  themeToggle.setAttribute("aria-pressed", String(dark));
  themeToggle.textContent = dark ? "Dark mode on" : "Dark mode off";
  try {
    if (dark) localStorage.setItem("pigin-theme", "dark");
    else localStorage.removeItem("pigin-theme");
  } catch {
    // The theme still applies for this visit when storage is blocked.
  }
}

function setMenuOpen(open) {
  document.body.classList.toggle("menu-open", open);
  updateMenuButton();
}

function updateMenuButton() {
  const open = document.body.classList.contains("menu-open");
  const unread = (unreadState.group || 0) + (unreadState.dms || 0);
  menuButton.classList.toggle("has-unread", unread > 0);
  menuButton.setAttribute("aria-expanded", String(open));
  menuBackdrop.setAttribute("aria-hidden", String(!open));
  sideTabs.inert = compactMenu.matches && !open;
  const action = open ? "Close menu" : "Open menu";
  menuButton.setAttribute("aria-label", unread > 0 ? `${action}, ${unread} unread` : action);
}

function fitAppToViewport() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const offset = viewport?.offsetTop || 0;
  document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`);
  document.documentElement.style.setProperty("--app-offset", `${Math.round(offset)}px`);
}

function updateRoomTitle(view) {
  const titles = {
    chat: "World Chat",
    dms: "Direct Messages",
    settings: "Settings",
    admin: "Admin",
  };
  document.querySelector("#roomTitle").textContent = titles[view] || "World Chat";
}

function setRoomView(view) {
  if (view === "admin" && currentUser?.role !== "admin") return;
  activeView = view;
  updateRoomTitle(view);
  const showChat = view === "chat";
  const showDms = view === "dms";
  const showSettings = view === "settings";
  const showAdmin = view === "admin";
  chatView.hidden = !showChat;
  dmPanel.hidden = !showDms;
  settingsPanel.hidden = !showSettings;
  adminPanel.hidden = !showAdmin;
  chatTab.classList.toggle("active", showChat);
  chatTab.setAttribute("aria-pressed", String(showChat));
  dmTab.classList.toggle("active", showDms);
  dmTab.setAttribute("aria-pressed", String(showDms));
  settingsTab.classList.toggle("active", showSettings);
  settingsTab.setAttribute("aria-pressed", String(showSettings));
  adminTab.classList.toggle("active", showAdmin);
  adminTab.setAttribute("aria-pressed", String(showAdmin));
  if (showDms) {
    if (selectedDmUser) showDmConversationPage();
    else showDmContactsPage();
    loadDmContacts();
    loadDmMessages();
  }
  if (showAdmin) loadAdminData();
  if (showSettings) refreshProfileSettings();
  if (showChat || showDms) syncReadState(unreadState, true);
  setMenuOpen(false);
}

document.querySelector("#createMode").addEventListener("click", () => setAuthMode("create"));
document.querySelector("#signInMode").addEventListener("click", () => setAuthMode("signin"));
chatTab.addEventListener("click", () => setRoomView("chat"));
dmTab.addEventListener("click", () => setRoomView("dms"));
settingsTab.addEventListener("click", () => setRoomView("settings"));
adminTab.addEventListener("click", () => setRoomView("admin"));
document.querySelector("#displayNameForm").addEventListener("submit", async event => {
  event.preventDefault();
  const saveButton = document.querySelector("#saveDisplayName");
  saveButton.disabled = true;
  showProfileError("");
  try {
    const data = await api("/api/profile", {
      method: "PATCH",
      body: JSON.stringify({ display_name: document.querySelector("#displayNameInput").value }),
    });
    applyCurrentUser(data.user);
  } catch (error) {
    showProfileError(error.message);
  } finally {
    saveButton.disabled = false;
  }
});
document.querySelector("#avatarInput").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  showProfileError("");
  try {
    const prepared = await prepareAvatarUpload(file);
    const data = await uploadAvatarFile(prepared);
    applyCurrentUser(data.user);
  } catch (error) {
    showProfileError(error.message);
  }
});
document.querySelector("#removeAvatarButton").addEventListener("click", async () => {
  showProfileError("");
  try {
    const data = await api("/api/profile/avatar", { method: "DELETE" });
    applyCurrentUser(data.user);
  } catch (error) {
    showProfileError(error.message);
  }
});
dmBackButton.addEventListener("click", () => {
  resetDmConversationPane();
  renderDmContacts(JSON.parse(dmContactsSnapshot || "[]"));
  showDmError("");
  syncReadState(unreadState, true);
});
menuButton.addEventListener("click", () => {
  setMenuOpen(!document.body.classList.contains("menu-open"));
});
menuBackdrop.addEventListener("click", () => setMenuOpen(false));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && document.body.classList.contains("menu-open")) setMenuOpen(false);
});
fitAppToViewport();
window.addEventListener("resize", fitAppToViewport);
compactMenu.addEventListener("change", event => {
  if (!event.matches) setMenuOpen(false);
  else updateMenuButton();
});
updateMenuButton();
applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
window.visualViewport?.addEventListener("resize", fitAppToViewport);
window.visualViewport?.addEventListener("scroll", () => {
  fitAppToViewport();
  if (window.scrollY) window.scrollTo(0, 0);
});
document.querySelector("#adminRefresh").addEventListener("click", loadAdminData);
document.querySelector("#dmRefresh").addEventListener("click", () => {
  dmContactsSnapshot = "";
  loadDmContacts();
  loadDmMessages();
});
document.querySelector("#dmSearchForm").addEventListener("submit", event => {
  event.preventDefault();
  clearTimeout(dmSearchTimer);
  searchDmPeople(document.querySelector("#dmSearchInput").value);
});
document.querySelector("#dmSearchInput").addEventListener("input", event => {
  clearTimeout(dmSearchTimer);
  const value = event.target.value;
  dmSearchTimer = window.setTimeout(() => searchDmPeople(value), 200);
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
    maybeShowVersionNotes();
  } catch (error) {
    showWarning("account", error.message);
  }
});
document.querySelector("#versionNotesAction").addEventListener("click", dismissVersionNotes);
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
themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});
function openNotificationTarget(url) {
  if (!currentUser || !url) return;
  const target = new URL(url, window.location.origin);
  const view = target.searchParams.get("view");
  if (view === "chat") {
    setRoomView("chat");
    return;
  }
  if (view !== "dms") return;
  const partnerId = Number(target.searchParams.get("with"));
  if (!Number.isInteger(partnerId) || partnerId < 1) {
    setRoomView("dms");
    return;
  }
  pendingDmPartnerId = partnerId;
  setRoomView("dms");
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", event => {
    if (!currentUser || !event.data) return;
    if (event.data.type === "unread-refresh") {
      if (event.data.unread) applyUnread(event.data.unread);
      if (event.data.source === "read-sync") closeAppNotifications();
      loadMessages();
      if (activeView === "dms") {
        loadDmContacts();
        loadDmMessages();
      }
      return;
    }
    if (event.data.type === "open-target" || event.data.type === "open-dm") {
      openNotificationTarget(event.data.url);
    }
  });
}

document.addEventListener("visibilitychange", () => {
  const visible = document.visibilityState === "visible";
  if (visible) presenceLastSentAt = 0;
  reportPresence(visible);
  if (!currentUser) return;
  startPolling();
  if (!visible) return;
  closeAppNotifications();
  syncReadState(unreadState, true);
});

window.addEventListener("pagehide", () => {
  if (!currentUser || !pushEndpoint || !csrfToken) return;
  fetch("/api/push/presence", {
    method: "POST",
    keepalive: true,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
    },
    body: JSON.stringify({
      endpoint: pushEndpoint,
      client_id: presenceClientId(),
      visible: false,
      reported_at: Date.now(),
    }),
  }).catch(() => {});
});

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
  dmMessageError.hidden = true;
});
document.querySelector("#dmMessageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const text = dmMessageInput.value.trim();
  if (!text || !selectedDmUser || dmSendButton.disabled) return;
  dmSendButton.disabled = true;
  dmMessageError.hidden = true;
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
    dmMessageError.hidden = true;
    dmContactsSnapshot = "";
    await Promise.all([loadDmMessages(), loadDmContacts()]);
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      dmMessageError.textContent = error.message;
      dmMessageError.hidden = false;
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
function syncDmEmojiButtons() {
  document.querySelectorAll("#dmMessageForm .emoji-button").forEach(button => {
    button.disabled = dmMessageInput.disabled;
  });
}

function insertEmoji(input, emoji) {
  if (!input || input.disabled) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const inserted = `${needsSpace ? " " : ""}${emoji}`;
  input.value = `${before}${inserted}${after}`;
  const cursor = before.length + inserted.length;
  input.setSelectionRange(cursor, cursor);
  input.dispatchEvent(new Event("input"));
  input.focus();
}

if (!Array.isArray(window.CHAT_EMOJIS)) {
  throw new Error("The emoji dataset could not be loaded.");
}

const emojiCategories = [...new Set(window.CHAT_EMOJIS.map(([, , category]) => category))];

function renderEmojiPicker(wrap) {
  const search = wrap.querySelector(".emoji-search");
  const category = wrap.querySelector(".emoji-category");
  const resultCount = wrap.querySelector(".emoji-result-count");
  const grid = wrap.querySelector(".emoji-grid");
  const query = search.value.trim().toLocaleLowerCase();
  const matchingEmojis = window.CHAT_EMOJIS.filter(([emoji, name, emojiCategory]) => {
    if (query) return `${name} ${emojiCategory} ${emoji}`.toLocaleLowerCase().includes(query);
    return category.value === "all" || emojiCategory === category.value;
  });
  const fragment = document.createDocumentFragment();

  matchingEmojis.forEach(([emoji, name], index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = emoji;
    button.title = name;
    button.setAttribute("aria-label", name);
    button.tabIndex = index === 0 ? 0 : -1;
    fragment.append(button);
  });

  grid.replaceChildren(fragment);
  resultCount.textContent = matchingEmojis.length
    ? `${matchingEmojis.length.toLocaleString()} emojis`
    : "No emojis found";
}

const emojiPickerWraps = document.querySelectorAll(".emoji-picker-wrap");
emojiPickerWraps.forEach(wrap => {
  const toggle = wrap.querySelector(".emoji-button");
  const picker = wrap.querySelector(".emoji-picker");
  const search = wrap.querySelector(".emoji-search");
  const category = wrap.querySelector(".emoji-category");
  const grid = wrap.querySelector(".emoji-grid");
  category.add(new Option("All categories", "all"));
  emojiCategories.forEach(name => category.add(new Option(name, name)));
  category.value = "Smileys & Emotion";
  renderEmojiPicker(wrap);

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", String(!expanded));
    picker.hidden = expanded;
    if (!expanded) search.focus();
  });
  search.addEventListener("input", () => renderEmojiPicker(wrap));
  category.addEventListener("change", () => renderEmojiPicker(wrap));
  picker.addEventListener("click", event => {
    const selectedButton = event.target.closest("button");
    if (!selectedButton || !grid.contains(selectedButton)) return;
    insertEmoji(wrap.closest("form")?.querySelector("textarea"), selectedButton.textContent.trim());
    picker.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });
  grid.addEventListener("keydown", event => {
    const currentButton = event.target.closest("button");
    if (!currentButton) return;
    const buttons = [...grid.querySelectorAll("button")];
    const currentIndex = buttons.indexOf(currentButton);
    const columns = 8;
    const nextIndex = {
      ArrowLeft: currentIndex - 1,
      ArrowRight: currentIndex + 1,
      ArrowUp: currentIndex - columns,
      ArrowDown: currentIndex + columns,
      Home: 0,
      End: buttons.length - 1,
    }[event.key];
    if (nextIndex === undefined || nextIndex < 0 || nextIndex >= buttons.length) return;
    event.preventDefault();
    currentButton.tabIndex = -1;
    buttons[nextIndex].tabIndex = 0;
    buttons[nextIndex].focus();
  });
});
document.addEventListener("click", event => {
  emojiPickerWraps.forEach(wrap => {
    if (wrap.contains(event.target)) return;
    wrap.querySelector(".emoji-picker").hidden = true;
    wrap.querySelector(".emoji-button").setAttribute("aria-expanded", "false");
  });
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  emojiPickerWraps.forEach(wrap => {
    const toggle = wrap.querySelector(".emoji-button");
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    wrap.querySelector(".emoji-picker").hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  });
});

syncDmEmojiButtons();
initialize();