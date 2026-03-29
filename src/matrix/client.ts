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

export interface JoinedRoomsResponse {
  joined_rooms: string[];
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

export interface UserDirectoryResult {
  avatar_url?: string;
  display_name?: string;
  user_id: string;
}

export interface UserDirectoryResponse {
  limited: boolean;
  results: UserDirectoryResult[];
}

export interface WhoAmIResponse {
  device_id: string;
  is_guest: boolean;
  user_id: string;
}

export interface RoomNameContent {
  name: string;
}

export interface RoomTopicContent {
  topic: string;
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

export interface SendMessageResponse {
  event_id: string;
}

const sleep = async (ms: number): Promise<void> =>
  // eslint-disable-next-line no-promise-executor-return -- intentional delay
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const roomPath = (roomId: string): string =>
  `/rooms/${encodeURIComponent(roomId)}`;

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
    const url = new URL(`/_matrix/client/v3${path}`, this.baseUrl);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v);
      }
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
    };
    if (body) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url.toString(), {
      body: body ? JSON.stringify(body) : undefined,
      headers,
      method,
    });

    if (response.status === 429 && retries > 0) {
      const retryJson = (await response.json());
      const waitMs = Math.min(retryJson.retry_after_ms ?? 3000, 5000);
      await sleep(waitMs);
      return this.request<T>(method, path, body, query, retries - 1);
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Matrix API error ${response.status}: ${text}`);
    }

    return (await response.json()) as T;
  }

  async whoAmI(): Promise<WhoAmIResponse> {
    return this.request("GET", "/account/whoami");
  }

  async getJoinedRooms(): Promise<JoinedRoomsResponse> {
    return this.request("GET", "/joined_rooms");
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
    return this.request("GET", `${roomPath(roomId)}/members`, undefined, query);
  }

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
    return this.request(
      "GET",
      `${roomPath(roomId)}/messages`,
      undefined,
      query
    );
  }

  async sendMessage(
    roomId: string,
    body: string,
    msgtype = "m.text"
  ): Promise<SendMessageResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return this.request(
      "PUT",
      `${roomPath(roomId)}/send/m.room.message/${txnId}`,
      { body, msgtype }
    );
  }

  async sendReaction(
    roomId: string,
    eventId: string,
    reaction: string
  ): Promise<SendMessageResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return this.request("PUT", `${roomPath(roomId)}/send/m.reaction/${txnId}`, {
      "m.relates_to": {
        event_id: eventId,
        key: reaction,
        rel_type: "m.annotation",
      },
    });
  }

  async searchUserDirectory(
    searchTerm: string,
    limit = 10
  ): Promise<UserDirectoryResponse> {
    return this.request("POST", "/user_directory/search", {
      limit,
      search_term: searchTerm,
    });
  }

  async getPublicRooms(
    options: {
      limit?: number;
      searchTerm?: string;
      since?: string;
    } = {}
  ): Promise<PublicRoomsResponse> {
    if (options.searchTerm !== undefined && options.searchTerm !== "") {
      return this.request("POST", "/publicRooms", {
        filter: { generic_search_term: options.searchTerm },
        limit: options.limit ?? 20,
        since: options.since,
      });
    }
    const query: Record<string, string> = {
      limit: String(options.limit ?? 20),
    };
    if (options.since !== undefined && options.since !== "") {
      query.since = options.since;
    }
    return this.request("GET", "/publicRooms", undefined, query);
  }

  async joinRoom(roomIdOrAlias: string): Promise<{ room_id: string }> {
    return this.request(
      "POST",
      `/join/${encodeURIComponent(roomIdOrAlias)}`,
      {}
    );
  }

  async leaveRoom(roomId: string): Promise<void> {
    await this.request("POST", `${roomPath(roomId)}/leave`, {});
  }

  async getDisplayName(userId: string): Promise<string | null> {
    try {
      const result = await this.request<{ displayname?: string }>(
        "GET",
        `/profile/${encodeURIComponent(userId)}/displayname`
      );
      return result.displayname ?? null;
    } catch {
      return null;
    }
  }

  async createRoom(options: {
    invite?: string[];
    is_direct?: boolean;
    name?: string;
    preset?: "private_chat" | "public_chat" | "trusted_private_chat";
    topic?: string;
  }): Promise<{ room_id: string }> {
    return this.request("POST", "/createRoom", options);
  }

  async sendReadReceipt(roomId: string, eventId: string): Promise<void> {
    await this.request(
      "POST",
      `${roomPath(roomId)}/receipt/m.read/${encodeURIComponent(eventId)}`,
      {}
    );
  }

  async replyToMessage(
    roomId: string,
    eventId: string,
    body: string
  ): Promise<SendMessageResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return this.request(
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
  }

  async redactEvent(
    roomId: string,
    eventId: string,
    reason?: string
  ): Promise<SendMessageResponse> {
    const txnId = `mcp_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const body = reason !== undefined && reason !== "" ? { reason } : {};
    return this.request(
      "PUT",
      `${roomPath(roomId)}/redact/${encodeURIComponent(eventId)}/${txnId}`,
      body
    );
  }

  async inviteUser(roomId: string, userId: string): Promise<void> {
    await this.request("POST", `${roomPath(roomId)}/invite`, {
      user_id: userId,
    });
  }

  async setRoomTopic(roomId: string, topic: string): Promise<void> {
    await this.request("PUT", `${roomPath(roomId)}/state/m.room.topic`, {
      topic,
    });
  }
}
