import { ApiError, handleApi, json, readJson } from "@/lib/api";
import { createRequestSchema, escapeLike, listSchema } from "@/lib/domain";
import { authenticated } from "@/lib/supabase";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { supabase, user } = await authenticated(request);
    const { q, status, page } = listSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    let query = supabase.from("requests").select("*", { count: "exact" }).eq("user_id", user.id);
    if (q) query = query.ilike("title", `%${escapeLike(q)}%`);
    if (status) query = query.eq("status", status);
    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range((page - 1) * 20, page * 20 - 1);
    if (error)
      throw new ApiError(
        502,
        "Не удалось загрузить заявки. Проверьте подключение и повторите попытку.",
      );
    return json({ data, total: count, page, pageSize: 20 });
  });
}

export async function POST(request: Request) {
  return handleApi(async () => {
    const { supabase, user } = await authenticated(request);
    const input = await readJson(request, createRequestSchema);
    const { data, error } = await supabase
      .from("requests")
      .insert({ ...input, user_id: user.id })
      .select()
      .single();
    if (error?.code === "23505") {
      // Stable client UUID makes a retry safe, including after a lost network response.
      const { data: existing } = await supabase
        .from("requests")
        .select("*")
        .eq("id", input.id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (
        existing &&
        existing.title === input.title &&
        existing.description === input.description &&
        existing.category === input.category
      ) {
        return json({ data: existing, replayed: true });
      }
      throw new ApiError(409, "ID уже использован. Создайте новую заявку.", "ID_CONFLICT");
    }
    if (error) throw new ApiError(502, "Не удалось сохранить заявку. Повторите попытку.");
    return json({ data, replayed: false }, 201);
  });
}
