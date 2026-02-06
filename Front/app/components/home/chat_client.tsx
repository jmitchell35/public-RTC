"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getBackendWsUrl } from "@/lib/backend-url";
import { PrimaryButton } from "./buttons";

type Message = { id: string; author: string; content: string; created_at: string };

type Props = {
  token: string;
  channelId: string;
  initialMessages: Message[];
  currentUser?: string;
};

export function ChatClient({ token, channelId, initialMessages, currentUser }: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = useMemo(
    () => `${getBackendWsUrl()}/ws?token=${encodeURIComponent(token)}`,
    [token]
  );

  useEffect(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "JoinChannel", data: { channel_id: channelId } }));
    });

    ws.addEventListener("message", (ev) => {
      try {
        const payload = JSON.parse(ev.data);
        if (payload.type === "Message" && payload.data?.message) {
          const m = payload.data.message;
          setMessages((prev) => [
            ...prev,
            {
              id: m.id,
              author: m.author_id ?? "unknown",
              content: m.content,
              created_at: m.created_at,
            },
          ]);
        }
      } catch {
        // ignore parse errors
      }
    });

    return () => ws.close();
  }, [wsUrl, channelId]);

  async function sendMessage() {
    if (!text.trim()) return;
    const res = await fetch(`/api/messages/${channelId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) setText("");
  }

  return (
    <div className="home-chat">
      <div className="home-chat-feed">
        {messages.map((m) => (
          <div key={m.id} className="home-chat-message">
            <div className="home-chat-avatar">{m.author[0] ?? "?"}</div>
            <div className="home-chat-bubble">
              <div className="home-chat-meta">
                <span className="home-chat-author">{m.author}</span>
                <span className="home-chat-time">
                  {new Date(m.created_at).toLocaleTimeString()}
                </span>
              </div>
              <div className="home-chat-text">{m.content}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="home-chat-input">
        <input
          type="text"
          placeholder="Envoyer un message"
          className="home-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <PrimaryButton label="Envoyer" onClick={sendMessage} />
      </div>
    </div>
  );
}

