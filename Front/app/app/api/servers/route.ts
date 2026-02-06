import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";

function authHeaders(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function GET(req: NextRequest) {
  const headers = authHeaders(req);
  if (!headers) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { response } = await fetchBackend("/servers", {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("GET /servers failed", response.status, text);
  }
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json({ error: text || "unknown" }, { status: response.status });
  }
}

export async function POST(req: NextRequest) {
  const headers = authHeaders(req);
  if (!headers) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { response } = await fetchBackend("/servers", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    console.error("POST /servers failed", response.status, text);
  }
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json({ error: text || "unknown" }, { status: response.status });
  }
}
