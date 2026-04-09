import { cookies } from "next/headers";
import { query, hasDatabase } from "@/lib/db";
import { isLocal } from "@/lib/isLocal";
import { getCodeHash } from "@/lib/accessCode";

const MAX_GENERATIONS_PER_HOUR = 20;

export async function checkAccess(
  _req: Request,
  endpoint: string
): Promise<Response | null> {
  // Skip protection entirely if not in local mode or no database configured
  if (!isLocal() || !hasDatabase()) {
    return null;
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("lr_session")?.value;

  if (!sessionId) {
    return new Response(
      JSON.stringify({ error: "Access code required" }),
      { status: 401 }
    );
  }

  // Validate session exists AND was created with the current access code
  const currentHash = getCodeHash();
  const sessionResult = await query(
    "SELECT id FROM sessions WHERE id = $1 AND code_hash = $2",
    [sessionId, currentHash]
  );

  if (!sessionResult || sessionResult.rows.length === 0) {
    // Clear the stale cookie
    cookieStore.delete("lr_session");
    return new Response(
      JSON.stringify({ error: "Session expired. Please re-enter access code." }),
      { status: 401 }
    );
  }

  // Count generations in the last hour
  const countResult = await query(
    "SELECT COUNT(*) as count FROM generations WHERE session_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
    [sessionId]
  );

  const count = countResult ? parseInt(countResult.rows[0].count, 10) : 0;

  if (count >= MAX_GENERATIONS_PER_HOUR) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: `Maximum ${MAX_GENERATIONS_PER_HOUR} generations per hour. Please try again later.`,
      }),
      { status: 429 }
    );
  }

  // Record this generation
  await query(
    "INSERT INTO generations (session_id, endpoint) VALUES ($1, $2)",
    [sessionId, endpoint]
  );

  return null;
}
