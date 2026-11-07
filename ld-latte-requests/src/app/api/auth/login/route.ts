import { ApiError, handleApi, json, readJson } from "@/lib/api";
import { credentialsSchema } from "@/lib/domain";
import { cookieClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return handleApi(async () => {
    const input = await readJson(request, credentialsSchema);
    const client = await cookieClient();
    const { data, error } = await client.auth.signInWithPassword(input);
    if (error) {
      if (error.status === 429)
        throw new ApiError(429, "Слишком много попыток. Попробуйте позже.", "RATE_LIMITED");
      throw new ApiError(
        401,
        "Проверьте почту, пароль и подтверждение регистрации.",
        "LOGIN_FAILED",
      );
    }
    return json({ user: { id: data.user.id, email: data.user.email } });
  });
}
