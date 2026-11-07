import { z } from "zod";
import { ApiError, handleApi, json, readJson } from "@/lib/api";
import { cookieClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return handleApi(async () => {
    await readJson(request, z.object({}).strict());
    const client = await cookieClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) throw new ApiError(502, "Не удалось выйти. Повторите попытку.");
    return json({ ok: true });
  });
}
