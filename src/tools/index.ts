import type { MatrixClient } from "@/matrix/client";

import { createMessageTools } from "./messages";
import { createRoomTools } from "./rooms";
import { createUserTools } from "./users";

export const createAllTools = (client: MatrixClient) => ({
  ...createRoomTools(client),
  ...createMessageTools(client),
  ...createUserTools(client),
});
