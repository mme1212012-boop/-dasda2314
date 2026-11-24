const conversations = [
  {
    id: "minh-anh",
    name: "Minh Anh",
    initials: "M",
    color: "",
    status: "Đang hoạt động",
    unread: true,
    pinned: false,
    messages: [
      { text: "Ê, tối nay chiến game không?", time: "16:42", mine: false },
      { text: "Có kèo là có mặt 😎", time: "16:44", mine: true, reaction: true },
      { text: "Tối 8 giờ nhé, để tui gửi link.", time: "16:46", mine: false }
    ]
  },
  {
    id: "bao",
    name: "Bảo Nguyễn",
    initials: "B",
    color: "violet",
    status: "Vừa hoạt động",
    unread: true,
    pinned: false,
    messages: [
      { text: "Gửi mình cái playlist hôm qua với!", time: "15:31", mine: false },
      { text: "Đợi xíu mình gửi nha.", time: "15:35", mine: true }
    ]
  },
  {
    id: "team",
    name: "Team Không Ngủ",
    initials: "T",
    color: "blue",
    status: "4 thành viên",
    unread: false,
    pinned: false,
    messages: [
      { text: "Deadline đã xử lý xong. Quá cháy! 🔥", time: "14:12", mine: false }
    ]
  },
  {
    id: "linh",
    name: "Linh Phạm",
    initials: "L",
    color: "pink",
    status: "Đang hoạt động",
    unread: false,
    pinned: false,
    messages: [
      { text: "Mai đi cà phê nha?", time: "Hôm qua", mine: false },
      { text: "Chốt đơn ☕", time: "Hôm qua", mine: true }
    ]
  }
];

const elements = {
  app: document.querySelector(".app-shell"),
  chatList: document.querySelector("#chatList"),
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
  toastRegion: document.querySelector("#toastRegion"),
  typingIndicator: document.querySelector("#typingIndicator"),
  typingName: document.querySelector("#typingName")
};

let activeConversationId = conversations[0].id;
let notificationConversationId = conversations[0].id;
let replyDraft = null;
let unreadOnly = false;
let toastTimer;
const selectedFiles = [];
const maxFileSize = 10 * 1024 * 1024;
const latestReleaseUrl = "https://api.github.com/repos/mme1212012-boop/-dasda2314/releases/latest";
const settings = {
  notifications: readSetting("notifications-enabled", true),
  animations: readSetting("animations-enabled", true)
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
  return conversations.find((conversation) => conversation.id === activeConversationId);
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
    empty.textContent = unreadOnly && query === ""
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
  elements.headerName.textContent = conversation.name;
  elements.headerStatus.textContent = conversation.status;
  elements.headerAvatar.textContent = conversation.initials;
  elements.headerAvatar.className = `avatar avatar-contact ${conversation.color}`;
  elements.pinButton.classList.toggle("is-active", conversation.pinned);
  elements.pinButton.textContent = conversation.pinned ? "★" : "☆";
  elements.pinButton.setAttribute("aria-pressed", String(conversation.pinned));
  elements.typingName.textContent = conversation.name;

  for (const [index, message] of conversation.messages.entries()) {
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
    reaction.textContent = message.reaction ? "♥ 1" : "♡";
    reaction.setAttribute("aria-label", message.reaction ? "Bỏ thả tim" : "Thả tim");
    reaction.setAttribute("aria-pressed", String(Boolean(message.reaction)));
    reaction.addEventListener("click", () => {
      message.reaction = !message.reaction;
      renderMessages();
    });
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
  elements.notificationMessage.textContent = message.text;
  elements.notificationAvatar.textContent = conversation.initials;
  elements.notificationAvatar.className = `notification-avatar ${conversation.color}`;
  elements.notificationTime.textContent = "vừa xong";
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

function currentTime() {
  return new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(new Date());
}

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

function sendMessage(conversationId, text, files = [], replyTo = null) {
  const cleanText = text.trim();
  if (!cleanText && files.length === 0) return false;
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) return false;
  const attachments = files.map((file) => ({
    name: file.name,
    size: file.size,
    url: URL.createObjectURL(file)
  }));
  conversation.messages.push({ text: cleanText, attachments, time: currentTime(), mine: true, replyTo });
  conversation.unread = false;
  if (conversation.id === activeConversationId) renderMessages();
  else renderChatList();
  return true;
}

function selectConversation(id) {
  activeConversationId = id;
  const conversation = activeConversation();
  conversation.unread = false;
  renderMessages();
}

elements.chatSearch.addEventListener("input", renderChatList);

elements.messageForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!sendMessage(activeConversationId, elements.messageInput.value, selectedFiles, replyDraft)) return;
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

elements.quickReplyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = elements.quickReplyInput.value;
  if (!sendMessage(notificationConversationId, text)) return;
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
document.body.classList.toggle("reduce-effects", !settings.animations);

document.querySelector("#simulateMessageButton").addEventListener("click", () => {
  const conversation = activeConversation();
  const message = {
    text: "Tin nhắn thử — bạn có thể trả lời ngay trong thông báo Windows.",
    time: currentTime(),
    mine: false
  };
  conversation.messages.push(message);
  conversation.unread = true;
  updateNotification(conversation, message);
  renderMessages();
  if (!settings.notifications) {
    showToast("Thông báo đã tắt", "Tin nhắn mẫu vẫn được thêm vào cuộc trò chuyện.");
    return;
  }
  const invoke = window.__TAURI__?.core?.invoke;
  if (!invoke) {
    showToast("Cần chạy ứng dụng desktop", "Thông báo trả lời nhanh chỉ có trong bản Windows.");
    return;
  }
  invoke("show_message_notification", {
    conversationId: conversation.id,
    sender: conversation.name,
    message: message.text
  }).then(() => {
    showToast("Đã gửi thông báo Windows", "Thử trả lời trực tiếp trong thông báo.");
  }).catch((error) => {
    showToast("Không gửi được thông báo", String(error));
  });
});

async function listenForNotificationReplies() {
  const listen = window.__TAURI__?.event?.listen;
  if (!listen) return;

  try {
    await listen("notification-reply", ({ payload }) => {
      const conversation = conversations.find((item) => item.id === payload.conversationId);
      if (!conversation || !sendMessage(conversation.id, payload.text)) {
        showToast("Không thể gửi trả lời", "Cuộc trò chuyện hoặc nội dung không hợp lệ.");
        return;
      }
      showToast("Đã trả lời từ thông báo", payload.text);
    });
  } catch (error) {
    showToast("Không nhận được câu trả lời", String(error));
  }
}

document.querySelector("#newChatButton").addEventListener("click", () => {
  elements.chatSearch.focus();
  showToast("Tìm một người bạn", "Dùng ô tìm kiếm để lọc cuộc trò chuyện.");
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

updateNotification(conversations[0], conversations[0].messages.at(-1));
renderMessages();
listenForNotificationReplies();
