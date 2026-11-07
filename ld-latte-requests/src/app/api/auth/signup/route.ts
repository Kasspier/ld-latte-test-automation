import { handleApi, json, readJson } from "@/lib/api";
import { signupError } from "@/lib/auth-errors";
import { credentialsSchema } from "@/lib/domain";
import { cookieClient } from "@/lib/supabase";

export async function POST(request: Request) {
  return handleApi(async () => {
    const input = await readJson(request, credentialsSchema);
    const client = await cookieClient();
    const { data, error } = await client.auth.signUp(input);
    if (error) throw signupError(error);
    return json(
      {
        user: data.session && data.user ? { id: data.user.id, email: data.user.email } : null,
        confirmationRequired: !data.session,
        message: data.session
          ? "Аккаунт создан"
          : "Проверьте почту для подтверждения регистрации. Если аккаунт уже есть, попробуйте войти.",
      },
      201,
    );
  });
}
