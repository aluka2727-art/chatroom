const accountForm = document.querySelector("#accountForm");
const usernameInput = document.querySelector("#usernameInput");
const passwordInput = document.querySelector("#passwordInput");
const confirmInput = document.querySelector("#confirmInput");
const authError = document.querySelector("#authError");
const loginScreen = document.querySelector("#loginScreen");
const appLoading = document.querySelector("#appLoading");
const room = document.querySelector("#room");
const feed = document.querySelector("#feed");
const messageInput = document.querySelector("#messageInput");
const sendButton = document.querySelector("#sendButton");
const replyPreview = document.querySelector("#replyPreview");
const replyPreviewLabel = document.querySelector("#replyPreviewLabel");
const replyPreviewText = document.querySelector("#replyPreviewText");
const messageError = document.querySelector("#messageError");
const accountCreatedNotice = document.querySelector("#accountCreatedNotice");
const authSubmit = document.querySelector("#authSubmit");
const warningScreen = document.querySelector("#warningScreen");
const versionNotesScreen = document.querySelector("#versionNotesScreen");
const APP_VERSION = "1.14.1";
const VERSION_NOTES_STORAGE_KEY = "pigin-seen-version";
const VERSION_NOTES = {
  "1.14.1": [
    "The optimized keyboard has medium-height keys and a simpler layout.",
    "The illustrated install guide shows how to add PIGIN as a web app on your device.",
  ],
  "1.14.0": [
    "A guided tour introduces World Chat, Private Usernames, and private conversations.",
    "The new group form keeps your selected members visible as you search.",
  ],
  "1.13.2": [
    "The mobile keyboard types as soon as you touch a key and keeps up with overlapping taps.",
    "Taps in the gaps between keys register on the nearest typing key.",
    "Double-tap Shift to turn on Caps Lock and see CAPS LOCK on the key.",
  ],
  "1.13.1": [
    "The mobile keyboard now follows the familiar iPhone QWERTY layout.",
    "A blinking cursor shows where the next character will appear.",
  ],
  "1.13.0": [
    "Type with PIGIN’s mobile keyboard in World Chat, DMs, and group chats.",
    "Opening the keyboard scrolls to the newest message.",
    "Use Shift, Caps Lock, symbols, and editing controls. Press a physical key to return to standard typing.",
  ],
  "1.12.8": [
    "Get push notifications for private group chats.",
    "Mute notifications separately for World Chat, a DM, or a group chat.",
    "Moderation is more lenient about ordinary topics, while continuing to block hateful or abusive messages.",
  ],
  "1.12.7": [
    "Group chats now support replies, editing your own messages, and managing members and group names.",
  ],
  "1.12.5": [
    "Faster messaging and read receipts, with improved conversation loading.",
    "Messages now show both the date and time.",
    "Tap a message to reply or edit your own messages.",
    "Log out from Settings, or choose Delete User to delete your account after confirmation and password verification.",
  ],
  "1.12.6": [
    "Create private group chats with a custom name and find everyone by their DM username.",
  ],
  "1.12.4": [
    "Sign-in now works on devices that don't retain session cookies.",
  ],
  "1.12.3": [
    "Fixed sign-in errors on devices that don't retain the initial session cookie.",
  ],
  "1.12.2": [
    "A looping pigeon animation now keeps you company while PIGIN loads, including chats and DMs.",
  ],
  "1.12.1": [
    "Tap the ··· on a message for Reply or Edit.",
    "Edit your own messages in chat and DMs.",
  ],
  "1.11.3": [
    "Messages appear instantly when you send them.",
    "If a message is blocked, it stays in your chat with a clear rejection notice.",
  ],
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
const dmGroupContacts = document.querySelector("#dmGroupContacts");
const dmFeed = document.querySelector("#dmFeed");
const dmMessageInput = document.querySelector("#dmMessageInput");
const dmSendButton = document.querySelector("#dmSendButton");
const dmMessageError = document.querySelector("#dmMessageError");
const dmReplyPreview = document.querySelector("#dmReplyPreview");
const dmReplyPreviewLabel = document.querySelector("#dmReplyPreviewLabel");
const dmReplyPreviewText = document.querySelector("#dmReplyPreviewText");
const pushToggle = document.querySelector("#pushToggle");
const pushHintText = document.querySelector("#pushHintText");
const worldDndToggle = document.querySelector("#worldDndToggle");
const conversationDndToggle = document.querySelector("#conversationDndToggle");
const themeToggle = document.querySelector("#themeToggle");
let currentUser = null;
let csrfToken = "";
let authToken = "";
try {
  authToken = localStorage.getItem("pigin-auth-token") || "";
} catch (error) {}
let messageCursor = 0;
let replyingTo = null;
let editingMessage = null;
let replyingToDm = null;
let editingDmMessage = null;
let selectedDmUser = null;
let selectedDmGroup = null;
let dmMessageCursor = 0;
let groupMessageCursor = 0;
let dmPollSince = "";
let dmContactsSnapshot = "";
let dmGroupsSnapshot = "";
let groupSearchRequest = 0;
const selectedGroupMembers = new Map();
let groupSearchTimer = 0;
let groupManageSearchTimer = 0;
let groupManagePeople = [];
let groupMessagesLoading = false;
let activeView = "chat";
let openMessageMenu = null;
let accountCreatedTimeout;
let pollingTimer;
let realtimeRefreshTimer;
let realtimeClient = null;
let realtimeChannels = [];
let realtimeSetupFor = null;
let realtimeReadyTopics = new Set();
let supabaseSdkPromise = null;
let messagesLoading = false;
let dmContactsLoading = false;
let dmMessagesLoading = false;
let presenceLastSentAt = 0;
const POLL_VISIBLE_MS = 4000;
const POLL_HIDDEN_MS = 15000;
const REALTIME_SAFETY_SYNC_MS = 60000;
const PRESENCE_MIN_INTERVAL_MS = 8000;
let warningKind = null;
let pendingDmPartnerId = null;
let pendingDmGroupId = null;
let pushHint = "";
let pushEndpoint = "";
let mutedChatKeys = new Set();
let notificationPreferencesReady = false;
let enablingPush = false;
let presenceClientMemory = "";
let readSyncEpoch = 0;
let displayedBadgeCount = null;
let unreadState = { group: 0, dms: 0, total: 0, conversations: {} };

function createLoadingIndicator(label) {
  const indicator = document.createElement("div");
  indicator.className = "loading-indicator";
  indicator.setAttribute("role", "status");
  const image = document.createElement("div");
  image.className = "loading-pigeon";
  image.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.className = "loading-label";
  text.textContent = label;
  indicator.append(image, text);
  return indicator;
}

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

function notificationPreferenceKey(chatType, chatId) {
  return `${chatType}:${chatId}`;
}

function syncDndButton(button, chatType, chatId, chatName) {
  const muted = mutedChatKeys.has(notificationPreferenceKey(chatType, chatId));
  const label = `${muted ? "Unmute" : "Mute"} notifications for ${chatName}`;
  button.disabled = !notificationPreferencesReady;
  button.textContent = muted ? "Muted" : "Mute";
  button.setAttribute("aria-pressed", String(muted));
  button.setAttribute("aria-label", label);
  button.title = label;
}

function syncDndControls() {
  syncDndButton(worldDndToggle, "world", 0, "World Chat");
  if (selectedDmGroup) {
    conversationDndToggle.hidden = false;
    syncDndButton(conversationDndToggle, "group", selectedDmGroup.id, selectedDmGroup.name);
  } else if (selectedDmUser) {
    conversationDndToggle.hidden = false;
    syncDndButton(conversationDndToggle, "dm", selectedDmUser.id, selectedDmUser.username);
  } else {
    conversationDndToggle.hidden = true;
    conversationDndToggle.disabled = true;
  }
}

function showDndError(error) {
  if (error.status === 401) {
    showLogin();
  } else if (activeView === "dms") {
    showDmError(error.message || "Could not update notification preferences.");
  } else {
    messageError.textContent = error.message || "Could not update notification preferences.";
    messageError.hidden = false;
  }
}

async function loadNotificationPreferences() {
  notificationPreferencesReady = false;
  syncDndControls();
  try {
    const data = await api("/api/notification-preferences");
    mutedChatKeys = new Set((data.muted || []).map(
      preference => notificationPreferenceKey(preference.chat_type, preference.chat_id),
    ));
    notificationPreferencesReady = true;
    syncDndControls();
  } catch (error) {
    showDndError(error);
  }
}

async function toggleChatNotifications(chatType, chatId) {
  if (!notificationPreferencesReady) return;
  const button = chatType === "world" ? worldDndToggle : conversationDndToggle;
  const key = notificationPreferenceKey(chatType, chatId);
  const muted = !mutedChatKeys.has(key);
  button.disabled = true;
  try {
    const result = await api("/api/notification-preferences", {
      method: "PUT",
      body: JSON.stringify({ chat_type: chatType, chat_id: chatId, muted }),
    });
    if (result.muted) mutedChatKeys.add(key);
    else mutedChatKeys.delete(key);
    syncDndControls();
    showDmError("");
    messageError.hidden = true;
  } catch (error) {
    showDndError(error);
    syncDndControls();
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
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
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
    if (response.status === 401 && authToken) {
      authToken = "";
      try { localStorage.removeItem("pigin-auth-token"); } catch (error) {}
    }
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
    ? "Sign in with your animal username or Private Username, and password."
    : "Create an account with a password. We’ll give you an animal name.";
  document.querySelector("#authSubmit").textContent = signingIn ? "Sign in" : "Create account";
  authError.hidden = true;
  accountForm.reset();
}

function showLogin() {
  hideMobileKeyboard();
  document.querySelector("#deleteUserDialog")?.close();
  clearInterval(pollingTimer);
  clearInterval(realtimeRefreshTimer);
  realtimeChannels.forEach(channel => realtimeClient?.removeChannel(channel));
  realtimeChannels = [];
  realtimeClient = null;
  realtimeSetupFor = null;
  realtimeReadyTopics = new Set();
  currentUser = null;
  tutorialDialog.close();
  mutedChatKeys = new Set();
  notificationPreferencesReady = false;
  messageCursor = 0;
  warningKind = null;
  clearReply();
  clearEdit();
  closeMessageMenu();
  messageError.hidden = true;
  warningScreen.hidden = true;
  versionNotesScreen.hidden = true;
  feed.replaceChildren();
  dmFeed.replaceChildren();
  dmContacts.replaceChildren();
  dmGroupContacts.replaceChildren();
  dmContactsSnapshot = "";
  dmGroupsSnapshot = "";
  resetGroupCreation();
  document.querySelector("#groupManagement").hidden = true;
  document.querySelector("#groupManageToggle").hidden = true;
  document.querySelector("#groupManageToggle").setAttribute("aria-expanded", "false");
  document.querySelector("#groupAddMemberResults").replaceChildren();
  document.querySelector("#groupAddMemberSearch").value = "";
  groupManagePeople = [];
  resetDmConversationPane();
  pendingDmPartnerId = null;
  pendingDmGroupId = null;
  pushEndpoint = "";
  resetPushToggle();
  syncDndControls();
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
  accountCreatedNotice.textContent = `Account created. Your animal username is ${username}. Set a Private Username anytime in Settings.`;
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
  document.querySelector("#animalName").textContent = activeView === "chat" ? user.username : publicNameFor(user);
  refreshProfileSettings();
}

function showRoom(user) {
  hideMobileKeyboard();
  applyCurrentUser(user);
  loginScreen.hidden = true;
  room.hidden = false;
  passwordInput.value = "";
  confirmInput.value = "";
  messageCursor = 0;
  clearReply();
  clearEdit();
  closeMessageMenu();
  messageError.hidden = true;
  feed.replaceChildren();
  feed.append(createLoadingIndicator("Loading messages"));
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
  document.querySelector("#animalName").textContent = user.username;
  startPolling();
  if (user.warning_count) {
    showWarning("message", `${user.warning_count === 1 ? "An admin deleted one of your messages" : `An admin deleted ${user.warning_count} of your messages`}. Deleted messages remain in the chat as [DELETED].`);
  }
  if (isAdmin) loadAdminData();
  pendingDmPartnerId = readDmDeepLink();
  pendingDmGroupId = readGroupDeepLink();
  refreshPushToggle();
  loadNotificationPreferences();
  if (pendingDmPartnerId || pendingDmGroupId) setRoomView("dms");
  applyRememberedShare();
  showWelcome();
}

function showWarning(kind, message) {
  if (warningKind === "account") return;
  if (warningKind === "message" && kind !== "account") return;
  warningKind = kind;
  hideMobileKeyboard();
  tutorialDialog.close();
  versionNotesScreen.hidden = true;
  document.querySelector("#warningTitle").textContent = kind === "account" ? "Account deleted" : "Message deleted";
  warningText.textContent = message;
  warningAction.textContent = kind === "account" ? "Return to sign in" : "I understand";
  warningScreen.hidden = false;
  warningAction.focus();
}

const tutorialDialog = document.querySelector("#tutorialDialog");
const tutorialVersion = Number(tutorialDialog.dataset.version);
const allTutorialSteps = [...tutorialDialog.querySelectorAll("[data-tutorial-step]")];
let tutorialSteps = [];
const tutorialNext = document.querySelector("#tutorialNext");
const tutorialBack = document.querySelector("#tutorialBack");
const tutorialSkip = document.querySelector("#tutorialSkip");
const tutorialError = document.querySelector("#tutorialError");
const tutorialNickname = document.querySelector("#tutorialNickname");
const tutorialDmSearch = document.querySelector("#tutorialDmSearch");
const tutorialDmResult = document.querySelector("#tutorialDmResult");
const tutorialDmFeedback = document.querySelector("#tutorialDmFeedback");
const tutorialPracticeMembers = [...tutorialDialog.querySelectorAll("[data-practice-member]")];
const tutorialPracticeCreate = document.querySelector("#tutorialPracticeCreate");
const tutorialGroupFeedback = document.querySelector("#tutorialGroupFeedback");
let tutorialStep = 0;
let installGuideOnly = false;
const installGuide = document.querySelector("#installGuide");
const installGuideDevice = document.querySelector("#installGuideDevice");

function defaultInstallGuide(userAgent, platform, touchPoints) {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Mac/i.test(platform) && touchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Edg\//i.test(userAgent)) return "edge";
  if (/Mac/i.test(platform) && /Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return "mac";
  return "chrome";
}

function renderInstallGuide() {
  for (const list of installGuide.querySelectorAll("[data-install-device]")) {
    list.hidden = list.dataset.installDevice !== installGuideDevice.value;
  }
}

function resetInstallGuide() {
  installGuideDevice.value = defaultInstallGuide(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  document.querySelector("#installGuideStandalone").hidden =
    navigator.standalone !== true && !window.matchMedia("(display-mode: standalone)").matches;
  renderInstallGuide();
}

installGuideDevice.addEventListener("change", renderInstallGuide);
document.querySelector("#openInstallGuide").addEventListener("click", () => {
  installGuideOnly = true;
  tutorialSteps = [installGuide];
  tutorialError.hidden = true;
  resetInstallGuide();
  tutorialDialog.showModal();
  showTutorialStep(0);
});

function showTutorialStep(step) {
  hideMobileKeyboard();
  tutorialStep = step;
  for (const section of allTutorialSteps) section.hidden = section !== tutorialSteps[step];
  document.querySelector("#tutorialProgress").textContent = `Step ${step + 1} of ${tutorialSteps.length}`;
  tutorialBack.hidden = step === 0;
  tutorialSkip.hidden = installGuideOnly;
  document.querySelector("#tutorialProgress").hidden = installGuideOnly;
  tutorialNext.textContent = installGuideOnly ? "Done" : step === tutorialSteps.length - 1 ? "Finish tour" : "Next";
  tutorialSteps[step].querySelector("h2").focus();
}

function updateTutorialNickname() {
  document.querySelector("#tutorialPrivatePreview").textContent = tutorialNickname.value.trim() || currentUser.username;
}

function updateTutorialGroup() {
  const count = tutorialPracticeMembers.filter(button => button.getAttribute("aria-pressed") === "true").length;
  tutorialGroupFeedback.textContent = `${count} selected`;
  tutorialPracticeCreate.disabled = count < 2;
}

function showWelcome() {
  if (!currentUser || warningKind) return;
  const completedVersion = currentUser.tutorial_version || 0;
  if (completedVersion >= tutorialVersion) {
    maybeShowVersionNotes();
    return;
  }
  if (tutorialDialog.open) return;
  installGuideOnly = false;
  resetInstallGuide();
  tutorialSteps = allTutorialSteps.filter(section => Number(section.dataset.tutorialStep || 1) > completedVersion);
  if (!tutorialSteps.length) return;
  document.querySelector("#tutorialAnimalName").textContent = currentUser.username;
  document.querySelector("#tutorialWorldPreview").textContent = currentUser.username;
  document.querySelector("#tutorialPrivacyFeedback").textContent = "";
  tutorialNickname.value = "";
  updateTutorialNickname();
  tutorialDmSearch.value = "";
  tutorialDmResult.hidden = true;
  tutorialDmFeedback.textContent = "";
  for (const button of tutorialPracticeMembers) {
    button.setAttribute("aria-pressed", "false");
    button.textContent = `Add ${button.dataset.practiceMember}`;
  }
  updateTutorialGroup();
  tutorialError.hidden = true;
  hideMobileKeyboard();
  tutorialDialog.showModal();
  showTutorialStep(0);
}

async function completeTutorial() {
  if (tutorialNext.disabled || !currentUser) return;
  const accountId = currentUser.id;
  tutorialSkip.disabled = tutorialBack.disabled = tutorialNext.disabled = true;
  tutorialError.hidden = true;
  try {
    const data = await api("/api/tutorial/complete", {
      method: "POST",
      body: JSON.stringify({ version: tutorialVersion }),
    });
    if (currentUser?.id !== accountId) return;
    currentUser.tutorial_version = data.tutorial_version;
    tutorialDialog.close();
    maybeShowVersionNotes();
  } catch (error) {
    if (currentUser?.id !== accountId) return;
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      tutorialError.textContent = "Could not save your tutorial progress. Please try again.";
      tutorialError.hidden = false;
    }
  } finally {
    tutorialSkip.disabled = tutorialBack.disabled = tutorialNext.disabled = false;
  }
}

tutorialDialog.addEventListener("cancel", event => {
  if (installGuideOnly) return;
  event.preventDefault();
  tutorialSkip.focus();
});
tutorialNext.addEventListener("click", () => {
  if (installGuideOnly) tutorialDialog.close();
  else if (tutorialStep === tutorialSteps.length - 1) completeTutorial();
  else showTutorialStep(tutorialStep + 1);
});
tutorialBack.addEventListener("click", () => showTutorialStep(tutorialStep - 1));
tutorialSkip.addEventListener("click", completeTutorial);
tutorialNickname.addEventListener("input", updateTutorialNickname);
for (const button of tutorialDialog.querySelectorAll("[data-privacy-answer]")) {
  button.addEventListener("click", () => {
    document.querySelector("#tutorialPrivacyFeedback").textContent = button.dataset.privacyAnswer === "animal"
      ? `Right! World Chat shows ${currentUser.username}.`
      : "Try again. Your Private Username is used in DMs and groups.";
  });
}
tutorialDmSearch.addEventListener("input", () => {
  const query = tutorialDmSearch.value.trim().toLowerCase();
  tutorialDmResult.hidden = !query || !"moonmoth".startsWith(query);
  tutorialDmFeedback.textContent = query && tutorialDmResult.hidden ? "No practice results. Try MoonMoth." : "";
});
tutorialDmResult.addEventListener("click", () => {
  tutorialDmFeedback.textContent = "Practice conversation opened. In a real DM, write your message and tap Send.";
});
for (const button of tutorialPracticeMembers) {
  button.addEventListener("click", () => {
    const added = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(added));
    button.textContent = `${added ? "Remove" : "Add"} ${button.dataset.practiceMember}`;
    updateTutorialGroup();
  });
}
tutorialPracticeCreate.addEventListener("click", () => {
  tutorialGroupFeedback.textContent = "Practice group created with you, MoonMoth, and SkyFern.";
});

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

function nextPendingMessageId() {
  return `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sendFailureLabel(error) {
  if (error?.status === 400) return "Couldn't send, inappropriate language";
  return "Couldn't send, try again";
}

function createSendErrorStatus(label) {
  const status = document.createElement("p");
  status.className = "message-send-error";
  status.setAttribute("role", "status");
  const mark = document.createElement("span");
  mark.className = "message-send-error-mark";
  mark.setAttribute("aria-hidden", "true");
  mark.textContent = "!";
  const text = document.createElement("span");
  text.className = "message-send-error-text";
  text.textContent = label;
  status.append(mark, text);
  return status;
}

function markMessageSendFailed(article, label = "Couldn't send, inappropriate language") {
  if (!article) return;
  article.classList.add("message-failed");
  article.classList.remove("message-pending");
  article.querySelector(".message-reply")?.remove();
  let status = article.querySelector(".message-send-error");
  if (!status) {
    status = createSendErrorStatus(label);
    article.querySelector(".message-content")?.append(status);
  } else {
    const text = status.querySelector(".message-send-error-text");
    if (text) text.textContent = label;
  }
}

function promotePendingMessage(container, pendingId, realId) {
  const article = container.querySelector(`[data-message-id="${pendingId}"]`);
  if (!article || realId == null) return;
  const realKey = String(realId);
  const existing = container.querySelector(`[data-message-id="${realKey}"]`);
  if (existing && existing !== article) {
    article.remove();
    return;
  }
  article.dataset.messageId = realKey;
  article.classList.remove("message-pending");
}

function closeMessageMenu() {
  if (!openMessageMenu) return;
  openMessageMenu.button.setAttribute("aria-expanded", "false");
  openMessageMenu.menu.hidden = true;
  openMessageMenu = null;
}

function createMessageActions(message, { onReply, onEdit, canEdit, trigger }) {
  const wrap = document.createElement("div");
  wrap.className = "message-actions";
  const button = trigger;
  button.classList.add("message-interactive");
  button.tabIndex = 0;
  button.setAttribute("aria-label", `Message from ${message.username}. Open reply${canEdit ? " or edit" : ""} menu`);
  button.setAttribute("aria-haspopup", "menu");
  button.setAttribute("aria-expanded", "false");
  const menu = document.createElement("div");
  menu.className = "message-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;

  const replyItem = document.createElement("button");
  replyItem.className = "message-menu-item";
  replyItem.type = "button";
  replyItem.setAttribute("role", "menuitem");
  replyItem.textContent = "Reply";
  replyItem.addEventListener("click", event => {
    event.stopPropagation();
    closeMessageMenu();
    onReply(message);
  });
  menu.append(replyItem);

  if (canEdit) {
    const editItem = document.createElement("button");
    editItem.className = "message-menu-item";
    editItem.type = "button";
    editItem.setAttribute("role", "menuitem");
    editItem.textContent = "Edit";
    editItem.addEventListener("click", event => {
      event.stopPropagation();
      closeMessageMenu();
      onEdit(message);
    });
    menu.append(editItem);
  }

  const toggleMenu = event => {
    event.stopPropagation();
    const willOpen = menu.hidden;
    closeMessageMenu();
    if (!willOpen) return;
    menu.hidden = false;
    button.setAttribute("aria-expanded", "true");
    openMessageMenu = { button, menu };
  };
  button.addEventListener("click", event => {
    if (event.target.closest("a, button, .message-menu")) return;
    if (window.getSelection()?.toString()) return;
    toggleMenu(event);
  });
  button.addEventListener("keydown", event => {
    if (event.target !== button || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    toggleMenu(event);
    if (!menu.hidden) replyItem.focus();
  });

  wrap.append(menu);
  return wrap;
}

function syncComposerMode({ isDm = false } = {}) {
  if (isDm) {
    const editing = Boolean(editingDmMessage);
    dmReplyPreviewLabel.textContent = editing ? "Editing message" : "Replying to";
    dmSendButton.innerHTML = editing
      ? 'Save <span aria-hidden="true">✓</span>'
      : 'Send <span aria-hidden="true">↗</span>';
    return;
  }
  const editing = Boolean(editingMessage);
  replyPreviewLabel.textContent = editing ? "Editing message" : "Replying to";
  sendButton.innerHTML = editing
    ? 'Save <span aria-hidden="true">✓</span>'
    : 'Send <span aria-hidden="true">↗</span>';
}

function addMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  if (message.pending) article.classList.add("message-pending");
  if (message.send_error) article.classList.add("message-failed");
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
  time.textContent = new Date(message.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const text = document.createElement("p");
  text.className = "message-text";
  fillRichText(text, message.text);

  if (message.reply_to) {
    content.append(createReplyQuote(message.reply_to));
  }

  meta.append(author, time);
  if (message.edited && !message.is_deleted && !deleted) {
    const edited = document.createElement("span");
    edited.className = "message-edited";
    edited.textContent = "edited";
    meta.append(edited);
  }
  content.append(meta, text);
  if (message.send_error) {
    content.append(createSendErrorStatus(message.send_error));
  } else if (!message.pending && !message.is_deleted && message.username !== "[DELETED]") {
    const canEdit = Boolean(message.is_own) && Number.isInteger(message.id);
    meta.append(createMessageActions(message, {
      trigger: article,
      canEdit,
      onReply: selectReply,
      onEdit: selectEdit,
    }));
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
  clearEdit();
  replyingTo = {
    id: message.id,
    username: message.username,
    text: message.text,
  };
  replyPreviewText.textContent = `${replyingTo.username}: ${replyingTo.text}`;
  replyPreview.hidden = false;
  messageError.hidden = true;
  syncComposerMode();
  messageInput.focus();
}

function clearReply() {
  replyingTo = null;
  if (!editingMessage) {
    replyPreview.hidden = true;
    replyPreviewText.textContent = "";
    syncComposerMode();
  }
}

function selectEdit(message) {
  if (!message?.is_own || !Number.isInteger(message.id)) return;
  clearReply();
  editingMessage = {
    id: message.id,
    username: message.username,
    text: message.text,
    created_at: message.created_at,
    reply_to: message.reply_to || null,
    edited: Boolean(message.edited),
  };
  replyPreviewText.textContent = message.text;
  replyPreview.hidden = false;
  messageError.hidden = true;
  messageInput.value = message.text;
  messageInput.style.height = "auto";
  messageInput.style.height = `${Math.min(messageInput.scrollHeight, 110)}px`;
  sendButton.disabled = !messageInput.value.trim();
  syncComposerMode();
  messageInput.focus();
  messageInput.setSelectionRange(messageInput.value.length, messageInput.value.length);
}

function clearEdit() {
  editingMessage = null;
  if (!replyingTo) {
    replyPreview.hidden = true;
    replyPreviewText.textContent = "";
  }
  syncComposerMode();
}

function selectDmReply(message) {
  clearDmEdit();
  replyingToDm = {
    id: message.id,
    username: message.username,
    text: message.text,
  };
  dmReplyPreviewText.textContent = `${replyingToDm.username}: ${replyingToDm.text}`;
  dmReplyPreview.hidden = false;
  syncComposerMode({ isDm: true });
  dmMessageInput.focus();
}

function clearDmReply() {
  replyingToDm = null;
  if (!editingDmMessage) {
    dmReplyPreview.hidden = true;
    dmReplyPreviewText.textContent = "";
    syncComposerMode({ isDm: true });
  }
}

function selectDmEdit(message) {
  if (!message?.is_own || !Number.isInteger(message.id) || (!selectedDmUser && !selectedDmGroup)) return;
  clearDmReply();
  editingDmMessage = {
    id: message.id,
    username: message.username,
    text: message.text,
    created_at: message.created_at,
    reply_to: message.reply_to || null,
    edited: Boolean(message.edited),
    avatar_url: message.avatar_url || null,
    animal_username: message.animal_username || currentUser?.username || null,
    display_name: message.display_name || null,
  };
  dmReplyPreviewText.textContent = message.text;
  dmReplyPreview.hidden = false;
  dmMessageError.hidden = true;
  dmMessageInput.value = message.text;
  dmMessageInput.style.height = "auto";
  dmMessageInput.style.height = `${Math.min(dmMessageInput.scrollHeight, 110)}px`;
  dmSendButton.disabled = !dmMessageInput.value.trim();
  syncComposerMode({ isDm: true });
  dmMessageInput.focus();
  dmMessageInput.setSelectionRange(dmMessageInput.value.length, dmMessageInput.value.length);
}

function clearDmEdit() {
  editingDmMessage = null;
  if (!replyingToDm) {
    dmReplyPreview.hidden = true;
    dmReplyPreviewText.textContent = "";
  }
  syncComposerMode({ isDm: true });
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
      loadDmGroups();
      loadDmMessages();
    }
  };
  tick();
  const interval = realtimeReadyTopics.size === 2
    ? REALTIME_SAFETY_SYNC_MS
    : document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
  pollingTimer = setInterval(tick, interval);
  if (currentUser && realtimeSetupFor !== currentUser.id) setupRealtime();
}

async function setupRealtime() {
  if (!currentUser || realtimeSetupFor === currentUser.id) return;
  const accountId = currentUser.id;
  realtimeSetupFor = accountId;
  try {
    const sessionData = await api("/api/session");
    const config = sessionData.realtime;
    if (!config || !currentUser || currentUser.id !== accountId) return;
    if (!await loadSupabaseSdk()) {
      realtimeSetupFor = null;
      return;
    }
    if (!currentUser || currentUser.id !== accountId) return;
    realtimeClient = window.supabase.createClient(config.url, config.anon_key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    await realtimeClient.realtime.setAuth(config.access_token);

    const onRefresh = () => {
      loadMessages();
      if (activeView === "dms") {
        loadDmContacts();
        loadDmMessages();
      }
    };
    const topics = ["pigin:world", `pigin:account:${accountId}`];
    realtimeChannels = topics.map(topic => realtimeClient
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "refresh" }, onRefresh)
      .subscribe(status => {
        if (!currentUser || currentUser.id !== accountId) return;
        if (status === "SUBSCRIBED") realtimeReadyTopics.add(topic);
        else realtimeReadyTopics.delete(topic);
        startPolling();
      }));

    clearInterval(realtimeRefreshTimer);
    realtimeRefreshTimer = setInterval(async () => {
      try {
        const latest = await api("/api/session");
        if (latest.realtime?.access_token) {
          await realtimeClient?.realtime.setAuth(latest.realtime.access_token);
        }
      } catch {}
    }, 50 * 60 * 1000);
  } catch {
    realtimeSetupFor = null;
  }
}

function loadSupabaseSdk() {
  if (window.supabase?.createClient) return Promise.resolve(true);
  if (!supabaseSdkPromise) {
    supabaseSdkPromise = new Promise(resolve => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
      script.async = true;
      script.onload = () => resolve(Boolean(window.supabase?.createClient));
      script.onerror = () => resolve(false);
      document.head.append(script);
    });
  }
  return supabaseSdkPromise;
}

let messagesReloadRequested = false;
async function loadMessages() {
  if (!currentUser) return;
  if (messagesLoading) {
    messagesReloadRequested = true;
    return;
  }
  messagesReloadRequested = false;
  messagesLoading = true;
  try {
    const data = await api(`/api/messages?after=${messageCursor}`);
    const messages = data.messages || [];
    const initialLoad = messageCursor === 0;
    if (initialLoad && !messages.length) {
      if (!feed.querySelector(".message")) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "It's quiet in here.";
        feed.replaceChildren(empty);
      }
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
    syncReadState(data.unread);
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
    feed.querySelector(".loading-indicator")?.remove();
    messagesLoading = false;
    if (messagesReloadRequested) loadMessages();
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
  } finally {
    appLoading.hidden = true;
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

function renderDmGroups(groups) {
  dmGroupContacts.replaceChildren();
  if (!groups.length) {
    const empty = document.createElement("p");
    empty.className = "dm-contact-empty";
    empty.textContent = "Your group chats will appear here.";
    dmGroupContacts.append(empty);
    return;
  }
  for (const group of groups) {
    const button = createDmPersonButton(
      { id: group.id, username: group.name },
      {
        preview: group.last_message || `${group.members.length} members`,
        active: selectedDmGroup?.id === group.id,
        onClick: () => selectDmGroup(group),
      },
    );
    button.classList.add("dm-group-contact");
    dmGroupContacts.append(button);
  }
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
    empty.textContent = `No one matched “${query}”. Try a Private Username, or an animal name if they haven’t set one.`;
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
function renderGroupMemberResults(people, query) {
  const results = document.querySelector("#groupMemberResults");
  results.replaceChildren();
  if (!people.length) {
    const empty = document.createElement("p");
    empty.className = "dm-search-empty";
    empty.textContent = `No one matched “${query}”.`;
    results.append(empty);
    return;
  }
  for (const person of people) {
    const button = createDmPersonButton(person, {
      onClick: () => {
        if (selectedGroupMembers.has(person.id)) selectedGroupMembers.delete(person.id);
        else selectedGroupMembers.set(person.id, person);
        renderGroupSelection();
      },
    });
    results.append(button);
  }
  renderGroupSelection();
}

function renderGroupSelection() {
  const selected = document.querySelector("#groupSelectedMembers");
  selected.replaceChildren();
  for (const person of selectedGroupMembers.values()) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "group-selection-remove";
    remove.textContent = `${person.username} ×`;
    remove.setAttribute("aria-label", `Remove ${person.username} from selected members`);
    remove.addEventListener("click", () => {
      selectedGroupMembers.delete(person.id);
      renderGroupSelection();
      (selected.firstElementChild || document.querySelector("#groupMemberSearch")).focus();
    });
    selected.append(remove);
  }
  for (const result of document.querySelectorAll("#groupMemberResults button")) {
    const added = selectedGroupMembers.has(Number(result.dataset.accountId));
    result.classList.toggle("active", added);
    result.setAttribute("aria-pressed", String(added));
    result.querySelector(".dm-contact-preview").textContent = added ? "✓ Added · select to remove" : "+ Add to group";
  }
  const count = selectedGroupMembers.size;
  document.querySelector("#groupSelectionCount").textContent = count < 2
    ? `${count} selected · Add ${2 - count} more`
    : `${count} selected · ${count + 1} members including you`;
  updateGroupCreateButton();
}

function updateGroupCreateButton() {
  document.querySelector("#createGroupSubmit").disabled =
    selectedGroupMembers.size < 2 || !document.querySelector("#groupNameInput").value.trim();
}

function resetGroupCreation() {
  clearTimeout(groupSearchTimer);
  groupSearchRequest += 1;
  selectedGroupMembers.clear();
  const form = document.querySelector("#groupCreatePanel");
  form.reset();
  form.hidden = true;
  form.querySelector("fieldset").disabled = false;
  const button = document.querySelector("#newGroupButton");
  button.setAttribute("aria-expanded", "false");
  button.textContent = "New group";
  document.querySelector("#groupMemberResults").replaceChildren();
  document.querySelector("#groupCreateError").hidden = true;
  renderGroupSelection();
}

async function searchGroupMembers(query, requestId) {
  try {
    const data = await api(`/api/dms/search?q=${encodeURIComponent(query)}`);
    if (requestId === groupSearchRequest) renderGroupMemberResults(data.results || [], query);
  } catch (error) {
    if (requestId !== groupSearchRequest) return;
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      document.querySelector("#groupCreateError").textContent = error.message;
      document.querySelector("#groupCreateError").hidden = false;
    }
  }
}

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
  const showLoader = !dmContactsSnapshot;
  if (showLoader) dmContacts.replaceChildren(createLoadingIndicator("Loading conversations"));
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
    } else if (selectedDmGroup) {
      showDmConversationPage();
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
    if (showLoader) dmContacts.querySelector(".loading-indicator")?.remove();
    dmContactsLoading = false;
  }
}

async function loadDmGroups() {
  if (!currentUser) return;
  try {
    const data = await api("/api/groups");
    const groups = data.groups || [];
    const snapshot = JSON.stringify(groups);
    const pendingId = pendingDmGroupId;
    if (snapshot === dmGroupsSnapshot && !pendingId) return;
    dmGroupsSnapshot = snapshot;
    if (pendingId) {
      pendingDmGroupId = null;
      clearDmDeepLink();
      const group = groups.find(item => item.id === pendingId);
      if (group) {
        selectDmGroup(group);
        return;
      }
    }
    if (selectedDmGroup) {
      selectedDmGroup = groups.find(group => group.id === selectedDmGroup.id) || null;
      if (!selectedDmGroup) resetDmConversationPane();
      else {
        updateSelectedGroupDetails();
        if (activeView === "dms") showDmConversationPage();
      }
    }
    renderDmGroups(groups);
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

function showDmContactsPage() {
  if (keyboardInput === dmMessageInput) hideMobileKeyboard();
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
  selectedDmGroup = null;
  dmMessageCursor = 0;
  groupMessageCursor = 0;
  dmPollSince = "";
  clearTimeout(groupManageSearchTimer);
  groupManagePeople = [];
  clearDmReply();
  clearDmEdit();
  closeMessageMenu();
  dmFeed.replaceChildren();
  const empty = document.createElement("div");
  empty.className = "empty-state";
  empty.textContent = "Your private conversations will appear here.";
  dmFeed.append(empty);
  document.querySelector("#dmConversationTitle").textContent = "Choose someone to message";
  document.querySelector("#dmConversationSubtitle").textContent = "Search for a username or open an existing conversation.";
  document.querySelector("#groupManagement").hidden = true;
  document.querySelector("#groupManageToggle").hidden = true;
  document.querySelector("#groupManageToggle").setAttribute("aria-expanded", "false");
  conversationDndToggle.hidden = true;
  dmMessageInput.value = "";
  dmMessageInput.disabled = true;
  dmMessageInput.style.height = "34px";
  dmMessageInput.placeholder = "Choose someone to message...";
  dmSendButton.disabled = true;
  dmMessageError.hidden = true;
  syncDmEmojiButtons();
  clearDmSearchResults();
  showDmContactsPage();
  syncDndControls();
}

function selectDmContact(contact) {
  if (keyboardInput === dmMessageInput) hideMobileKeyboard();
  selectedDmUser = contact;
  selectedDmGroup = null;
  dmMessageCursor = 0;
  groupMessageCursor = 0;
  dmPollSince = "";
  clearTimeout(groupManageSearchTimer);
  groupManagePeople = [];
  clearDmReply();
  clearDmEdit();
  closeMessageMenu();
  dmFeed.replaceChildren();
  dmMessageInput.value = "";
  dmMessageInput.style.height = "34px";
  dmMessageInput.disabled = false;
  dmMessageInput.placeholder = `Message ${contact.username}...`;
  dmSendButton.disabled = true;
  syncComposerMode({ isDm: true });
  syncDmEmojiButtons();
  document.querySelector("#dmConversationTitle").textContent = contact.username;
  document.querySelector("#dmConversationSubtitle").textContent = "Private conversation";
  document.querySelector("#groupManagement").hidden = true;
  document.querySelector("#groupManageToggle").hidden = true;
  document.querySelector("#groupManageToggle").setAttribute("aria-expanded", "false");
  renderDmContacts(JSON.parse(dmContactsSnapshot || "[]"));
  renderDmGroups(JSON.parse(dmGroupsSnapshot || "[]"));
  syncDndControls();
  showDmConversationPage();
  showDmError("");
  dmMessageError.hidden = true;
  loadDmMessages();
}

function selectDmGroup(group) {
  if (keyboardInput === dmMessageInput) hideMobileKeyboard();
  selectedDmUser = null;
  selectedDmGroup = group;
  dmMessageCursor = 0;
  groupMessageCursor = 0;
  dmPollSince = "";
  clearTimeout(groupManageSearchTimer);
  groupManagePeople = [];
  clearDmReply();
  clearDmEdit();
  closeMessageMenu();
  document.querySelector("#groupManagement").hidden = true;
  document.querySelector("#groupManageToggle").setAttribute("aria-expanded", "false");
  document.querySelector("#groupAddMemberSearch").value = "";
  document.querySelector("#groupAddMemberResults").replaceChildren();
  showGroupManagementError("");
  dmFeed.replaceChildren();
  dmMessageInput.value = "";
  dmMessageInput.style.height = "34px";
  dmMessageInput.disabled = false;
  dmMessageInput.placeholder = `Message ${group.name}...`;
  dmSendButton.disabled = true;
  syncComposerMode({ isDm: true });
  syncDmEmojiButtons();
  document.querySelector("#groupManageToggle").hidden = false;
  updateSelectedGroupDetails();
  renderDmContacts(JSON.parse(dmContactsSnapshot || "[]"));
  renderDmGroups(JSON.parse(dmGroupsSnapshot || "[]"));
  syncDndControls();
  showDmConversationPage();
  showDmError("");
  dmMessageError.hidden = true;
  loadGroupMessages();
}

function updateSelectedGroupDetails() {
  if (!selectedDmGroup) return;
  document.querySelector("#dmConversationTitle").textContent = selectedDmGroup.name;
  document.querySelector("#dmConversationSubtitle").textContent =
    `${selectedDmGroup.members.length} members: ${selectedDmGroup.members.join(", ")}`;
  const renameInput = document.querySelector("#groupRenameInput");
  if (document.activeElement !== renameInput) renameInput.value = selectedDmGroup.name;

  const memberList = document.querySelector("#groupCurrentMembers");
  memberList.replaceChildren();
  for (const member of selectedDmGroup.member_accounts || []) {
    const row = document.createElement("div");
    row.className = "group-member-row";
    const name = document.createElement("span");
    name.textContent = member.name;
    const remove = document.createElement("button");
    remove.className = "group-member-remove";
    remove.type = "button";
    remove.textContent = member.id === currentUser?.id ? "Leave" : "Remove";
    remove.setAttribute("aria-label", `${member.id === currentUser?.id ? "Leave" : "Remove"} ${member.name}`);
    remove.addEventListener("click", async () => {
      if (member.id !== currentUser?.id && !window.confirm(`Remove ${member.name} from ${selectedDmGroup.name}?`)) return;
      remove.disabled = true;
      try {
        await api(`/api/groups/${selectedDmGroup.id}/members/${member.id}`, { method: "DELETE" });
        dmGroupsSnapshot = "";
        await loadDmGroups();
      } catch (error) {
        if (error.accountDeleted) {
          showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
        } else if (error.status === 401) {
          showLogin();
        } else {
          showGroupManagementError(error.message);
        }
        remove.disabled = false;
      }
    });
    row.append(name, remove);
    memberList.append(row);
  }
  syncDndControls();
}

function showGroupManagementError(message) {
  const error = document.querySelector("#groupManagementError");
  error.textContent = message || "";
  error.hidden = !message;
}

function renderGroupManagementResults(people) {
  const results = document.querySelector("#groupAddMemberResults");
  results.replaceChildren();
  if (!people.length) {
    if (document.querySelector("#groupAddMemberSearch").value.trim()) {
      const empty = document.createElement("p");
      empty.className = "dm-search-empty";
      empty.textContent = "No one matched that search.";
      results.append(empty);
    }
    return;
  }
  const groupId = selectedDmGroup?.id;
  const memberIds = new Set((selectedDmGroup?.member_accounts || []).map(member => member.id));
  for (const person of people.filter(person => !memberIds.has(person.id))) {
    results.append(createDmPersonButton(person, {
      preview: "Tap to add",
      onClick: async () => {
        if (!selectedDmGroup || selectedDmGroup.id !== groupId) return;
        try {
          await api(`/api/groups/${groupId}/members`, {
            method: "POST",
            body: JSON.stringify({ account_id: person.id }),
          });
          document.querySelector("#groupAddMemberSearch").value = "";
          document.querySelector("#groupAddMemberResults").replaceChildren();
          groupManagePeople = [];
          showGroupManagementError("");
          dmGroupsSnapshot = "";
          await loadDmGroups();
        } catch (error) {
          if (error.accountDeleted) {
            showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
          } else if (error.status === 401) {
            showLogin();
          } else {
            showGroupManagementError(error.message);
          }
        }
      },
    }));
  }
}

async function searchGroupManageMembers(query) {
  const trimmed = query.trim();
  if (!trimmed || !selectedDmGroup) {
    groupManagePeople = [];
    renderGroupManagementResults([]);
    return;
  }
  const groupId = selectedDmGroup.id;
  try {
    const data = await api(`/api/dms/search?q=${encodeURIComponent(trimmed)}`);
    if (selectedDmGroup?.id !== groupId) return;
    groupManagePeople = data.results || [];
    renderGroupManagementResults(groupManagePeople);
    showGroupManagementError("");
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      showGroupManagementError(error.message);
    }
  }
}

function addDmMessage(message) {
  const article = document.createElement("article");
  article.className = "message";
  if (message.pending) article.classList.add("message-pending");
  if (message.send_error) article.classList.add("message-failed");
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
  time.textContent = new Date(message.created_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const text = document.createElement("p");
  text.className = "message-text";
  fillRichText(text, message.text);
  if (message.reply_to) content.append(createReplyQuote(message.reply_to));
  meta.append(author, time);
  if (message.edited) {
    const edited = document.createElement("span");
    edited.className = "message-edited";
    edited.textContent = "edited";
    meta.append(edited);
  }
  if (!message.pending && !message.send_error && message.reply_to !== undefined && message.username) {
    meta.append(createMessageActions(message, {
      trigger: article,
      canEdit: Boolean(message.is_own) && Number.isInteger(message.id),
      onReply: selectDmReply,
      onEdit: selectDmEdit,
    }));
  }
  content.append(meta, text);
  if (message.send_error) content.append(createSendErrorStatus(message.send_error));
  article.append(avatar, content);
  const existing = dmFeed.querySelector(`[data-message-id="${message.id}"]`);
  if (existing) existing.replaceWith(article);
  else dmFeed.append(article);
}

let dmReloadRequested = false;
async function loadDmMessages() {
  if (selectedDmGroup) {
    loadGroupMessages();
    return;
  }
  if (!currentUser || !selectedDmUser) return;
  if (dmMessagesLoading) {
    dmReloadRequested = true;
    return;
  }
  dmReloadRequested = false;
  const accountId = selectedDmUser.id;
  dmMessagesLoading = true;
  const showLoader = dmMessageCursor === 0 && !dmFeed.children.length;
  if (showLoader) dmFeed.append(createLoadingIndicator("Loading messages"));
  try {
    const sinceQuery = dmMessageCursor && dmPollSince
      ? `&since=${encodeURIComponent(dmPollSince)}`
      : "";
    const data = await api(`/api/dms/${accountId}?after=${dmMessageCursor}${sinceQuery}`);
    if (selectedDmUser?.id !== accountId) return;
    const messages = data.messages || [];
    const initialLoad = dmMessageCursor === 0;
    if (initialLoad && !messages.length) {
      if (!dmFeed.querySelector(".message")) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "No messages yet. Say hello!";
        dmFeed.replaceChildren(empty);
      }
    }
    for (const message of messages) {
      dmFeed.querySelector(".empty-state")?.remove();
      addDmMessage(message);
    }
    const previousCursor = dmMessageCursor;
    dmMessageCursor = Math.max(dmMessageCursor, data.cursor || 0);
    if (data.server_time) dmPollSince = data.server_time;
    if (messages.length) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const onlyEdits = !initialLoad && messages.every(message => message.id <= previousCursor);
      if (!onlyEdits) {
        scrollToLatestMessage(initialLoad || reducedMotion ? "auto" : "smooth", dmFeed);
      }
    }
    if (initialLoad || messages.length) syncReadState(unreadState, true);
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
    if (selectedDmUser?.id === accountId && showLoader) {
      dmFeed.querySelector(".loading-indicator")?.remove();
    }
    dmMessagesLoading = false;
    if (currentUser && selectedDmUser && (selectedDmUser.id !== accountId || dmReloadRequested)) loadDmMessages();
  }
}

async function loadGroupMessages() {
  if (!currentUser || !selectedDmGroup || groupMessagesLoading) return;
  const groupId = selectedDmGroup.id;
  groupMessagesLoading = true;
  try {
    const sinceQuery = groupMessageCursor && dmPollSince
      ? `&since=${encodeURIComponent(dmPollSince)}`
      : "";
    const data = await api(`/api/groups/${groupId}/messages?after=${groupMessageCursor}${sinceQuery}`);
    if (selectedDmGroup?.id !== groupId) return;
    const messages = data.messages || [];
    if (groupMessageCursor === 0 && !messages.length && !dmFeed.querySelector(".message")) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "No messages yet. Say hello!";
      dmFeed.replaceChildren(empty);
    }
    for (const message of messages) {
      dmFeed.querySelector(".empty-state")?.remove();
      addDmMessage(message);
    }
    const initialLoad = groupMessageCursor === 0;
    const previousCursor = groupMessageCursor;
    groupMessageCursor = Math.max(groupMessageCursor, data.cursor || 0);
    if (data.server_time) dmPollSince = data.server_time;
    if (messages.length) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const onlyEdits = !initialLoad && messages.every(message => message.id <= previousCursor);
      if (!onlyEdits) {
        scrollToLatestMessage(initialLoad || reducedMotion ? "auto" : "smooth", dmFeed);
      }
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
    groupMessagesLoading = false;
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

function readGroupDeepLink() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") !== "dms") return null;
  const groupId = Number(params.get("group"));
  return Number.isInteger(groupId) && groupId > 0 ? groupId : null;
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
  url.searchParams.delete("group");
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
  if (activeView !== view) hideMobileKeyboard();
  activeView = view;
  updateRoomTitle(view);
  if (currentUser) {
    document.querySelector("#animalName").textContent = view === "chat" ? currentUser.username : publicNameFor(currentUser);
  }
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
    else if (selectedDmGroup) showDmConversationPage();
    else showDmContactsPage();
    loadDmContacts();
    loadDmGroups();
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
  renderDmGroups(JSON.parse(dmGroupsSnapshot || "[]"));
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
  dmGroupsSnapshot = "";
  loadDmContacts();
  loadDmGroups();
  loadDmMessages();
});
document.querySelector("#newGroupButton").addEventListener("click", event => {
  const panel = document.querySelector("#groupCreatePanel");
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  event.currentTarget.textContent = panel.hidden ? "New group" : "Close group form";
  if (!panel.hidden) document.querySelector("#groupNameInput").focus();
});
document.querySelector("#groupManageToggle").addEventListener("click", event => {
  const panel = document.querySelector("#groupManagement");
  panel.hidden = !panel.hidden;
  event.currentTarget.setAttribute("aria-expanded", String(!panel.hidden));
  showGroupManagementError("");
});
document.querySelector("#groupRenameForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!selectedDmGroup) return;
  const name = document.querySelector("#groupRenameInput").value.trim();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true;
  showGroupManagementError("");
  try {
    await api(`/api/groups/${selectedDmGroup.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    });
    dmGroupsSnapshot = "";
    await loadDmGroups();
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      showGroupManagementError(error.message);
    }
  } finally {
    button.disabled = false;
  }
});
document.querySelector("#groupAddMemberSearch").addEventListener("input", event => {
  clearTimeout(groupManageSearchTimer);
  const query = event.target.value;
  groupManageSearchTimer = window.setTimeout(() => searchGroupManageMembers(query), 200);
});
document.querySelector("#groupNameInput").addEventListener("input", updateGroupCreateButton);
document.querySelector("#groupMemberSearch").addEventListener("input", event => {
  clearTimeout(groupSearchTimer);
  const requestId = ++groupSearchRequest;
  const query = event.target.value.trim();
  document.querySelector("#groupMemberResults").replaceChildren();
  document.querySelector("#groupCreateError").hidden = true;
  if (query) groupSearchTimer = window.setTimeout(() => searchGroupMembers(query, requestId), 200);
});
document.querySelector("#groupCreatePanel").addEventListener("submit", async event => {
  event.preventDefault();
  const submit = document.querySelector("#createGroupSubmit");
  const fields = event.currentTarget.querySelector("fieldset");
  if (submit.disabled || fields.disabled) return;
  fields.disabled = true;
  const accountId = currentUser.id;
  const selectedMembers = [...selectedGroupMembers.values()];
  const error = document.querySelector("#groupCreateError");
  error.hidden = true;
  try {
    const result = await api("/api/groups", {
      method: "POST",
      body: JSON.stringify({
        name: document.querySelector("#groupNameInput").value,
        member_ids: selectedMembers.map(person => person.id),
      }),
    });
    if (currentUser?.id !== accountId) return;
    const members = [
      publicNameFor(currentUser),
      ...selectedMembers.map(person => person.username),
    ];
    const memberAccounts = [
      { id: currentUser.id, name: publicNameFor(currentUser) },
      ...selectedMembers.map(person => ({ id: person.id, name: person.username })),
    ];
    resetGroupCreation();
    const created = {
      id: result.id,
      name: result.name,
      members,
      member_accounts: memberAccounts,
      last_message: null,
      last_message_at: null,
    };
    const groups = [
      created,
      ...JSON.parse(dmGroupsSnapshot || "[]").filter(group => group.id !== result.id),
    ];
    dmGroupsSnapshot = JSON.stringify(groups);
    renderDmGroups(groups);
    selectDmGroup(created);
    loadDmGroups();
  } catch (requestError) {
    if (currentUser?.id === accountId) {
      error.textContent = requestError.message;
      error.hidden = false;
    }
  } finally {
    if (currentUser?.id === accountId) {
      fields.disabled = false;
      updateGroupCreateButton();
    }
  }
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
      authToken = "";
      try { localStorage.removeItem("pigin-auth-token"); } catch (error) {}
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
    showWelcome();
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
    authToken = data.auth_token || "";
    try {
      if (authToken) localStorage.setItem("pigin-auth-token", authToken);
    } catch (error) {}
    // Confirm the browser retained the session cookie before switching to the
    // room. The bearer token also authenticates this check on browsers that
    // don't retain the Flask session cookie.
    const sessionData = await api("/api/session");
    if (!sessionData.user || sessionData.user.id !== data.user.id) {
      throw new Error("Sign-in succeeded, but this browser didn't keep the session. Try opening PIGIN in Safari and signing in again.");
    }
    csrfToken = sessionData.csrf_token;
    showRoom(sessionData.user);
    if (mode === "create") showAccountCreated(sessionData.user.username);
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
    authToken = "";
    try { localStorage.removeItem("pigin-auth-token"); } catch (error) {}
    showLogin();
    usernameInput.focus();
  } catch (error) {
    if (error.status === 401) showLogin();
  }
});
const deleteUserDialog = document.querySelector("#deleteUserDialog");
const deleteUserConfirm = document.querySelector("#deleteUserConfirm");
const deleteUserForm = document.querySelector("#deleteUserForm");
const deleteUserPassword = document.querySelector("#deleteUserPassword");
const deleteUserError = document.querySelector("#deleteUserError");
const submitDeleteUser = document.querySelector("#submitDeleteUser");
let deletingUser = false;
document.querySelector("#deleteUser").addEventListener("click", () => {
  deleteUserForm.reset();
  deleteUserError.hidden = true;
  deleteUserConfirm.hidden = false;
  deleteUserForm.hidden = true;
  deleteUserDialog.showModal();
});
document.querySelector("#confirmDeleteUser").addEventListener("click", () => {
  deleteUserConfirm.hidden = true;
  deleteUserForm.hidden = false;
  deleteUserPassword.focus();
});
for (const id of ["cancelDeleteUser", "cancelDeleteUserPassword"]) {
  document.querySelector(`#${id}`).addEventListener("click", () => {
    if (!deletingUser) deleteUserDialog.close();
  });
}
deleteUserDialog.addEventListener("cancel", event => {
  if (deletingUser) event.preventDefault();
});
deleteUserDialog.addEventListener("close", () => deleteUserForm.reset());
deleteUserForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (deletingUser) return;
  deletingUser = true;
  submitDeleteUser.disabled = true;
  deleteUserError.hidden = true;
  try {
    await api("/api/account", {
      method: "DELETE",
      body: JSON.stringify({ password: deleteUserPassword.value }),
    });
    deleteUserDialog.close();
    authToken = "";
    try { localStorage.removeItem("pigin-auth-token"); } catch (error) {}
    closeAppNotifications();
    showLogin();
    usernameInput.focus();
  } catch (error) {
    deleteUserPassword.value = "";
    deleteUserError.textContent = error.message;
    deleteUserError.hidden = false;
    deleteUserPassword.focus();
  } finally {
    deletingUser = false;
    submitDeleteUser.disabled = false;
  }
});
pushToggle.addEventListener("click", togglePushNotifications);
worldDndToggle.addEventListener("click", () => toggleChatNotifications("world", 0));
conversationDndToggle.addEventListener("click", () => {
  if (selectedDmGroup) toggleChatNotifications("group", selectedDmGroup.id);
  else if (selectedDmUser) toggleChatNotifications("dm", selectedDmUser.id);
});
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
  const groupId = Number(target.searchParams.get("group"));
  if (Number.isInteger(groupId) && groupId > 0) {
    pendingDmGroupId = groupId;
    pendingDmPartnerId = null;
    setRoomView("dms");
    return;
  }
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
  resizeComposerAfterInput(messageInput);
  messageError.hidden = true;
});
document.querySelector("#cancelReply").addEventListener("click", () => {
  if (editingMessage) {
    messageInput.value = "";
    messageInput.style.height = "34px";
    sendButton.disabled = true;
    clearEdit();
    return;
  }
  clearReply();
});
document.querySelector("#cancelDmReply").addEventListener("click", () => {
  if (editingDmMessage) {
    dmMessageInput.value = "";
    dmMessageInput.style.height = "34px";
    dmSendButton.disabled = true;
    clearDmEdit();
    return;
  }
  clearDmReply();
});
document.querySelector("#messageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text || sendButton.disabled || !currentUser) return;

  if (editingMessage) {
    const editSnapshot = editingMessage;
    if (text === editSnapshot.text) {
      messageInput.value = "";
      messageInput.style.height = "34px";
      clearEdit();
      sendButton.disabled = true;
      return;
    }
    const previous = { ...editSnapshot };
    messageInput.value = "";
    messageInput.style.height = "34px";
    clearEdit();
    messageError.hidden = true;
    sendButton.disabled = true;
    addMessage({
      id: editSnapshot.id,
      username: currentUser.username,
      animal_username: currentUser.username,
      display_name: null,
      avatar_url: null,
      text,
      created_at: editSnapshot.created_at,
      is_own: true,
      is_deleted: false,
      edited: true,
      reply_to: editSnapshot.reply_to,
    });
    try {
      await api(`/api/messages/${editSnapshot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
      });
      loadMessages().catch(() => {});
    } catch (error) {
      addMessage({
        id: previous.id,
        username: currentUser.username,
        animal_username: currentUser.username,
        display_name: null,
        avatar_url: null,
        text: previous.text,
        created_at: previous.created_at,
        is_own: true,
        is_deleted: false,
        edited: Boolean(previous.edited),
        reply_to: previous.reply_to,
        send_error: sendFailureLabel(error),
      });
      if (error.accountDeleted) {
        showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
      } else if (error.status === 401) {
        showLogin();
      }
    } finally {
      sendButton.disabled = !messageInput.value.trim();
    }
    return;
  }

  const replySnapshot = replyingTo;
  const pendingId = nextPendingMessageId();
  const optimistic = {
    id: pendingId,
    username: currentUser.username,
    animal_username: currentUser.username,
    display_name: null,
    avatar_url: null,
    text,
    created_at: new Date().toISOString(),
    is_own: true,
    is_deleted: false,
    reply_to: replySnapshot
      ? { id: replySnapshot.id, username: replySnapshot.username, text: replySnapshot.text }
      : null,
    pending: true,
  };
  messageInput.value = "";
  messageInput.style.height = "34px";
  clearReply();
  messageError.hidden = true;
  sendButton.disabled = true;
  feed.querySelector(".empty-state")?.remove();
  addMessage(optimistic);
  scrollToLatestMessage("auto");
  try {
    const payload = { text };
    if (replySnapshot) payload.reply_to_id = replySnapshot.id;
    const result = await api("/api/messages", { method: "POST", body: JSON.stringify(payload) });
    promotePendingMessage(feed, pendingId, result.id);
    loadMessages().catch(() => {});
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else {
      markMessageSendFailed(feed.querySelector(`[data-message-id="${pendingId}"]`), sendFailureLabel(error));
    }
  } finally {
    sendButton.disabled = !messageInput.value.trim();
  }
});
dmMessageInput.addEventListener("input", () => {
  dmSendButton.disabled = (!selectedDmUser && !selectedDmGroup) || !dmMessageInput.value.trim();
  resizeComposerAfterInput(dmMessageInput);
  dmMessageError.hidden = true;
});
document.querySelector("#dmMessageForm").addEventListener("submit", async event => {
  event.preventDefault();
  const text = dmMessageInput.value.trim();
  if (!text || (!selectedDmUser && !selectedDmGroup) || dmSendButton.disabled || !currentUser) return;

  if (selectedDmGroup) {
    const groupId = selectedDmGroup.id;
    if (editingDmMessage) {
      const editSnapshot = editingDmMessage;
      if (text === editSnapshot.text) {
        dmMessageInput.value = "";
        dmMessageInput.style.height = "34px";
        clearDmEdit();
        dmSendButton.disabled = true;
        return;
      }
      const previous = { ...editSnapshot };
      dmMessageInput.value = "";
      dmMessageInput.style.height = "34px";
      clearDmEdit();
      dmMessageError.hidden = true;
      dmSendButton.disabled = true;
      addDmMessage({
        ...editSnapshot,
        username: publicNameFor(currentUser),
        animal_username: currentUser.username,
        display_name: currentUser.display_name || null,
        avatar_url: currentUser.avatar_url || null,
        text,
        is_own: true,
        edited: true,
      });
      try {
        await api(`/api/groups/${groupId}/messages/${editSnapshot.id}`, {
          method: "PATCH",
          body: JSON.stringify({ text }),
        });
        if (selectedDmGroup?.id === groupId) loadGroupMessages();
        dmGroupsSnapshot = "";
        loadDmGroups();
      } catch (error) {
        if (selectedDmGroup?.id === groupId) {
          addDmMessage({
            ...previous,
            username: publicNameFor(currentUser),
            animal_username: currentUser.username,
            display_name: currentUser.display_name || null,
            avatar_url: currentUser.avatar_url || null,
            is_own: true,
            send_error: sendFailureLabel(error),
          });
        }
        if (error.accountDeleted) {
          showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
        } else if (error.status === 401) {
          showLogin();
        }
      } finally {
        dmSendButton.disabled = (!selectedDmUser && !selectedDmGroup) || !dmMessageInput.value.trim();
      }
      return;
    }
    const replySnapshot = replyingToDm;
    const pendingId = nextPendingMessageId();
    const optimistic = {
      id: pendingId,
      username: publicNameFor(currentUser),
      animal_username: currentUser.username,
      display_name: currentUser.display_name || null,
      avatar_url: currentUser.avatar_url || null,
      text,
      created_at: new Date().toISOString(),
      is_own: true,
      reply_to: replySnapshot
        ? { id: replySnapshot.id, username: replySnapshot.username, text: replySnapshot.text }
        : null,
      pending: true,
    };
    dmMessageInput.value = "";
    dmMessageInput.style.height = "34px";
    clearDmReply();
    dmMessageError.hidden = true;
    dmSendButton.disabled = true;
    dmFeed.querySelector(".empty-state")?.remove();
    addDmMessage(optimistic);
    scrollToLatestMessage("auto", dmFeed);
    try {
      const result = await api(`/api/groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          text,
          ...(replySnapshot ? { reply_to_id: replySnapshot.id } : {}),
        }),
      });
      if (selectedDmGroup?.id === groupId) {
        promotePendingMessage(dmFeed, pendingId, result.id);
        loadGroupMessages();
      }
      dmGroupsSnapshot = "";
      loadDmGroups();
    } catch (error) {
      if (error.accountDeleted) {
        showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
      } else if (error.status === 401) {
        showLogin();
      } else if (selectedDmGroup?.id === groupId) {
        markMessageSendFailed(dmFeed.querySelector(`[data-message-id="${pendingId}"]`), sendFailureLabel(error));
      }
    } finally {
      dmSendButton.disabled = (!selectedDmUser && !selectedDmGroup) || !dmMessageInput.value.trim();
    }
    return;
  }

  if (editingDmMessage) {
    const editSnapshot = editingDmMessage;
    const partnerId = selectedDmUser.id;
    if (text === editSnapshot.text) {
      dmMessageInput.value = "";
      dmMessageInput.style.height = "34px";
      clearDmEdit();
      dmSendButton.disabled = true;
      return;
    }
    const previous = { ...editSnapshot };
    dmMessageInput.value = "";
    dmMessageInput.style.height = "34px";
    clearDmEdit();
    dmMessageError.hidden = true;
    dmSendButton.disabled = true;
    addDmMessage({
      id: editSnapshot.id,
      username: publicNameFor(currentUser),
      animal_username: currentUser.username,
      display_name: currentUser.display_name || null,
      avatar_url: currentUser.avatar_url || null,
      text,
      created_at: editSnapshot.created_at,
      is_own: true,
      edited: true,
      reply_to: editSnapshot.reply_to,
    });
    try {
      await api(`/api/dms/${partnerId}/messages/${editSnapshot.id}`, {
        method: "PATCH",
        body: JSON.stringify({ text }),
      });
      if (selectedDmUser?.id === partnerId) loadDmMessages().catch(() => {});
      dmContactsSnapshot = "";
      loadDmContacts().catch(() => {});
    } catch (error) {
      if (selectedDmUser?.id === partnerId) {
        addDmMessage({
          id: previous.id,
          username: publicNameFor(currentUser),
          animal_username: currentUser.username,
          display_name: currentUser.display_name || null,
          avatar_url: currentUser.avatar_url || null,
          text: previous.text,
          created_at: previous.created_at,
          is_own: true,
          edited: Boolean(previous.edited),
          reply_to: previous.reply_to,
          send_error: sendFailureLabel(error),
        });
      }
      if (error.accountDeleted) {
        showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
      } else if (error.status === 401) {
        showLogin();
      }
    } finally {
      dmSendButton.disabled = (!selectedDmUser && !selectedDmGroup) || !dmMessageInput.value.trim();
    }
    return;
  }

  const partnerId = selectedDmUser.id;
  const replySnapshot = replyingToDm;
  const pendingId = nextPendingMessageId();
  const optimistic = {
    id: pendingId,
    username: publicNameFor(currentUser),
    animal_username: currentUser.username,
    display_name: currentUser.display_name || null,
    avatar_url: currentUser.avatar_url || null,
    text,
    created_at: new Date().toISOString(),
    is_own: true,
    reply_to: replySnapshot
      ? { id: replySnapshot.id, username: replySnapshot.username, text: replySnapshot.text }
      : null,
    pending: true,
  };
  dmMessageInput.value = "";
  dmMessageInput.style.height = "34px";
  clearDmReply();
  dmMessageError.hidden = true;
  dmSendButton.disabled = true;
  dmFeed.querySelector(".empty-state")?.remove();
  addDmMessage(optimistic);
  scrollToLatestMessage("auto", dmFeed);
  try {
    const payload = { text };
    if (replySnapshot) payload.reply_to_id = replySnapshot.id;
    const result = await api(`/api/dms/${partnerId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (selectedDmUser?.id === partnerId) {
      promotePendingMessage(dmFeed, pendingId, result.id);
      loadDmMessages().catch(() => {});
    }
    dmContactsSnapshot = "";
    loadDmContacts().catch(() => {});
  } catch (error) {
    if (error.accountDeleted) {
      showWarning("account", "Your account was deleted by an admin. Sign out to return to the sign-in screen.");
    } else if (error.status === 401) {
      showLogin();
    } else if (selectedDmUser?.id === partnerId) {
      markMessageSendFailed(dmFeed.querySelector(`[data-message-id="${pendingId}"]`), sendFailureLabel(error));
    }
  } finally {
    dmSendButton.disabled = (!selectedDmUser && !selectedDmGroup) || !dmMessageInput.value.trim();
  }
});
document.addEventListener("click", () => closeMessageMenu());
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && openMessageMenu) {
    const trigger = openMessageMenu.button;
    closeMessageMenu();
    trigger.focus();
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
  if (usesMobileKeyboard()) {
    const before = input.value.slice(0, input.selectionStart);
    editWithMobileKeyboard(input, "insert", `${before && !/\s$/.test(before) ? " " : ""}${emoji}`);
    input.focus({ preventScroll: true });
    showMobileKeyboard(input);
    return;
  }
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
    if (!expanded && !usesMobileKeyboard()) search.focus();
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
  if (mobileKeyboard.contains(event.target)) return;
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

const mobileComposer = window.matchMedia("(pointer: coarse)");
const mobileDevice = navigator.userAgentData?.mobile ||
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  (/Mac/i.test(navigator.platform) && navigator.maxTouchPoints > 1);
let physicalKeyboardUsed = false;

function usesMobileKeyboard() {
  return mobileDevice && mobileComposer.matches && !physicalKeyboardUsed;
}
const mobileKeyboard = document.getElementById("mobileKeyboard");
const keyboardHome = mobileKeyboard.parentElement;
const keyboardFeeds = new Map([[messageInput, feed], [dmMessageInput, dmFeed]]);
const keyboardFields = document.querySelectorAll('textarea, input:is([type="text"], [type="search"], [type="password"], :not([type]))');
const keyboardLetters = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const keyboardSymbols = ["1234567890", "-/:;()$&@\"", ".,?!'"];
const keyboardMoreSymbols = ["[]{}#%^*+=", "_\\|~<>`", "€£¥•"];
const keyboardCaret = document.createElement("div");
keyboardCaret.className = "mobile-composer-caret";
keyboardCaret.setAttribute("aria-hidden", "true");
keyboardCaret.hidden = true;
const caretMarker = document.createElement("span");
const caretBefore = document.createTextNode("");
const caretAfter = document.createTextNode("");
keyboardCaret.append(caretBefore, caretMarker, caretAfter);
const caretStyleProperties = [
  "font", "letterSpacing", "textAlign", "textIndent", "direction", "padding",
  "whiteSpace", "overflowWrap", "wordBreak", "tabSize",
];
const caretResizeObserver = new ResizeObserver(() => {
  syncKeyboardCaretStyle();
  positionKeyboardCaret();
  scheduleKeyboardFrame();
});
const pendingComposerResizes = new Set();
let keyboardFrame = 0;
const keyboardStatus = document.createElement("p");
keyboardStatus.className = "mobile-keyboard-status";
keyboardStatus.setAttribute("role", "status");
keyboardStatus.hidden = true;
const graphemes = Intl.Segmenter && new Intl.Segmenter(undefined, { granularity: "grapheme" });
let keyboardInput = null;
let keyboardShift = false;
let lastShiftTap = -Infinity;
let keyboardCaps = false;
let keyboardMode = "letters";

function syncKeyboardCaretStyle() {
  if (!keyboardInput) return;
  const style = getComputedStyle(keyboardInput);
  for (const property of caretStyleProperties) keyboardCaret.style[property] = style[property];
}

function positionKeyboardCaret() {
  const input = keyboardInput;
  if (!input) return;
  Object.assign(keyboardCaret.style, {
    left: `${input.offsetLeft + input.clientLeft}px`,
    top: `${input.offsetTop + input.clientTop}px`,
    width: `${input.clientWidth}px`,
    height: `${input.clientHeight}px`,
  });
}

function updateKeyboardCaret() {
  const input = keyboardInput;
  if (!input || input.disabled || input.selectionStart !== input.selectionEnd) {
    keyboardCaret.hidden = true;
    return;
  }
  const text = input.type === "password" ? "•".repeat(input.value.length) : input.value;
  caretBefore.data = text.slice(0, input.selectionStart);
  caretAfter.data = text.slice(input.selectionStart);
  const markerText = caretAfter.data ? "" : "\u200b";
  if (caretMarker.textContent !== markerText) caretMarker.textContent = markerText;
  keyboardCaret.hidden = false;
  keyboardCaret.scrollTop = input.scrollTop;
  keyboardCaret.scrollLeft = input.scrollLeft;
}

function resizeComposer(input) {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
}

function resizeComposerAfterInput(input) {
  if (keyboardInput !== input) {
    resizeComposer(input);
    return;
  }
  pendingComposerResizes.add(input);
  scheduleKeyboardFrame();
}

function scheduleKeyboardFrame() {
  if (!keyboardFrame && (keyboardInput || pendingComposerResizes.size)) {
    keyboardFrame = requestAnimationFrame(flushKeyboardFrame);
  }
}

function flushKeyboardFrame() {
  keyboardFrame = 0;
  const input = keyboardInput;
  for (const composer of pendingComposerResizes) {
    if (!composer.getClientRects().length) continue;
    const targetFeed = keyboardFeeds.get(composer);
    const nearBottom = targetFeed.scrollHeight - targetFeed.scrollTop - targetFeed.clientHeight < 24;
    resizeComposer(composer);
    if (nearBottom) targetFeed.scrollTop = targetFeed.scrollHeight;
    if (composer === input) positionKeyboardCaret();
  }
  pendingComposerResizes.clear();
  updateKeyboardCaret();
}

function syncMobileKeyboard() {
  hideMobileKeyboard();
  const useCustomKeyboard = usesMobileKeyboard();
  for (const input of keyboardFields) {
    // Read-only also suppresses the native keyboard on browsers that ignore inputmode.
    input.readOnly = useCustomKeyboard;
    if (useCustomKeyboard) input.inputMode = "none";
    else input.removeAttribute("inputmode");
  }
}

function showMobileKeyboard(input) {
  if (!usesMobileKeyboard() || input.matches(":disabled") || input === keyboardInput || !input.getClientRects().length) return;
  hideMobileKeyboard();
  keyboardInput = input;
  keyboardShift = false;
  lastShiftTap = -Infinity;
  keyboardCaps = false;
  keyboardStatus.hidden = true;
  keyboardMode = "letters";
  const targetFeed = keyboardFeeds.get(input);
  const dialog = input.closest("dialog");
  if (dialog) dialog.append(mobileKeyboard);
  renderMobileKeyboard();
  input.after(keyboardCaret);
  caretResizeObserver.observe(input);
  if (targetFeed) {
    caretResizeObserver.observe(input.form);
    resizeComposer(input);
  }
  mobileKeyboard.hidden = false;
  if (targetFeed) scrollToLatestMessage("instant", targetFeed);
  else input.scrollIntoView({ block: "nearest", inline: "nearest" });
  syncKeyboardCaretStyle();
  positionKeyboardCaret();
  updateKeyboardCaret();
}

function hideMobileKeyboard() {
  if (!keyboardInput) return;
  keyboardInput = null;
  caretBefore.data = caretAfter.data = "";
  keyboardCaret.hidden = true;
  keyboardCaret.remove();
  caretResizeObserver.disconnect();
  mobileKeyboard.hidden = true;
  if (mobileKeyboard.parentElement !== keyboardHome) {
    keyboardHome.insertBefore(mobileKeyboard, keyboardHome.querySelector(".app-footer"));
  }
}

function renderMobileKeyboard() {
  const layouts = { letters: keyboardLetters, symbols: keyboardSymbols, more: keyboardMoreSymbols };
  const keys = layouts[keyboardMode].map(row => [...row].map(letter => {
    const value = keyboardShift !== keyboardCaps ? letter.toUpperCase() : letter;
    return [value, "insert", value];
  }));
  const leadingKey = {
    letters: ["⇧", "shift", "", "Shift"],
    symbols: ["#+=", "more", "", "More symbols"],
    more: ["123", "more", "", "Numbers and punctuation"],
  }[keyboardMode];
  keys[2].unshift(leadingKey);
  keys[2].push(["⌫", "delete", "", "Backspace"]);

  const composer = keyboardFeeds.has(keyboardInput);
  const bottomRow = [[keyboardMode === "letters" ? "123" : "ABC", "mode", "", "Switch letters and symbols"]];
  if (keyboardMode !== "letters") bottomRow.push(["Paste", "paste"]);
  else if (composer) bottomRow.push(["", "emoji", "", "Choose an emoji"]);
  bottomRow.push(["space", "insert", " "]);
  bottomRow.push(composer ? ["return", "insert", "\n", "New line"] : ["Done", "hide"]);
  keys.push(bottomRow);

  mobileKeyboard.dataset.layout = keyboardMode;
  mobileKeyboard.replaceChildren(...keys.map((row, index) => {
    const element = document.createElement("div");
    element.className = "mobile-keyboard-row";
    if (index === keys.length - 1) element.classList.add("mobile-keyboard-bottom");
    for (const [label, action, value, accessibleLabel] of row) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      if (action === "emoji") {
        button.append(keyboardInput.form.querySelector(".emoji-button svg").cloneNode(true));
      }
      button.dataset.action = action;
      button.dataset.value = value;
      if (accessibleLabel) button.setAttribute("aria-label", accessibleLabel);

      if (keyboardMode === "letters" && /^[a-z]$/i.test(value)) {
        button.dataset.letter = value.toLowerCase();
      }
      if (value === " ") button.className = "mobile-keyboard-space";
      if (value === "\n") button.className = "mobile-keyboard-return";
      element.append(button);
    }
    return element;
  }), keyboardStatus);
  if (keyboardMode === "letters") updateKeyboardShiftKey();
}

function adjacentCharacter(text, offset, direction) {
  const index = direction < 0 ? offset - 1 : offset;
  if (index < 0 || index >= text.length) return offset;
  const segment = graphemes?.segment(text).containing(index);
  if (segment) return direction < 0 ? segment.index : segment.index + segment.segment.length;
  const character = direction < 0 ? [...text.slice(0, offset)].pop() : [...text.slice(offset)][0];
  return offset + direction * character.length;
}

function composerSnapshot(input) {
  return { value: input.value, start: input.selectionStart, end: input.selectionEnd };
}

function editWithMobileKeyboard(input, action, value = "") {
  const snapshot = composerSnapshot(input);
  let { start, end } = snapshot;
  if (start === end && action === "delete") start = adjacentCharacter(input.value, start, -1);
  if (input.value.slice(start, end) === value) return;
  if (input.maxLength >= 0 && input.value.length - (end - start) + value.length > input.maxLength) return;
  input.setRangeText(value, start, end, "end");
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function pasteWithMobileKeyboard(input) {
  const snapshot = composerSnapshot(input);
  keyboardStatus.hidden = true;
  try {
    const text = await navigator.clipboard.readText();
    const current = composerSnapshot(input);
    if (keyboardInput !== input || input.matches(":disabled") || current.value !== snapshot.value ||
        current.start !== snapshot.start || current.end !== snapshot.end) return;
    const available = input.maxLength - input.value.length + snapshot.end - snapshot.start;
    const normalized = input.tagName === "TEXTAREA" ? text.replace(/\r\n?/g, "\n") : text.replace(/[\r\n]/g, "");
    let clipped = input.maxLength < 0 ? normalized : normalized.slice(0, Math.max(0, available));
    if (/[\uD800-\uDBFF]$/.test(clipped)) clipped = clipped.slice(0, -1);
    if (clipped) editWithMobileKeyboard(input, "insert", clipped);
  } catch {
    if (keyboardInput !== input) return;
    keyboardStatus.textContent = "Clipboard access is unavailable.";
    keyboardStatus.hidden = false;
  }
}

for (const input of keyboardFields) {
  input.addEventListener("focus", () => showMobileKeyboard(input));
  input.addEventListener("click", () => {
    showMobileKeyboard(input);
    scheduleKeyboardFrame();
  });
  input.addEventListener("select", scheduleKeyboardFrame);
  input.addEventListener("scroll", scheduleKeyboardFrame);
  input.form?.addEventListener("submit", () => {
    pendingComposerResizes.delete(input);
    scheduleKeyboardFrame();
  });
}
document.addEventListener("selectionchange", scheduleKeyboardFrame);

const immediateKeyboardActions = new Set(["insert", "delete", "shift"]);
const handledKeyboardPresses = new WeakSet();
function nearestTypingKey(event) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return null;
  if (event.target.closest(".mobile-keyboard-status")) return null;
  const { clientX: x, clientY: y } = event;
  const rows = [...mobileKeyboard.querySelectorAll(".mobile-keyboard-row")];
  const bounds = rows.map(row => row.getBoundingClientRect());
  // Split the gaps between rows at their midpoints.
  if (!bounds.length || y < bounds[0].top || y > bounds.at(-1).bottom + 5) return null;
  const index = bounds.findIndex((rect, i) => i === bounds.length - 1 || y <= (rect.bottom + bounds[i + 1].top) / 2);
  const buttons = [...rows[index].querySelectorAll("button")];
  for (const [i, button] of buttons.entries()) {
    if (i === buttons.length - 1) return button;
    const right = button.getBoundingClientRect().right;
    const nextLeft = buttons[i + 1].getBoundingClientRect().left;
    if (x <= (right + nextLeft) / 2) return button;
  }
  return null;
}

mobileKeyboard.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  const direct = event.target.closest("button");
  const button = direct ?? nearestTypingKey(event);
  if (!button) return;
  if (direct || immediateKeyboardActions.has(button.dataset.action)) event.preventDefault();
  if (!immediateKeyboardActions.has(button.dataset.action)) return;
  handledKeyboardPresses.add(button);
  activateMobileKey(button, event);
});
mobileKeyboard.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (event.detail > 0 && handledKeyboardPresses.has(button)) return;
  activateMobileKey(button, event);
});

function updateKeyboardLetterCase() {
  const uppercase = keyboardShift !== keyboardCaps;
  for (const button of mobileKeyboard.querySelectorAll("[data-letter]")) {
    const value = uppercase ? button.dataset.letter.toUpperCase() : button.dataset.letter;
    button.dataset.value = value;
    button.textContent = value;
  }
  updateKeyboardShiftKey();
}

function updateKeyboardShiftKey() {
  const shift = mobileKeyboard.querySelector('[data-action="shift"]');
  shift.textContent = keyboardCaps ? "CAPS LOCK" : "⇧";
  shift.toggleAttribute("data-caps-lock", keyboardCaps);
  shift.setAttribute("aria-pressed", String(keyboardShift || keyboardCaps));
  shift.setAttribute("aria-label", keyboardCaps ? "Turn off Caps Lock" : "Shift");
}

function activateMobileKey(button, event) {
  if (!keyboardInput || keyboardInput.matches(":disabled")) return;
  const { action, value } = button.dataset;
  if (action === "hide") {
    if (mobileKeyboard.contains(document.activeElement)) keyboardInput.focus({ preventScroll: true });
    hideMobileKeyboard();
    return;
  }
  const restoreFocus = document.activeElement === button;
  switch (action) {
    case "shift": {
      const now = performance.now();
      const doubleTap = now - lastShiftTap < 400;
      if (keyboardCaps || doubleTap) {
        keyboardCaps = !keyboardCaps;
        keyboardShift = false;
        lastShiftTap = -Infinity;
      } else {
        keyboardShift = !keyboardShift;
        lastShiftTap = now;
      }
      updateKeyboardLetterCase();
      return;
    }
    case "mode": keyboardMode = keyboardMode === "letters" ? "symbols" : "letters"; break;
    case "more": keyboardMode = keyboardMode === "symbols" ? "more" : "symbols"; break;
    case "emoji":
      event.stopPropagation();
      keyboardInput.form.querySelector(".emoji-button").click();
      return;
    case "paste": pasteWithMobileKeyboard(keyboardInput); return;
    default:
      editWithMobileKeyboard(keyboardInput, action, value);
      if (!keyboardShift || !/^[A-Z]$/i.test(value)) return;
      keyboardShift = false;
      lastShiftTap = -Infinity;
      updateKeyboardLetterCase();
      return;
  }
  if (keyboardMode !== "letters") keyboardShift = false;
  renderMobileKeyboard();
  if (restoreFocus) {
    mobileKeyboard.querySelector(`[data-action="${action}"]`)?.focus({ preventScroll: true });
  }
}
function dismissKeyboardOutsideInput(event) {
  if (!keyboardInput || event.target === keyboardInput || mobileKeyboard.contains(event.target)) return;
  const emojiWrap = event.target.closest(".emoji-picker-wrap");
  if (emojiWrap && emojiWrap.closest("form") === keyboardInput.form) return;
  hideMobileKeyboard();
}
document.addEventListener("pointerdown", dismissKeyboardOutsideInput);
document.addEventListener("focusin", dismissKeyboardOutsideInput);
for (const dialog of document.querySelectorAll("dialog")) {
  dialog.addEventListener("close", () => {
    if (dialog.contains(keyboardInput)) hideMobileKeyboard();
  });
}
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && keyboardInput) hideMobileKeyboard();
});
function detectPhysicalKeyboard(event) {
  if (!usesMobileKeyboard() || !event.isTrusted || event.isComposing ||
      !event.key || event.key === "Unidentified" || event.key === "Process") return;
  // Ignore key events from editable controls that still use the native keyboard.
  if (event.target.closest?.("input, textarea, select, [contenteditable]") && !event.target.readOnly) return;
  physicalKeyboardUsed = true;
  // Restore editability before the browser handles the key's default action.
  const focusedInput = mobileKeyboard.contains(document.activeElement) ? keyboardInput : null;
  syncMobileKeyboard();
  focusedInput?.focus({ preventScroll: true });
}

document.addEventListener("keydown", detectPhysicalKeyboard, true);
mobileComposer.addEventListener("change", syncMobileKeyboard);
syncMobileKeyboard();

syncDmEmojiButtons();
initialize();
