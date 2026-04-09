import { query } from "@/lib/db";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  const { code } = await req.json();

  if (!process.env.ACCESS_CODE) {
    return new Response(JSON.stringify({ error: "Access code not configured" }), {
      status: 500,
    });
  }

  if (code !== process.env.ACCESS_CODE) {
    return new Response(JSON.stringify({ error: "Invalid access code" }), {
      status: 403,
    });
  }

  const sessionId = crypto.randomUUID();

  await query("INSERT INTO sessions (id) VALUES ($1)", [sessionId]);

  const cookieStore = await cookies();
  cookieStore.set("lr_session", sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}
