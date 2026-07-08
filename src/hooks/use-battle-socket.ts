"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ClientMessage, RoomView, ServerMessage } from "@/lib/battle/protocol";
import type { BattleEvent, SideIndex } from "@/lib/battle/types";

export function useBattleSocket(roomId: string) {
  const [view, setView] = useState<RoomView | null>(null);
  const [slot, setSlot] = useState<SideIndex | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const tokenKey = `battle-token:${roomId}`;
    let token = sessionStorage.getItem(tokenKey);
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem(tokenKey, token);
    }
    const socket = io({ query: { roomId, token }, path: "/socket.io" });
    socketRef.current = socket;
    socket.on("assigned", (data: { slot: SideIndex }) => setSlot(data.slot));
    socket.on("message", (msg: ServerMessage) => {
      if (msg.type === "state") setView(msg.view);
      else if (msg.type === "events") setEvents(msg.events);
      else if (msg.type === "error") setError(msg.message);
    });
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  const send = (msg: ClientMessage) => socketRef.current?.emit("message", msg);
  return { view, slot, events, error, send };
}
