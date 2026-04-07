// --- Response types ---

export interface WhoAmIResponse {
  device_id: string;
  is_guest: boolean;
  user_id: string;
}

export interface JoinedRoomsResponse {
  joined_rooms: string[];
}

export interface RoomNameContent {
  name: string;
}

export interface RoomTopicContent {
  topic: string;
}

export interface RoomMember {
  content: {
    avatar_url?: string;
    displayname?: string;
    membership: string;
  };
  state_key: string;
  type: string;
}

export interface RoomMembersResponse {
  chunk: RoomMember[];
}

export interface MatrixEvent {
  content: Record<string, unknown>;
  event_id: string;
  origin_server_ts: number;
  room_id?: string;
  sender: string;
  type: string;
}

export interface RoomMessagesResponse {
  chunk: MatrixEvent[];
  end?: string;
  start: string;
}

export interface UserDirectoryResult {
  avatar_url?: string;
  display_name?: string;
  user_id: string;
}

export interface UserDirectoryResponse {
  limited: boolean;
  results: UserDirectoryResult[];
}

export interface PublicRoomsChunk {
  avatar_url?: string;
  canonical_alias?: string;
  name?: string;
  num_joined_members: number;
  room_id: string;
  topic?: string;
}

export interface PublicRoomsResponse {
  chunk: PublicRoomsChunk[];
  next_batch?: string;
  total_room_count_estimate?: number;
}

export interface SendEventResponse {
  event_id: string;
}

export interface CreateRoomResponse {
  room_id: string;
}

export interface ProfileInfoResponse {
  avatar_url?: string;
  displayname?: string;
}

// --- Helpers ---

interface MatrixRequestContext {
  accessToken: string;
  baseUrl: string;
}

const buildRequestHeaders = (
  accessToken: string,
  body?: Record<string, unknown>
): Record<string, string> => {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

const buildRequestUrl = (
  baseUrl: string,
  path: string,
  query?: Record<string, string>
): URL => {
  const url = new URL(`/_matrix/client/v3${path}`, baseUrl);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }
  return url;
};

const parseJsonOrThrow = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Matrix API error ${response.status}: ${text}`);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Matrix responses are caller-typed per endpoint
  return (await response.json()) as T;
};

/* setTimeout-backed delay; Workers have no `timers/promises`. */
const sleep = async (ms: number): Promise<void> => {
  // eslint-disable-next-line promise/avoid-new -- only portable sleep on Workers
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

const matrixRequest = async <T>(
  ctx: MatrixRequestContext,
  method: string,
  path: string,
  body?: Record<string, unknown>,
  query?: Record<string, string>,
  retries = 3
): Promise<T> => {
  const url = buildRequestUrl(ctx.baseUrl, path, query);
  const headers = buildRequestHeaders(ctx.accessToken, body);
  const response = await fetch(url.toString(), {
    body: body ? JSON.stringify(body) : undefined,
    headers,
    method,
  });

  if (response.status === 429 && retries > 0) {
    const retryJson: { retry_after_ms?: number } = await response.json();
    const waitMs = Math.min(retryJson.retry_after_ms ?? 3000, 5000);
    await sleep(waitMs);
    return matrixRequest<T>(ctx, method, path, body, query, retries - 1);
  }

  return parseJsonOrThrow<T>(response);
};

const roomPath = (roomId: string): string =>
  `/rooms/${encodeURIComponent(roomId)}`;

// --- Client ---

export class MatrixClient {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
    retries = 3
  ): Promise<T> {
    const out = await matrixRequest<T>(
      { accessToken: this.accessToken, baseUrl: this.baseUrl },
      method,
      path,
      body,
      query,
      retries
    );
    return out;
  }

  // --- Identity ---

  async whoAmI(): Promise<WhoAmIResponse> {
    const out = await this.request<WhoAmIResponse>("GET", "/account/whoami");
    return out;
  }

  // --- Room state ---

  async getJoinedRooms(): Promise<JoinedRoomsResponse> {
    const out = await this.request<JoinedRoomsResponse>("GET", "/joined_rooms");
    return out;
  }

  async getRoomName(roomId: string): Promise<string | null> {
    try {
      const result = await this.request<RoomNameContent>(
        "GET",
        `${roomPath(roomId)}/state/m.room.name`
      );
      return result.name;
    } catch {
      return null;
    }
  }

  async getRoomTopic(roomId: string): Promise<string | null> {
    try {
      const result = await this.request<RoomTopicContent>(
        "GET",
        `${roomPath(roomId)}/state/m.room.topic`
      );
      return result.topic;
    } catch {
      return null;
    }
  }

  async getRoomMembers(
    roomId: string,
    membership?: string
  ): Promise<RoomMembersResponse> {
    const query: Record<string, string> = {};
    if (membership !== undefined && membership !== "") {
      query.membership = membership;
    }
    const out = await this.request<RoomMembersResponse>(
      "GET",
      `${roomPath(roomId)}/members`,
      undefined,
      query
    );
    return out;
  }

  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    await this.request<Record<string, never>>(
      "PUT",
      `${roomPath(roomId)}/state/m.room.topic`,
      { topic }
    );
  }

  // --- Messages ---

  async getRoomMessages(
    roomId: string,
    options: {
      dir?: "b" | "f";
      filter?: string;
      from?: string;
      limit?: number;
    } = {}
  ): Promise<RoomMessagesResponse> {
    const query: Record<string, string> = {
      dir: options.dir ?? "b",
      limit: String(options.limit ?? 50),
    };
    if (options.from !== undefined && options.from !== "") {
      query.from = options.from;
    }
    if (options.filter !== undefined && options.filter !== "") {
      query.filter = options.filter;
    }
    const out = await this.request<RoomMessagesResponse>(
      "GET",
      `${roomPath(roomId)}/messages`,
      undefined,
      query
    );
    return out;
  }

  async getLastMessageTimestamp(roomId: string): Promise<number | null> {
    try {
      const result = await this.getRoomMessages(roomId, { limit: 1 });
      const [firstEvent] = result.chunk;
      if (firstEvent !== undefined) {
        return firstEvent.origin_server_ts;
      }
      return null;
    } catch {
      return null;
    }
  }

  async sendMessage(
    roomId: string,
    body: string,
    msgtype = "m.text"
  ): Promise<SendEventResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const out = await this.request<SendEventResponse>(
      "PUT",
      `${roomPath(roomId)}/send/m.room.message/${txnId}`,
      { body, msgtype }
    );
    return out;
  }

  async sendReaction(
    roomId: string,
    eventId: string,
    reaction: string
  ): Promise<SendEventResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const out = await this.request<SendEventResponse>(
      "PUT",
      `${roomPath(roomId)}/send/m.reaction/${txnId}`,
      {
        "m.relates_to": {
          event_id: eventId,
          key: reaction,
          rel_type: "m.annotation",
        },
      }
    );
    return out;
  }

  async replyToMessage(
    roomId: string,
    eventId: string,
    body: string
  ): Promise<SendEventResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const out = await this.request<SendEventResponse>(
      "PUT",
      `${roomPath(roomId)}/send/m.room.message/${txnId}`,
      {
        body,
        "m.relates_to": {
          "m.in_reply_to": {
            event_id: eventId,
          },
        },
        msgtype: "m.text",
      }
    );
    return out;
  }

  async redactEvent(
    roomId: string,
    eventId: string,
    reason?: string
  ): Promise<SendEventResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const body = reason !== undefined && reason !== "" ? { reason } : {};
    const out = await this.request<SendEventResponse>(
      "PUT",
      `${roomPath(roomId)}/redact/${encodeURIComponent(eventId)}/${txnId}`,
      body
    );
    return out;
  }

  async sendReadReceipt(roomId: string, eventId: string): Promise<void> {
    await this.request<Record<string, never>>(
      "POST",
      `${roomPath(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
      {}
    );
  }

  // --- Room management ---

  async createRoom(options: {
    invite?: string[];
    is_direct?: boolean;
    name?: string;
    preset?: "private_chat" | "public_chat" | "trusted_private_chat";
    topic?: string;
  }): Promise<CreateRoomResponse> {
    const out = await this.request<CreateRoomResponse>(
      "POST",
      "/createRoom",
      options
    );
    return out;
  }

  async joinRoom(roomIdOrAlias: string): Promise<{ room_id: string }> {
    const out = await this.request<{ room_id: string }>(
      "POST",
      `/join/${encodeURIComponent(roomIdOrAlias)}`,
      {}
    );
    return out;
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.request<Record<string, never>>(
      "POST",
      `${roomPath(roomId)}/leave`,
      {}
    );
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    await this.request<Record<string, never>>(
      "POST",
      `${roomPath(roomId)}/invite`,
      { user_id: userId }
    );
  }

  // --- Users ---

  async getDisplayName(userId: string): Promise<string | null> {
    try {
      const result = await this.request<ProfileInfoResponse>(
        "GET",
        `/profile/${encodeURIComponent(userId)}/displayname`
      );
      return result.displayname ?? null;
    } catch {
      return null;
    }
  }

  async searchUserDirectory(
    searchTerm: string,
    limit = 10
  ): Promise<UserDirectoryResponse> {
    const out = await this.request<UserDirectoryResponse>(
      "POST",
      "/user_directory/search",
      {
        limit,
        search_term: searchTerm,
      }
    );
    return out;
  }

  // --- Public rooms ---

  async getPublicRooms(
    options: {
      limit?: number;
      searchTerm?: string;
      since?: string;
    } = {}
  ): Promise<PublicRoomsResponse> {
    if (options.searchTerm !== undefined && options.searchTerm !== "") {
      const postOut = await this.request<PublicRoomsResponse>(
        "POST",
        "/publicRooms",
        {
          filter: { generic_search_term: options.searchTerm },
          limit: options.limit ?? 20,
          since: options.since,
        }
      );
      return postOut;
    }
    const query: Record<string, string> = {
      limit: String(options.limit ?? 20),
    };
    if (options.since !== undefined && options.since !== "") {
      query.since = options.since;
    }
    const getOut = await this.request<PublicRoomsResponse>(
      "GET",
      "/publicRooms",
      undefined,
      query
    );
    return getOut;
  }
}
