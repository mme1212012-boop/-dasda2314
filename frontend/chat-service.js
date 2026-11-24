import { createClient } from "@supabase/supabase-js";

const attachmentBucket = "chat-attachments";
const maxAttachmentSize = 10 * 1024 * 1024;

export function createChatClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    }
  });
}

export async function loadConversations(client, userId) {
  const { data: rows, error } = await client.rpc("get_my_conversations");
  if (error) throw error;
  if (!rows?.length) return [];

  const ids = rows.map((row) => row.conversation_id);
  const messages = await loadMessages(client, ids, userId);
  const messagesByConversation = new Map(ids.map((id) => [id, []]));
  for (const message of messages) {
    messagesByConversation.get(message.conversationId).push(message);
  }

  return rows.map((row) => {
    const name = row.peer_display_name || row.peer_username;
    return {
      id: row.conversation_id,
      peerId: row.peer_id,
      username: row.peer_username,
      name,
      initials: name.slice(0, 1).toLocaleUpperCase("vi"),
      color: "",
      status: `@${row.peer_username}`,
      unread: false,
      pinned: false,
      messages: messagesByConversation.get(row.conversation_id) ?? []
    };
  });
}

export async function loadMessages(client, conversationIds, userId) {
  if (!conversationIds.length) return [];

  const { data: rows, error } = await client
    .from("messages")
    .select("id,conversation_id,sender_id,body,attachments,reply_to,created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!rows.length) return [];

  const messageIds = rows.map((row) => row.id);
  const { data: reactions, error: reactionError } = await client
    .from("message_reactions")
    .select("message_id,user_id")
    .in("message_id", messageIds);
  if (reactionError) throw reactionError;

  const reactionsByMessage = new Map();
  for (const reaction of reactions) {
    const users = reactionsByMessage.get(reaction.message_id) ?? [];
    users.push(reaction.user_id);
    reactionsByMessage.set(reaction.message_id, users);
  }

  return Promise.all(rows.map((row) =>
    mapMessage(client, row, userId, reactionsByMessage.get(row.id) ?? [])
  ));
}

async function mapMessage(client, row, userId, reactionUsers = []) {
  const attachments = await Promise.all((row.attachments ?? []).map(async (attachment) => {
    if (attachment.expired) return { ...attachment, url: null };
    const { data, error } = await client.storage
      .from(attachmentBucket)
      .createSignedUrl(attachment.path, 3600);
    if (error) throw error;
    return { ...attachment, url: data.signedUrl };
  }));
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    text: row.body,
    attachments,
    createdAt: row.created_at,
    time: new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(row.created_at)),
    mine: row.sender_id === userId,
    replyTo: row.reply_to,
    reaction: reactionUsers.includes(userId),
    reactionCount: reactionUsers.length
  };
}

export async function findUsers(client, username, currentUserId) {
  const normalized = username.trim().replace(/^@/, "").toLocaleLowerCase("en");
  if (!normalized) return [];
  if (!/^[a-z0-9_]{1,24}$/.test(normalized)) {
    throw new Error("Tên tìm kiếm chỉ được gồm chữ cái, số và dấu gạch dưới.");
  }
  const { data, error } = await client
    .from("profiles")
    .select("id,username,display_name")
    .neq("id", currentUserId)
    .ilike("username", `${normalized}%`)
    .order("username")
    .limit(10);
  if (error) throw error;
  return data;
}

export async function openDirectConversation(client, userId) {
  const { data, error } = await client.rpc("create_direct_conversation", {
    target_user: userId
  });
  if (error) throw error;
  return data;
}

export async function postMessage(client, userId, conversationId, text, files, replyTo) {
  const cleanText = text.trim();
  if (!cleanText && files.length === 0) return null;

  const uploadedPaths = [];
  const attachments = [];
  let insertedMessage;
  try {
    for (const file of files) {
      if (file.size > maxAttachmentSize) {
        throw new Error(`${file.name} vượt giới hạn 10 MB.`);
      }
      const safeName = file.name.replace(/[^\p{L}\p{N}._-]/gu, "_");
      const path = `${conversationId}/${userId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await client.storage
        .from(attachmentBucket)
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type || "application/octet-stream",
          upsert: false
        });
      if (error) throw error;
      uploadedPaths.push(path);
      attachments.push({ name: file.name, size: file.size, path });
    }

    const { data, error } = await client
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: userId,
        body: cleanText,
        attachments,
        reply_to: replyTo
      })
      .select("id,conversation_id,sender_id,body,attachments,reply_to,created_at")
      .single();
    if (error) throw error;
    insertedMessage = data;
  } catch (error) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await client.storage
        .from(attachmentBucket)
        .remove(uploadedPaths);
      if (cleanupError) {
        console.error("Could not remove attachments after a failed message send:", cleanupError);
      }
    }
    throw error;
  }

  return mapMessage(client, insertedMessage, userId);
}

export async function toggleReaction(client, message, userId) {
  const query = client
    .from("message_reactions")
    .delete()
    .eq("message_id", message.id)
    .eq("user_id", userId);

  if (message.reaction) {
    const { error } = await query;
    if (error) throw error;
    return { reaction: false, reactionCount: Math.max(0, message.reactionCount - 1) };
  }

  const { error } = await client.from("message_reactions").insert({
    message_id: message.id,
    conversation_id: message.conversationId,
    user_id: userId
  });
  if (error) throw error;
  return { reaction: true, reactionCount: message.reactionCount + 1 };
}
