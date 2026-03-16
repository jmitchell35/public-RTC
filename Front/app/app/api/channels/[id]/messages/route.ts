import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";

function authHeaders(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const headers = authHeaders(req);
  if (!headers) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const query = req.nextUrl.search ?? "";
  const { response } = await fetchBackend(`/channels/${params.id}/messages${query}`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json({ error: text || "unknown" }, { status: response.status });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  const headers = authHeaders(req);
  if (!headers) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const payload = await req.json();
  const { response } = await fetchBackend(`/channels/${params.id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json({ error: text || "unknown" }, { status: response.status });
  }
}
