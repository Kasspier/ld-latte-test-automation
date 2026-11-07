import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { ApiError } from "./api";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || url.includes("your-project") || key.startsWith("your-")) {
    throw new ApiError(
      503,
      "Подключение к Supabase ещё не настроено. См. README проекта.",
      "SETUP_REQUIRED",
    );
  }
  return { url, key };
}

/** Cookie access is confined to Route Handlers, where refreshed cookies can be written. */
export async function cookieClient() {
  const { url, key } = getSupabaseConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) => store.set(name, value, options)),
    },
  });
}

/** Accept browser cookies or a Postman Bearer token. Both run under the caller's RLS. */
export async function authenticated(request: Request) {
  const authorization = request.headers.get("authorization");
  let supabase;
  let token: string | undefined;
  if (authorization) {
    if (!/^Bearer \S+$/i.test(authorization))
      throw new ApiError(401, "Войдите в аккаунт", "UNAUTHORIZED");
    token = authorization.slice(7);
    const { url, key } = getSupabaseConfig();
    supabase = createClient(url, key, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  } else {
    supabase = await cookieClient();
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user)
    throw new ApiError(401, "Сессия истекла. Войдите снова.", "UNAUTHORIZED");
  return { supabase, user: data.user };
}
