import { NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_FAILED",
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** All writes require JSON; browser writes additionally require the same Origin. */
export function assertWriteRequest(request: Request) {
  const origin = request.headers.get("origin");
  // Next.js can reconstruct request.url with localhost even when the browser
  // uses 127.0.0.1. Host retains the address used for the actual HTTP request.
  // Do not trust arbitrary X-Forwarded-Host values or allow all loopback origins.
  const target = new URL(request.url);
  const host = request.headers.get("host");
  if (host) target.host = host;
  if (origin && origin !== target.origin) {
    throw new ApiError(403, "Запрос с другого сайта запрещён", "ORIGIN_REJECTED");
  }
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json"
  ) {
    throw new ApiError(415, "Ожидается JSON", "UNSUPPORTED_MEDIA_TYPE");
  }
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  assertWriteRequest(request);
  // Bound the actual body, not just the optional Content-Length header.
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "Пустое тело запроса", "INVALID_JSON");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) {
      await reader.cancel();
      throw new ApiError(413, "Запрос слишком большой", "BODY_TOO_LARGE");
    }
    chunks.push(value);
  }
  let body: unknown;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "Некорректный JSON", "INVALID_JSON");
  }
  return schema.parse(body);
}

/** Keep database details and authentication internals out of client error messages. */
export async function handleApi(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return json(
        {
          error: "Проверьте заполненные поля",
          code: "VALIDATION_ERROR",
          fields: error.flatten().fieldErrors,
        },
        400,
      );
    }
    if (error instanceof ApiError)
      return json({ error: error.message, code: error.code }, error.status);
    console.error("API operation failed", error instanceof Error ? error.name : "UnknownError");
    return json(
      { error: "Не удалось выполнить запрос. Попробуйте ещё раз.", code: "INTERNAL_ERROR" },
      500,
    );
  }
}
