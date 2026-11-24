import {
  createChatClient,
  findUsers,
  loadConversations,
  loadMessages,
  openDirectConversation,
  postMessage,
  toggleReaction
} from "./chat-service.js";

const conversations = [];

const elements = {
  app: document.querySelector(".app-shell"),
  authScreen: document.querySelector("#authScreen"),
  appShell: document.querySelector("#appShell"),
  backendSetup: document.querySelector("#backendSetup"),
  backendConfigForm: document.querySelector("#backendConfigForm"),
  supabaseUrl: document.querySelector("#supabaseUrl"),
  supabaseAnonKey: document.querySelector("#supabaseAnonKey"),
  authPanel: document.querySelector("#authPanel"),
  authForm: document.querySelector("#authForm"),
  authTitle: document.querySelector("#authTitle"),
  authSubtitle: document.querySelector("#authSubtitle"),
  usernameField: document.querySelector("#usernameField"),
  displayNameField: document.querySelector("#displayNameField"),
  authUsername: document.querySelector("#authUsername"),
  authDisplayName: document.querySelector("#authDisplayName"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authSubmitButton: document.querySelector("#authSubmitButton"),
  authModeButton: document.querySelector("#authModeButton"),
  changeBackendButton: document.querySelector("#changeBackendButton"),
  authError: document.querySelector("#authError"),
  accountName: document.querySelector("#accountName"),
  signOutButton: document.querySelector("#signOutButton"),
  chatList: document.querySelector("#chatList"),
  newChatButton: document.querySelector("#newChatButton"),
  chatSearch: document.querySelector("#chatSearch"),
  messageList: document.querySelector("#messageList"),
  headerName: document.querySelector("#headerName"),
  headerStatus: document.querySelector("#headerStatus"),
  headerAvatar: document.querySelector("#headerAvatar"),
  messageForm: document.querySelector("#messageForm"),
  messageInput: document.querySelector("#messageInput"),
  characterCount: document.querySelector("#characterCount"),
  unreadCount: document.querySelector("#unreadCount"),
  replyPreview: document.querySelector("#replyPreview"),
  replyPreviewSender: document.querySelector("#replyPreviewSender"),
  replyPreviewText: document.querySelector("#replyPreviewText"),
  clearReplyButton: document.querySelector("#clearReplyButton"),
  fileInput: document.querySelector("#fileInput"),
  pickFileButton: document.querySelector("#pickFileButton"),
  attachmentQueue: document.querySelector("#attachmentQueue"),
  quickReplyForm: document.querySelector("#quickReplyForm"),
  quickReplyInput: document.querySelector("#quickReplyInput"),
  notificationSender: document.querySelector("#notificationSender"),
  notificationMessage: document.querySelector("#notificationMessage"),
  notificationAvatar: document.querySelector("#notificationAvatar"),
  notificationTime: document.querySelector("#notificationTime"),
  pinButton: document.querySelector("#pinButton"),
  focusButton: document.querySelector("#focusButton"),
  focusTextButton: document.querySelector("#focusTextButton"),
  notificationButton: document.querySelector("#notificationButton"),
  newChatDialog: document.querySelector("#newChatDialog"),
  closeNewChatDialog: document.querySelector("#closeNewChatDialog"),
  userSearchForm: document.querySelector("#userSearchForm"),
  userSearchInput: document.querySelector("#userSearchInput"),
  userSearchResults: document.querySelector("#userSearchResults"),
  checkUpdatesButton: document.querySelector("#checkUpdatesButton"),
  updateDialog: document.querySelector("#updateDialog"),
  updateTitle: document.querySelector("#updateTitle"),
  updateMessage: document.querySelector("#updateMessage"),
  releaseLink: document.querySelector("#releaseLink"),
  checkAgainButton: document.querySelector("#checkAgainButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  notificationsSetting: document.querySelector("#notificationsSetting"),
  animationsSetting: document.querySelector("#animationsSetting"),
  autostartSetting: document.querySelector("#autostartSetting"),
  toastRegion: document.querySelector("#toastRegion"),
  typingIndicator: document.querySelector("#typingIndicator"),
  typingName: document.querySelector("#typingName")
};

let activeConversationId = null;
let notificationConversationId = null;
let replyDraft = null;
let unreadOnly = false;
let toastTimer;
let supabaseClient = null;
let currentUser = null;
let authMode = "signin";
let messageChannels = [];
let membershipChannel = null;
let authSubscription = null;
const selectedFiles = [];
const maxFileSize = 10 * 1024 * 1024;
const supabaseUrlKey = "supabase-project-url";
const supabaseAnonKey = "supabase-public-anon-key";
const latestReleaseUrl = "https://api.github.com/repos/mme1212012-boop/-dasda2314/releases/latest";
const settings = {
  notifications: readSetting("notifications-enabled", true),
  animations: readSetting("animations-enabled", true),
  autostart: readSetting("autostart-enabled", true)
};

function readSetting(key, defaultValue) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? defaultValue : stored === "true";
  } catch (error) {
    showToast("Không đọc được cài đặt", String(error));
    return defaultValue;
  }
}

function activeConversation() {
  return conversations.find((conversation) => conversation.id === activeConversationId) ?? null;
}

function escapeText(value) {
  return String(value);
}

function renderChatList() {
  const query = elements.chatSearch.value.trim().toLocaleLowerCase("vi");
  const unreadTotal = conversations.filter((conversation) => conversation.unread).length;
  elements.unreadCount.textContent = String(unreadTotal);
  elements.unreadCount.hidden = unreadTotal === 0;
  const filtered = conversations
    .filter((conversation) => {
      const lastMessage = conversation.messages.at(-1)?.text ?? "";
      return (!unreadOnly || conversation.unread) &&
        `${conversation.name} ${lastMessage}`.toLocaleLowerCase("vi").includes(query);
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned));

  elements.chatList.replaceChildren();
  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = conversations.length === 0
      ? "Chưa có cuộc trò chuyện. Nhấn + để tìm người dùng."
      : unreadOnly && query === ""
        ? "Không có tin nhắn chưa đọc."
        : "Không tìm thấy cuộc trò chuyện.";
    elements.chatList.append(empty);
    return;
  }

  for (const conversation of filtered) {
    const button = document.createElement("button");
    button.className = `chat-item${conversation.id === activeConversationId ? " is-selected" : ""}`;
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-current", conversation.id === activeConversationId ? "true" : "false");

    const avatar = document.createElement("span");
    avatar.className = `avatar ${conversation.color}`;
    avatar.textContent = conversation.initials;
    avatar.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "chat-item-copy";
    const top = document.createElement("span");
    top.className = "chat-item-top";
    const name = document.createElement("span");
    name.className = "chat-item-name";
    name.textContent = `${conversation.pinned ? "★ " : ""}${conversation.name}`;
    const time = document.createElement("time");
    time.textContent = conversation.messages.at(-1)?.time ?? "";
    top.append(name, time);

    const bottom = document.createElement("span");
    bottom.className = "chat-item-bottom";
    const preview = document.createElement("span");
    preview.className = "chat-item-preview";
    preview.textContent = conversation.messages.at(-1)?.text ?? "";
    bottom.append(preview);
    if (conversation.unread) {
      const unread = document.createElement("span");
      unread.className = "chat-unread";
      unread.setAttribute("aria-label", "Tin nhắn chưa đọc");
      bottom.append(unread);
    }

    copy.append(top, bottom);
    button.append(avatar, copy);
    button.addEventListener("click", () => selectConversation(conversation.id));
    elements.chatList.append(button);
  }
}

function renderMessages() {
  const conversation = activeConversation();
  elements.messageList.replaceChildren();
  const composerDisabled = !conversation;
  elements.messageInput.disabled = composerDisabled;
  elements.pickFileButton.disabled = composerDisabled;
  elements.messageForm.querySelector('button[type="submit"]').disabled = composerDisabled;
  elements.pinButton.disabled = composerDisabled;
  if (!conversation) {
    elements.headerName.textContent = "Chọn một cuộc trò chuyện";
    elements.headerStatus.textContent = "Tin nhắn được đồng bộ trực tuyến";
    elements.headerAvatar.textContent = "✦";
    elements.headerAvatar.className = "avatar avatar-contact";
    elements.pinButton.classList.remove("is-active");
    elements.pinButton.setAttribute("aria-pressed", "false");
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = conversations.length
      ? "Chọn một người trong danh sách để bắt đầu nhắn tin."
      : "Nhấn nút + để tìm người dùng và bắt đầu trò chuyện.";
    elements.messageList.append(empty);
    renderChatList();
    return;
  }

  elements.headerName.textContent = conversation.name;
  elements.headerStatus.textContent = conversation.status;
  elements.headerAvatar.textContent = conversation.initials;
  elements.headerAvatar.className = `avatar avatar-contact ${conversation.color}`;
  elements.pinButton.classList.toggle("is-active", conversation.pinned);
  elements.pinButton.textContent = conversation.pinned ? "★" : "☆";
  elements.pinButton.setAttribute("aria-pressed", String(conversation.pinned));
  elements.typingName.textContent = conversation.name;

  for (const message of conversation.messages) {
    const row = document.createElement("article");
    row.className = `message-row${message.mine ? " is-mine" : ""}`;

    if (!message.mine) {
      const avatar = document.createElement("span");
      avatar.className = `message-avatar ${conversation.color}`;
      avatar.textContent = conversation.initials;
      avatar.setAttribute("aria-hidden", "true");
      row.append(avatar);
    }

    const stack = document.createElement("div");
    stack.className = "message-stack";
    if (message.replyTo) {
      const quote = document.createElement("div");
      quote.className = "reply-quote";
      const sender = document.createElement("strong");
      sender.textContent = message.replyTo.sender;
      const text = document.createElement("span");
      text.textContent = message.replyTo.text;
      quote.append(sender, text);
      stack.append(quote);
    }

    if (message.text) {
      const bubble = document.createElement("div");
      bubble.className = "message-bubble";
      bubble.textContent = escapeText(message.text);
      stack.append(bubble);
    }

    for (const attachment of message.attachments ?? []) {
      const link = document.createElement("a");
      link.className = "file-attachment";
      link.href = attachment.url;
      link.download = attachment.name;
      link.setAttribute("aria-label", `Tải xuống ${attachment.name}`);
      const fileIcon = document.createElement("span");
      fileIcon.className = "file-icon";
      fileIcon.textContent = attachment.name.split(".").at(-1).slice(0, 4).toUpperCase();
      const fileInfo = document.createElement("span");
      fileInfo.className = "file-info";
      const fileName = document.createElement("span");
      fileName.className = "file-name";
      fileName.textContent = attachment.name;
      const fileSize = document.createElement("span");
      fileSize.className = "file-size";
      fileSize.textContent = formatFileSize(attachment.size);
      fileInfo.append(fileName, fileSize);
      link.append(fileIcon, fileInfo);
      stack.append(link);
    }

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const time = document.createElement("time");
    time.textContent = message.time;
    meta.append(time);

    const reaction = document.createElement("button");
    reaction.className = `reaction-button${message.reaction ? " is-reacted" : ""}`;
    reaction.type = "button";
    reaction.textContent = message.reactionCount > 0 ? `♥ ${message.reactionCount}` : "♡";
    reaction.setAttribute("aria-label", message.reaction ? "Bỏ thả tim" : "Thả tim");
    reaction.setAttribute("aria-pressed", String(Boolean(message.reaction)));
    reaction.addEventListener("click", () => toggleMessageReaction(conversation, message));
    meta.append(reaction);
    const reply = document.createElement("button");
    reply.className = "reply-button";
    reply.type = "button";
    reply.textContent = "↩";
    reply.setAttribute("aria-label", "Trả lời tin nhắn");
    reply.addEventListener("click", () => {
      replyDraft = {
        sender: message.mine ? "Bạn" : conversation.name,
        text: message.text || message.attachments?.map((attachment) => attachment.name).join(", ") || "Tệp đính kèm"
      };
      renderReplyPreview();
      elements.messageInput.focus();
    });
    meta.append(reply);
    stack.append(meta);
    row.append(stack);
    elements.messageList.append(row);
  }

  elements.messageList.scrollTop = elements.messageList.scrollHeight;
  renderChatList();
}

function updateNotification(conversation, message) {
  notificationConversationId = conversation.id;
  elements.notificationSender.textContent = conversation.name;
  elements.notificationMessage.textContent = message.text ||
    (message.attachments ?? []).map((attachment) => attachment.name).join(", ");
  elements.notificationAvatar.textContent = conversation.initials;
  elements.notificationAvatar.className = `notification-avatar ${conversation.color}`;
  elements.notificationTime.textContent = "vừa xong";
  elements.quickReplyInput.disabled = false;
  elements.quickReplyForm.querySelector('button[type="submit"]').disabled = false;
}

function notifyIncomingMessage(conversation, message) {
  updateNotification(conversation, message);
  if (!settings.notifications) return;
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;
  const summary = message.text ||
    (message.attachments ?? []).map((attachment) => attachment.name).join(", ") ||
    "Bạn nhận được một tệp đính kèm.";
  invoke("show_message_notification", {
    conversationId: conversation.id,
    sender: conversation.name,
    message: summary
  }).catch((error) => {
    showToast("Không gửi được thông báo", String(error));
  });
}

function showToast(title, text) {
  window.clearTimeout(toastTimer);
  const toast = document.createElement("div");
  toast.className = "toast";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const body = document.createElement("p");
  body.textContent = text;
  toast.append(heading, body);
  elements.toastRegion.replaceChildren(toast);
  toastTimer = window.setTimeout(() => elements.toastRegion.replaceChildren(), 3600);
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(key, String(value));
  } catch (error) {
    showToast("Không lưu được cài đặt", String(error));
  }
}

function showAuthError(message) {
  elements.authError.textContent = message;
  elements.authError.hidden = false;
}

function showAuthScreen(showBackendSetup) {
  elements.authScreen.hidden = false;
  elements.appShell.hidden = true;
  elements.backendSetup.hidden = !showBackendSetup;
  elements.authPanel.hidden = showBackendSetup;
  elements.authError.hidden = true;
}

function setAuthMode(mode) {
  authMode = mode;
  const isSignUp = mode === "signup";
  elements.usernameField.hidden = !isSignUp;
  elements.displayNameField.hidden = !isSignUp;
  elements.authTitle.textContent = isSignUp ? "Tạo tài khoản" : "Đăng nhập";
  elements.authSubtitle.textContent = isSignUp
    ? "Tạo tên người dùng để bạn bè có thể tìm thấy bạn."
    : "Đăng nhập để mở cuộc trò chuyện của bạn.";
  elements.authSubmitButton.innerHTML = isSignUp
    ? 'Tạo tài khoản <span aria-hidden="true">↗</span>'
    : 'Đăng nhập <span aria-hidden="true">↗</span>';
  elements.authModeButton.textContent = isSignUp
    ? "Đã có tài khoản? Đăng nhập"
    : "Tạo tài khoản mới";
  elements.authPassword.autocomplete = isSignUp ? "new-password" : "current-password";
  elements.authUsername.required = isSignUp;
  elements.authDisplayName.required = isSignUp;
  elements.authError.hidden = true;
}

async function disconnectRealtime() {
  const channels = messageChannels;
  messageChannels = [];
  if (membershipChannel) channels.push(membershipChannel);
  membershipChannel = null;
  if (supabaseClient && channels.length) {
    await Promise.all(channels.map((channel) => supabaseClient.removeChannel(channel)));
  }
}

async function subscribeToConversations() {
  await disconnectRealtime();
  if (!supabaseClient || !currentUser) return;

  membershipChannel = supabaseClient
    .channel(`memberships:${currentUser.id}`)
    .on("postgres_changes", {
      event: "INSERT",
      schema: "public",
      table: "conversation_members",
      filter: `user_id=eq.${currentUser.id}`
    }, () => {
      void refreshConversations().catch((error) => {
        showToast("Không cập nhật được cuộc trò chuyện", String(error));
      });
    })
    .subscribe((status) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        showToast("Mất kết nối đồng bộ", "Kiểm tra mạng và cấu hình Supabase.");
      }
    });

  for (const conversation of conversations) {
    const channel = supabaseClient
      .channel(`conversation:${conversation.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversation.id}`
      }, (payload) => {
        void handleRealtimeMessage(payload.new).catch((error) => {
          showToast("Không tải được tin nhắn mới", String(error));
        });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "message_reactions",
        filter: `conversation_id=eq.${conversation.id}`
      }, () => {
        void refreshMessages(conversation).catch((error) => {
          showToast("Không cập nhật được lượt thích", String(error));
        });
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          showToast("Mất kết nối đồng bộ", "Tin nhắn mới sẽ đồng bộ khi kết nối lại.");
        }
      });
    messageChannels.push(channel);
  }
}

async function refreshMessages(conversation) {
  const messages = await loadMessages(supabaseClient, [conversation.id], currentUser.id);
  conversation.messages = messages;
  if (conversation.id === activeConversationId) renderMessages();
  else renderChatList();
}

async function handleRealtimeMessage(row) {
  let conversation = conversations.find((item) => item.id === row.conversation_id);
  if (!conversation) {
    await refreshConversations();
    conversation = conversations.find((item) => item.id === row.conversation_id);
  }
  if (!conversation) return;

  const messages = await loadMessages(supabaseClient, [conversation.id], currentUser.id);
  const message = messages.find((item) => item.id === row.id);
  if (message) mergeMessage(conversation, message);
}

async function refreshConversations() {
  if (!supabaseClient || !currentUser) return;
  const previousSelection = activeConversationId;
  const loaded = await loadConversations(supabaseClient, currentUser.id);
  conversations.splice(0, conversations.length, ...loaded);
  activeConversationId = conversations.some((item) => item.id === previousSelection)
    ? previousSelection
    : conversations[0]?.id ?? null;
  await subscribeToConversations();
  renderMessages();
}

async function activateSession(session) {
  if (!session?.user) {
    currentUser = null;
    conversations.splice(0);
    activeConversationId = null;
    await disconnectRealtime();
    renderMessages();
    showAuthScreen(!supabaseClient);
    if (supabaseClient) setAuthMode(authMode);
    return;
  }

  const userChanged = currentUser?.id !== session.user.id;
  currentUser = session.user;
  elements.authScreen.hidden = true;
  elements.appShell.hidden = false;
  elements.accountName.textContent = `@${session.user.user_metadata?.username || session.user.email}`;
  if (userChanged || conversations.length === 0) await refreshConversations();
  else renderMessages();
}

async function configureSupabase(urlValue, keyValue) {
  const parsedUrl = new URL(urlValue.trim());
  if (parsedUrl.protocol !== "https:" &&
      !(parsedUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedUrl.hostname))) {
    throw new Error("Project URL cần dùng HTTPS (localhost được phép để thử nghiệm).");
  }
  const url = parsedUrl.origin;
  const key = keyValue.trim();
  if (key.length < 20) throw new Error("Public anon key không hợp lệ.");
  if (/^sb_secret_/i.test(key) || jwtRole(key) === "service_role") {
    throw new Error("Không thể dùng service-role/secret key trong ứng dụng.");
  }

  if (authSubscription) {
    await authSubscription.unsubscribe();
    authSubscription = null;
  }
  await disconnectRealtime();
  const client = createChatClient(url, key);
  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  supabaseClient = client;
  localStorage.setItem(supabaseUrlKey, url);
  localStorage.setItem(supabaseAnonKey, key);
  authSubscription = client.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      void activateSession(session).catch((sessionError) => {
        showToast("Không thể tải cuộc trò chuyện", String(sessionError));
      });
    }, 0);
  }).data.subscription;
  elements.backendSetup.hidden = true;
  elements.authPanel.hidden = false;
  setAuthMode("signin");
  await activateSession(data.session);
}

function jwtRole(key) {
  const encodedPayload = key.split(".")[1];
  if (!encodedPayload) return null;
  try {
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    return JSON.parse(atob(padded)).role ?? null;
  } catch {
    return null;
  }
}

async function initializeBackend() {
  const url = localStorage.getItem(supabaseUrlKey);
  const key = localStorage.getItem(supabaseAnonKey);
  if (!url || !key) {
    showAuthScreen(true);
    return;
  }
  elements.supabaseUrl.value = url;
  elements.supabaseAnonKey.value = key;
  showAuthScreen(true);
  try {
    await configureSupabase(url, key);
  } catch (error) {
    showAuthScreen(true);
    showAuthError(`Không kết nối được cấu hình Supabase: ${String(error)}`);
  }
}

elements.backendConfigForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.authError.hidden = true;
  try {
    await configureSupabase(elements.supabaseUrl.value, elements.supabaseAnonKey.value);
  } catch (error) {
    showAuthError(String(error));
  }
});

elements.authModeButton.addEventListener("click", () => {
  setAuthMode(authMode === "signin" ? "signup" : "signin");
});

elements.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.authError.hidden = true;
  elements.authSubmitButton.disabled = true;
  try {
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;
    if (authMode === "signup") {
      const username = elements.authUsername.value.trim().toLocaleLowerCase("en");
      const displayName = elements.authDisplayName.value.trim() || username;
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { username, display_name: displayName } }
      });
      if (error) throw error;
      if (data.session) {
        await activateSession(data.session);
      } else {
        elements.authError.textContent = "Tài khoản đã tạo. Hãy xác minh email rồi đăng nhập.";
        elements.authError.hidden = false;
      }
    } else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if (error) throw error;
      await activateSession(data.session);
    }
  } catch (error) {
    showAuthError(String(error));
  } finally {
    elements.authSubmitButton.disabled = false;
  }
});

elements.changeBackendButton.addEventListener("click", async () => {
  if (authSubscription) await authSubscription.unsubscribe();
  authSubscription = null;
  await disconnectRealtime();
  await supabaseClient?.auth.signOut();
  supabaseClient = null;
  currentUser = null;
  conversations.splice(0);
  activeConversationId = null;
  localStorage.removeItem(supabaseUrlKey);
  localStorage.removeItem(supabaseAnonKey);
  elements.backendSetup.hidden = false;
  elements.authPanel.hidden = true;
  elements.authError.hidden = true;
  elements.appShell.hidden = true;
  elements.authScreen.hidden = false;
});

elements.signOutButton.addEventListener("click", async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
  } catch (error) {
    showToast("Không đăng xuất được", String(error));
  }
});

function formatFileSize(size) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function renderAttachmentQueue() {
  elements.attachmentQueue.replaceChildren();
  elements.attachmentQueue.hidden = selectedFiles.length === 0;
  selectedFiles.forEach((file, index) => {
    const item = document.createElement("span");
    item.className = "queued-file";
    const name = document.createElement("span");
    name.className = "queued-file-name";
    name.textContent = `${file.name} · ${formatFileSize(file.size)}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Bỏ tệp ${file.name}`);
    remove.addEventListener("click", () => {
      selectedFiles.splice(index, 1);
      renderAttachmentQueue();
    });
    item.append(name, remove);
    elements.attachmentQueue.append(item);
  });
}

function renderReplyPreview() {
  elements.replyPreview.hidden = !replyDraft;
  if (!replyDraft) return;
  elements.replyPreviewSender.textContent = `Đang trả lời ${replyDraft.sender}`;
  elements.replyPreviewText.textContent = replyDraft.text;
}

function mergeMessage(conversation, message) {
  if (conversation.messages.some((item) => item.id === message.id)) return false;
  conversation.messages.push(message);
  conversation.messages.sort((left, right) =>
    new Date(left.createdAt) - new Date(right.createdAt)
  );
  conversation.unread = conversation.id !== activeConversationId && !message.mine;
  if (!message.mine) notifyIncomingMessage(conversation, message);
  if (conversation.id === activeConversationId) renderMessages();
  else renderChatList();
  return true;
}

async function sendMessage(conversationId, text, files = [], replyTo = null) {
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation || !supabaseClient || !currentUser) return false;
  const cleanText = text.trim();
  if (!cleanText && files.length === 0) return false;
  let message;
  try {
    message = await postMessage(
      supabaseClient,
      currentUser.id,
      conversationId,
      cleanText,
      files,
      replyTo
    );
  } catch (error) {
    showToast("Không gửi được tin nhắn", String(error));
    return false;
  }
  if (!message) return false;
  mergeMessage(conversation, message);
  conversation.unread = false;
  return true;
}

async function toggleMessageReaction(conversation, message) {
  try {
    Object.assign(
      message,
      await toggleReaction(supabaseClient, message, currentUser.id)
    );
    if (conversation.id === activeConversationId) renderMessages();
    else renderChatList();
  } catch (error) {
    showToast("Không cập nhật được lượt thích", String(error));
  }
}

function selectConversation(id) {
  activeConversationId = id;
  const conversation = activeConversation();
  if (!conversation) return;
  conversation.unread = false;
  renderMessages();
}

elements.chatSearch.addEventListener("input", renderChatList);

elements.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const sent = await sendMessage(
    activeConversationId,
    elements.messageInput.value,
    selectedFiles,
    replyDraft
  );
  if (!sent) return;
  elements.messageInput.value = "";
  replyDraft = null;
  renderReplyPreview();
  selectedFiles.length = 0;
  renderAttachmentQueue();
  elements.characterCount.textContent = "0/500";
  elements.messageInput.focus();
});

elements.clearReplyButton.addEventListener("click", () => {
  replyDraft = null;
  renderReplyPreview();
});

elements.pickFileButton.addEventListener("click", () => elements.fileInput.click());

elements.fileInput.addEventListener("change", () => {
  const files = Array.from(elements.fileInput.files ?? []);
  const accepted = files.filter((file) => file.size <= maxFileSize);
  const rejectedCount = files.length - accepted.length;
  selectedFiles.push(...accepted);
  renderAttachmentQueue();
  elements.fileInput.value = "";
  if (rejectedCount > 0) {
    showToast("Tệp vượt giới hạn", "Mỗi tệp cần nhỏ hơn hoặc bằng 10 MB.");
  }
});

elements.messageInput.addEventListener("input", () => {
  elements.characterCount.textContent = `${elements.messageInput.value.length}/500`;
});

elements.messageInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    elements.messageForm.requestSubmit();
  }
});

elements.quickReplyForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = elements.quickReplyInput.value;
  const sent = await sendMessage(notificationConversationId, text);
  if (!sent) return;
  elements.quickReplyInput.value = "";
  showToast("Đã trả lời nhanh", text.trim());
});

elements.pinButton.addEventListener("click", () => {
  const conversation = activeConversation();
  conversation.pinned = !conversation.pinned;
  renderMessages();
  showToast(conversation.pinned ? "Đã ghim cuộc trò chuyện" : "Đã bỏ ghim", conversation.name);
});

function toggleFocusMode() {
  const focused = elements.app.classList.toggle("is-focused");
  elements.focusButton.classList.toggle("is-active", focused);
  elements.focusButton.setAttribute("aria-pressed", String(focused));
  elements.focusTextButton.textContent = focused ? "Thoát tập trung →" : "Bật tập trung →";
}

elements.focusButton.addEventListener("click", toggleFocusMode);
elements.focusTextButton.addEventListener("click", toggleFocusMode);

elements.notificationButton.addEventListener("click", () => {
  const isOpen = document.body.classList.toggle("show-notification");
  elements.notificationButton.setAttribute("aria-expanded", String(isOpen));
});

function compareVersions(left, right) {
  const parse = (version) => {
    const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
    return match ? match.slice(1).map(Number) : null;
  };
  const latest = parse(left);
  const current = parse(right);
  if (!latest || !current) throw new Error("Phiên bản phát hành không đúng định dạng.");
  for (let index = 0; index < latest.length; index += 1) {
    if (latest[index] !== current[index]) return latest[index] > current[index] ? 1 : -1;
  }
  return 0;
}

async function currentAppVersion() {
  const getVersion = window.__TAURI__?.app?.getVersion;
  return getVersion
    ? getVersion()
    : document.querySelector('meta[name="app-version"]')?.content ?? "0.1.0";
}

async function checkForUpdates() {
  if (elements.checkUpdatesButton.disabled) return;
  elements.updateDialog.showModal();
  elements.updateDialog.dataset.state = "checking";
  elements.updateTitle.textContent = "Đang kiểm tra bản cập nhật";
  elements.updateMessage.textContent = "Đang kết nối với Bombombini HQ...";
  elements.releaseLink.hidden = true;
  elements.checkAgainButton.hidden = true;
  elements.checkUpdatesButton.disabled = true;
  elements.checkUpdatesButton.classList.add("is-checking");

  try {
    const response = await fetch(latestReleaseUrl, {
      headers: { Accept: "application/vnd.github+json" }
    });
    if (response.status === 404) {
      elements.updateDialog.dataset.state = "current";
      elements.updateTitle.textContent = "Chưa có bản phát hành";
      elements.updateMessage.textContent = "Hiện chưa có bản cập nhật công khai để tải.";
      return;
    }
    if (!response.ok) throw new Error(`GitHub trả về lỗi ${response.status}.`);

    const release = await response.json();
    const latestVersion = release.tag_name;
    const version = await currentAppVersion();
    const comparison = compareVersions(latestVersion, version);
    elements.updateDialog.dataset.state = comparison > 0 ? "available" : "current";

    if (comparison > 0) {
      const releaseUrl = new URL(release.html_url);
      if (releaseUrl.origin !== "https://github.com") {
        throw new Error("Liên kết cập nhật không hợp lệ.");
      }
      elements.updateTitle.textContent = `Có phiên bản ${latestVersion}`;
      elements.updateMessage.textContent = `Bạn đang dùng ${version}. Mở trang phát hành để xem ghi chú và tải bản mới.`;
      elements.releaseLink.href = releaseUrl.href;
      elements.releaseLink.hidden = false;
    } else {
      elements.updateTitle.textContent = "Bạn đang dùng bản mới nhất";
      elements.updateMessage.textContent = `Phiên bản hiện tại: ${version}. Gusini đã được cập nhật!`;
    }
  } catch (error) {
    elements.updateDialog.dataset.state = "error";
    elements.updateTitle.textContent = "Không kiểm tra được";
    elements.updateMessage.textContent = String(error);
  } finally {
    elements.checkAgainButton.hidden = false;
    elements.checkUpdatesButton.disabled = false;
    elements.checkUpdatesButton.classList.remove("is-checking");
  }
}

elements.checkUpdatesButton.addEventListener("click", checkForUpdates);
elements.checkAgainButton.addEventListener("click", checkForUpdates);
document.querySelector("#closeUpdateDialog").addEventListener("click", () => elements.updateDialog.close());

elements.settingsButton.addEventListener("click", () => {
  elements.notificationsSetting.checked = settings.notifications;
  elements.animationsSetting.checked = settings.animations;
  elements.autostartSetting.checked = settings.autostart;
  elements.settingsDialog.showModal();
});
document.querySelector("#closeSettingsDialog").addEventListener("click", () => elements.settingsDialog.close());
document.querySelector("#closeSettingsButton").addEventListener("click", () => elements.settingsDialog.close());
elements.notificationsSetting.addEventListener("change", () => {
  settings.notifications = elements.notificationsSetting.checked;
  saveSetting("notifications-enabled", settings.notifications);
});
elements.animationsSetting.addEventListener("change", () => {
  settings.animations = elements.animationsSetting.checked;
  document.body.classList.toggle("reduce-effects", !settings.animations);
  saveSetting("animations-enabled", settings.animations);
});
elements.autostartSetting.addEventListener("change", async () => {
  const previousValue = settings.autostart;
  const nextValue = elements.autostartSetting.checked;
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
    elements.autostartSetting.checked = previousValue;
    showToast("Cần chạy ứng dụng desktop", "Cài đặt khởi động chỉ có trong bản Windows.");
    return;
  }

  try {
    await invoke("set_autostart_enabled", { enabled: nextValue });
    settings.autostart = nextValue;
    saveSetting("autostart-enabled", nextValue);
  } catch (error) {
    elements.autostartSetting.checked = previousValue;
    showToast("Không đổi được cài đặt khởi động", String(error));
  }
});
document.body.classList.toggle("reduce-effects", !settings.animations);

async function listenForNotificationReplies() {
  const listen = window.__TAURI__?.event?.listen;
  if (!listen) return;

  try {
    await listen("notification-reply", async ({ payload }) => {
      try {
        if (!conversations.some((item) => item.id === payload.conversationId)) {
          await refreshConversations();
        }
        if (!conversations.some((item) => item.id === payload.conversationId)) {
          showToast("Không thể gửi trả lời", "Cuộc trò chuyện không còn khả dụng.");
          return;
        }
        const sent = await sendMessage(payload.conversationId, payload.text);
        if (sent) showToast("Đã trả lời từ thông báo", payload.text);
      } catch (error) {
        showToast("Không thể gửi trả lời", String(error));
      }
    });
  } catch (error) {
    showToast("Không nhận được câu trả lời", String(error));
  }
}

elements.newChatButton.addEventListener("click", () => {
  elements.userSearchInput.value = "";
  elements.userSearchResults.replaceChildren();
  elements.newChatDialog.showModal();
  elements.userSearchInput.focus();
});

elements.closeNewChatDialog.addEventListener("click", () => elements.newChatDialog.close());

elements.userSearchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.userSearchResults.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "empty-state";
  loading.textContent = "Đang tìm người dùng...";
  elements.userSearchResults.append(loading);

  try {
    const users = await findUsers(supabaseClient, elements.userSearchInput.value, currentUser.id);
    elements.userSearchResults.replaceChildren();
    if (!users.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent = "Không tìm thấy người dùng.";
      elements.userSearchResults.append(empty);
      return;
    }

    for (const user of users) {
      const result = document.createElement("button");
      result.className = "user-search-result";
      result.type = "button";
      const avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.textContent = (user.display_name || user.username).slice(0, 1).toLocaleUpperCase("vi");
      const copy = document.createElement("span");
      copy.className = "user-search-copy";
      const name = document.createElement("strong");
      name.textContent = user.display_name || user.username;
      const username = document.createElement("small");
      username.textContent = `@${user.username}`;
      copy.append(name, username);
      result.append(avatar, copy);
      result.addEventListener("click", async () => {
        result.disabled = true;
        try {
          const conversationId = await openDirectConversation(supabaseClient, user.id);
          await refreshConversations();
          selectConversation(conversationId);
          elements.newChatDialog.close();
        } catch (error) {
          result.disabled = false;
          showToast("Không thể mở cuộc trò chuyện", String(error));
        }
      });
      elements.userSearchResults.append(result);
    }
  } catch (error) {
    elements.userSearchResults.replaceChildren();
    const failure = document.createElement("p");
    failure.className = "empty-state";
    failure.textContent = `Không tìm được người dùng: ${String(error)}`;
    elements.userSearchResults.append(failure);
  }
});

document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.remove("is-active"));
    button.classList.add("is-active");
    unreadOnly = button.dataset.filter === "unread";
    renderChatList();
  });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    elements.chatSearch.focus();
  }
  if (event.key === "Escape" && elements.app.classList.contains("is-focused")) toggleFocusMode();
  if (event.key === "Escape" && document.body.classList.contains("show-notification")) {
    document.body.classList.remove("show-notification");
    elements.notificationButton.setAttribute("aria-expanded", "false");
  }
});

elements.quickReplyInput.disabled = true;
elements.quickReplyForm.querySelector('button[type="submit"]').disabled = true;
renderMessages();
listenForNotificationReplies();
initializeBackend().catch((error) => {
  showAuthScreen(!supabaseClient);
  showAuthError(`Không khởi động được chat online: ${String(error)}`);
});

async function syncAutostartSetting() {
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) return;

  try {
    const enabled = await invoke("is_autostart_enabled");
    if (enabled !== settings.autostart) {
      await invoke("set_autostart_enabled", { enabled: settings.autostart });
    }
  } catch (error) {
    showToast("Không đồng bộ được cài đặt khởi động", String(error));
  }
}

syncAutostartSetting();
