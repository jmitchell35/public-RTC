'use server';

export async function getServers() {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const res = await fetch(new URL("/api/servers", base), {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load servers");
  const data = (await res.json()) as { servers?: Array<{ id: string; name: string }> };
  return data.servers ?? [];
}

export async function getChannels(serverId: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const res = await fetch(new URL(`/api/servers/${serverId}/channels`, base), {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load channels");
  return res.json() as Promise<Array<{ id: string; name: string }>>;
}

export async function getMessages(channelId: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const res = await fetch(new URL(`/api/channels/${channelId}/messages`, base), {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json() as Promise<
    Array<{ id: string; author_id: string; content: string; created_at: string }>
  >;
}
