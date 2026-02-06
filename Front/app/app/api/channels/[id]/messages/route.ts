import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";

function authHeaders(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function GET(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const params = await Promise.resolve(context.params); // ensure unwrap
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
