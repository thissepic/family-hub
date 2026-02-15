"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import type { ServerToClientEvents, ClientToServerEvents } from "@/lib/socket/events";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SocketContext = createContext<TypedSocket | null>(null);

export function useSocket(): TypedSocket | null {
  return useContext(SocketContext);
}

interface SocketProviderProps {
  children: ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const trpc = useTRPC();
  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  useEffect(() => {
    if (!session?.familyId) return;

    // Derive socket URL from current window location (proxied through Caddy /socket.io/)
    const socketUrl = typeof window !== "undefined"
      ? `${window.location.protocol}//${window.location.host}`
      : (process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001");

    const s: TypedSocket = io(socketUrl, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      query: { familyId: session.familyId },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    setSocket(s);

    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [session?.familyId]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}
