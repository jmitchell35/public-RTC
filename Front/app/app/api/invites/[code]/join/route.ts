import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";

function authHeaders(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

export async function POST(
  req: NextRequest,
  context: { params: { code: string } }
) {
  const params = await Promise.resolve(context.params);
  const headers = authHeaders(req);
  if (!headers) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { response } = await fetchBackend(`/invites/${params.code}/join`, {
    method: "POST",
    headers,
    cache: "no-store",
  });
  // 204 -> pas de corps
  if (response.status === 204) {
    return new NextResponse(null, { status: 204 });
  }
  const text = await response.text();
  try {
    const json = JSON.parse(text);
    return NextResponse.json(json, { status: response.status });
  } catch {
    return NextResponse.json({ error: text || "unknown" }, { status: response.status });
  }
}
