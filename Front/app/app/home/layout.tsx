<<<<<<< HEAD
import { cookies } from 'next/headers';
import HomeWsProvider from '@/components/home/home-ws-provider';

export default async function HomeLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value ?? null;
    const wsBaseUrls = [
        process.env.NEXT_PUBLIC_BACKEND_WS_URL,
        process.env.BACKEND_URL,
        process.env.NEXT_PUBLIC_BACKEND_URL,
    ]
        .filter(Boolean)
        .join(',');

    return (
        <HomeWsProvider wsToken={token} wsBaseUrls={wsBaseUrls}>
            {children}
        </HomeWsProvider>
    );
=======
"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter, useSelectedLayoutSegment } from "next/navigation";
import { ServerBar } from "@/components/home/server_bar";
import type { Server } from "@/lib/servers";

export default function HomeLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const segment = useSelectedLayoutSegment();
  const activeId = segment ?? undefined;

  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const fetchServers = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/servers", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data?.servers) ? data.servers : data ?? [];
          setServers(
            list.map((s: any) => ({
              id: s.id,
              name: s.name,
              icon: s.icon ?? s.name?.[0] ?? "?",
              notif: 0,
            }))
          );
        } else {
          console.warn("GET /api/servers failed", res.status);
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  async function createServer() {
    if (!newServerName.trim()) return;
    const res = await fetch("/api/servers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newServerName.trim() }),
    });
    if (res.ok) {
      setNewServerName("");
      setShowDialog(false);
      await fetchServers();
    } else {
      const text = await res.text();
      console.error("create server error", res.status, text);
      alert(`Création échouée (${res.status}) ${text}`);
    }
  }

  async function joinServer() {
    if (!inviteCode.trim()) return;
    const res = await fetch(`/api/invites/${inviteCode.trim()}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      setInviteCode("");
      setShowDialog(false);
      await fetchServers();
      // Essaye de récupérer le dernier serveur rejoint pour le sélectionner
      try {
        const res2 = await fetch("/api/servers", { cache: "no-store" });
        if (res2.ok) {
          const data = await res2.json();
          const list = Array.isArray(data?.servers) ? data.servers : data ?? [];
          const newest = list[0];
          if (newest?.id) router.push(`/home/${newest.id}`);
        }
      } catch (_) {
        // ignore
      }
      alert("Serveur rejoint");
    } else {
      const text = await res.text();
      console.error("join server error", res.status, text);
      alert(`Rejoindre échoué (${res.status}) ${text}`);
    }
  }

  return (
    <div className="home-root">
      <ServerBar
        servers={servers}
        activeId={activeId}
        onSelect={(id) => router.push(`/home/${id}`)}
        onAdd={() => setShowDialog(true)}
      />
      <div className="home-main">
        {loading ? <div style={{ padding: 16 }}>Chargement...</div> : children}
      </div>

      {showDialog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
          }}
          onClick={() => setShowDialog(false)}
        >
          <div
            style={{
              background: "white",
              padding: "20px",
              borderRadius: "12px",
              width: "360px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Serveur</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div>
                <label style={{ fontSize: 12, color: "#475569" }}>Nom du serveur</label>
                <input
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="Ex: Mon serveur"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <button
                  onClick={createServer}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "10px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg,#4f46e5,#6366f1)",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Créer
                </button>
              </div>
              <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
              <div>
                <label style={{ fontSize: 12, color: "#475569" }}>Code d'invitation</label>
                <input
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="Code"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid #e2e8f0",
                  }}
                />
                <button
                  onClick={joinServer}
                  style={{
                    marginTop: 8,
                    width: "100%",
                    padding: "10px",
                    borderRadius: 10,
                    border: "none",
                    background: "#0ea5e9",
                    color: "white",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Rejoindre
                </button>
              </div>
              <button
                onClick={() => setShowDialog(false)}
                style={{
                  marginTop: 6,
                  width: "100%",
                  padding: "8px",
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
>>>>>>> front_logged_in_refacto
}
