import { z } from "zod";
import { ApiError, handleApi, json, readJson } from "@/lib/api";
import { updateRequestSchema } from "@/lib/domain";
import { authenticated } from "@/lib/supabase";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  return handleApi(async () => {
    const { supabase, user } = await authenticated(request);
    const id = z.uuid().parse((await context.params).id);
    const { data, error } = await supabase
      .from("requests")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new ApiError(502, "Не удалось загрузить заявку");
    if (!data) throw new ApiError(404, "Заявка не найдена", "NOT_FOUND");
    return json({ data });
  });
}

export async function PATCH(request: Request, context: Context) {
  return handleApi(async () => {
    const { supabase, user } = await authenticated(request);
    const id = z.uuid().parse((await context.params).id);
    const input = await readJson(request, updateRequestSchema);
    const { data, error } = await supabase
      .from("requests")
      .update(input)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .maybeSingle();
    if (error) throw new ApiError(502, "Не удалось сохранить изменения");
    if (!data) throw new ApiError(404, "Заявка не найдена", "NOT_FOUND");
    return json({ data });
  });
}
