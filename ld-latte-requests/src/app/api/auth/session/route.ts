import { handleApi, json } from "@/lib/api";
import { authenticated } from "@/lib/supabase";

export async function GET(request: Request) {
  return handleApi(async () => {
    const { user } = await authenticated(request);
    return json({ user: { id: user.id, email: user.email } });
  });
}
