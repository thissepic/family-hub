import { Server } from "socket.io";
import { unsealData } from "iron-session";
import type { ServerToClientEvents, ClientToServerEvents } from "./events";
import type { SessionData } from "../auth";

let io: Server<ClientToServerEvents, ServerToClientEvents> | null = null;

/**
 * Get the Socket.IO server instance.
 * Returns null if not initialized (safe for edge runtime / build time).
 */
export function getIO(): Server<ClientToServerEvents, ServerToClientEvents> | null {
  return io;
}

/**
 * Emit a Socket.IO event to all members of a family.
 * Silently no-ops if Socket.IO is not initialized.
 */
export function emitToFamily<K extends keyof ServerToClientEvents>(
  familyId: string,
  event: K,
  ...args: Parameters<ServerToClientEvents[K]>
): void {
  if (!io) return;
  io.to(`family:${familyId}`).emit(event, ...args);
}

/**
 * Parse a cookie header string into a key-value map.
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key) {
      cookies[key] = rest.join("=");
    }
  }
  return cookies;
}

/**
 * Initialize the Socket.IO server on a separate port.
 * Called from instrumentation.ts on server startup.
 */
export function initSocketServer(): void {
  if (io) return;

  const port = parseInt(process.env.SOCKET_PORT || "3001", 10);

  io = new Server<ClientToServerEvents, ServerToClientEvents>({
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", async (socket) => {
    // Validate session cookie from handshake headers
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) {
      socket.disconnect();
      return;
    }

    const cookies = parseCookies(cookieHeader);
    const sessionCookie = cookies["family-hub-session"];
    if (!sessionCookie) {
      socket.disconnect();
      return;
    }

    let session: SessionData | null = null;
    try {
      session = await unsealData<SessionData>(
        decodeURIComponent(sessionCookie),
        { password: process.env.SESSION_SECRET! }
      );
    } catch {
      socket.disconnect();
      return;
    }

    if (!session?.familyId) {
      socket.disconnect();
      return;
    }

    // Join the authenticated family's room
    socket.join(`family:${session.familyId}`);

    socket.on("disconnect", () => {
      // Cleanup handled automatically by Socket.IO
    });
  });

  io.listen(port);
  console.log(`[Socket.IO] Server listening on port ${port}`);
}
