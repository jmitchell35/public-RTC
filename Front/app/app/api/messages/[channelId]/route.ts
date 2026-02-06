import { NextRequest, NextResponse } from "next/server";
import { fetchBackend } from "@/lib/backend";
import { cookies } from "next/headers";

export async function POST(
  req: NextRequest,
  { params }: { params: { channelId: string } | Promise<{ channelId: string }> }
) {
  const { channelId } = await params;
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { response } = await fetchBackend(`/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
