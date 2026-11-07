export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}

/** Same-origin API wrapper. Never stores credentials or session tokens in localStorage. */
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new HttpError("Нет соединения с сервером. Проверьте интернет и повторите попытку.", 0);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new HttpError(body.error || "Не удалось выполнить запрос", response.status, body.code);
  return body as T;
}
