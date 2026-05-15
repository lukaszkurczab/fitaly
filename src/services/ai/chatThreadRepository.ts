import NetInfo from "@react-native-community/netinfo";
import type { ChatMessage, ChatThread } from "@/types";
import { get } from "@/services/core/apiClient";
import { captureException } from "@/services/core/errorLogger";
import { on } from "@/services/core/events";
import { isOfflineNetState } from "@/services/core/networkState";
import {
  getChatMessagesPageLocal,
  getChatThreadsLocal,
  setChatMessageSyncState,
  upsertChatMessageLocal,
  upsertChatThreadLocal,
} from "@/services/offline/chat.repo";

type ChatMessageApiItem = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: number;
  lastSyncedAt: number;
  deleted?: boolean;
};

type ChatMessagesPageApiResponse = {
  items: ChatMessageApiItem[];
  nextBeforeCreatedAt: number | null;
};

export type ChatMessageCursor = {
  beforeCreatedAt: number;
} | null;

export type ChatMessagesPage = {
  items: ChatMessage[];
  nextCursor: ChatMessageCursor;
};

const LOCAL_THREADS_LIMIT = 20;

function toChatMessage(userUid: string, item: ChatMessageApiItem): ChatMessage {
  return {
    id: item.id,
    userUid,
    role: item.role,
    content: item.content,
    createdAt: Number(item.createdAt || 0),
    lastSyncedAt: Number(item.lastSyncedAt || item.createdAt || 0),
    syncState: "synced",
    deleted: !!item.deleted,
    cloudId: item.id,
  };
}

async function syncMessagesFromBackend(params: {
  userUid: string;
  threadId: string;
  limitCount: number;
  beforeCreatedAt?: number | null;
}): Promise<void> {
  const search = new URLSearchParams({
    limit: String(params.limitCount),
  });
  if (params.beforeCreatedAt != null) {
    search.set("beforeCreatedAt", String(params.beforeCreatedAt));
  }

  const response = await get<ChatMessagesPageApiResponse>(
    `/api/v2/users/me/chat/threads/${params.threadId}/messages?${search.toString()}`,
  );

  for (const item of response.items) {
    const message = toChatMessage(params.userUid, item);
    await upsertChatMessageLocal({ threadId: params.threadId, message });
  }
}

export function subscribeToChatThreadMessages(params: {
  userUid: string;
  threadId: string;
  pageSize: number;
  onMessages: (items: ChatMessage[], nextCursor: ChatMessageCursor) => void;
  onError?: (error: unknown) => void;
}): () => void {
  let active = true;

  const publish = async () => {
    try {
      const page = await getChatMessagesPageLocal({
        userUid: params.userUid,
        threadId: params.threadId,
        limitCount: params.pageSize,
      });
      if (!active) return;
      params.onMessages(
        page.items,
        page.nextBeforeCreatedAt == null
          ? null
          : { beforeCreatedAt: page.nextBeforeCreatedAt },
      );
    } catch (error) {
      if (!active) return;
      params.onError?.(error);
    }
  };

  void publish();

  const off = on(`chat:messages:${params.userUid}:${params.threadId}`, () => {
    void publish();
  });

  return () => {
    active = false;
    off();
  };
}

export async function fetchChatThreadMessagesPage(params: {
  userUid: string;
  threadId: string;
  pageSize: number;
  cursor: ChatMessageCursor;
}): Promise<ChatMessagesPage> {
  let page = await getChatMessagesPageLocal({
    userUid: params.userUid,
    threadId: params.threadId,
    limitCount: params.pageSize,
    beforeCreatedAt: params.cursor?.beforeCreatedAt ?? null,
  });

  if (page.items.length < params.pageSize) {
    try {
      const net = await NetInfo.fetch();
      if (!isOfflineNetState(net)) {
        await syncMessagesFromBackend({
          userUid: params.userUid,
          threadId: params.threadId,
          limitCount: params.pageSize,
          beforeCreatedAt: params.cursor?.beforeCreatedAt ?? null,
        });
        page = await getChatMessagesPageLocal({
          userUid: params.userUid,
          threadId: params.threadId,
          limitCount: params.pageSize,
          beforeCreatedAt: params.cursor?.beforeCreatedAt ?? null,
        });
      }
    } catch (error) {
      captureException(
        "[chatThreadRepository] failed to sync older chat messages",
        {
          userUid: params.userUid,
          threadId: params.threadId,
          beforeCreatedAt: params.cursor?.beforeCreatedAt ?? null,
        },
        error,
      );
    }
  }

  return {
    items: page.items,
    nextCursor:
      page.nextBeforeCreatedAt == null
        ? null
        : { beforeCreatedAt: page.nextBeforeCreatedAt },
  };
}

export async function cacheUserChatMessageProjection(params: {
  userUid: string;
  threadId: string;
  messageId: string;
  content: string;
  createdAt: number;
  title?: string;
  syncState?: ChatMessage["syncState"];
}): Promise<void> {
  const thread: ChatThread = {
    id: params.threadId,
    userUid: params.userUid,
    title: params.title || "",
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
    lastMessage: params.content,
    lastMessageAt: params.createdAt,
  };
  const message: ChatMessage = {
    id: params.messageId,
    userUid: params.userUid,
    role: "user",
    content: params.content,
    createdAt: params.createdAt,
    lastSyncedAt: params.createdAt,
    syncState: params.syncState ?? "pending",
    deleted: false,
    cloudId: params.messageId,
  };

  await upsertChatThreadLocal(thread);
  await upsertChatMessageLocal({ threadId: params.threadId, message });
}

export async function cacheAssistantChatMessageProjection(params: {
  userUid: string;
  threadId: string;
  messageId: string;
  content: string;
  createdAt: number;
}): Promise<void> {
  const message: ChatMessage = {
    id: params.messageId,
    userUid: params.userUid,
    role: "assistant",
    content: params.content,
    createdAt: params.createdAt,
    lastSyncedAt: params.createdAt,
    syncState: "synced",
    deleted: false,
    cloudId: params.messageId,
  };
  const thread: ChatThread = {
    id: params.threadId,
    userUid: params.userUid,
    title: "",
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
    lastMessage: params.content,
    lastMessageAt: params.createdAt,
  };

  await upsertChatThreadLocal(thread);
  await upsertChatMessageLocal({ threadId: params.threadId, message });
}

export async function markChatMessageProjectionSynced(params: {
  userUid: string;
  threadId: string;
  messageId: string;
  lastSyncedAt: number;
}): Promise<void> {
  await setChatMessageSyncState({
    userUid: params.userUid,
    threadId: params.threadId,
    messageId: params.messageId,
    syncState: "synced",
    lastSyncedAt: params.lastSyncedAt,
  });
}

export function subscribeToChatThreads(params: {
  userUid: string;
  onThreads: (items: ChatThread[]) => void;
  onError?: (error: unknown) => void;
}): () => void {
  let active = true;

  const publish = async () => {
    try {
      const items = await getChatThreadsLocal(params.userUid, LOCAL_THREADS_LIMIT);
      if (!active) return;
      params.onThreads(items);
    } catch (error) {
      if (!active) return;
      params.onError?.(error);
    }
  };

  void publish();

  const off = on(`chat:threads:${params.userUid}`, () => {
    void publish();
  });

  return () => {
    active = false;
    off();
  };
}
