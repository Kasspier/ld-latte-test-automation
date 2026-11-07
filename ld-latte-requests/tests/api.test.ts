import { describe, expect, it } from "vitest";
import { z } from "zod";
import { assertWriteRequest, handleApi, ApiError, json, readJson } from "../src/lib/api";

function write(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/requests", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("API boundary", () => {
  it("rejects cross-origin browser writes", () => {
    expect(() => assertWriteRequest(write("{}", { Origin: "https://evil.example" }))).toThrow(
      ApiError,
    );
  });
  it("allows same-origin writes and originless CLI JSON requests", () => {
    expect(() =>
      assertWriteRequest(write("{}", { Origin: "http://localhost:3000" })),
    ).not.toThrow();
    expect(() => assertWriteRequest(write("{}"))).not.toThrow();
  });
  it("uses the actual Host when Next.js reconstructs the internal URL as localhost", () => {
    expect(() =>
      assertWriteRequest(write("{}", { Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000" })),
    ).not.toThrow();
  });
  it.each([
    "http://localhost:3000",
    "http://127.0.0.1:3001",
    "https://127.0.0.1:3000",
    "https://evil.example",
    "null",
  ])("rejects a different origin despite the internal localhost URL: %s", (origin) => {
    expect(() =>
      assertWriteRequest(write("{}", { Host: "127.0.0.1:3000", Origin: origin })),
    ).toThrow(ApiError);
  });
  it("does not let a spoofed forwarded host bypass the actual Host check", () => {
    expect(() =>
      assertWriteRequest(
        write("{}", {
          Host: "127.0.0.1:3000",
          Origin: "https://evil.example",
          "X-Forwarded-Host": "evil.example",
          "X-Forwarded-Proto": "https",
        }),
      ),
    ).toThrow(ApiError);
  });
  it("rejects non-JSON content types including misleading suffixes", () => {
    expect(() => assertWriteRequest(write("{}", { "Content-Type": "text/plain" }))).toThrow();
    expect(() =>
      assertWriteRequest(write("{}", { "Content-Type": "application/json-malicious" })),
    ).toThrow();
  });
  it("rejects malformed JSON", async () => {
    await expect(readJson(write("{bad"), z.object({}))).rejects.toMatchObject({
      status: 400,
      code: "INVALID_JSON",
    });
  });
  it("limits actual bytes including multibyte strings", async () => {
    await expect(
      readJson(write(JSON.stringify({ data: "я".repeat(17000) })), z.object({})),
    ).rejects.toMatchObject({ status: 413 });
  });
  it("returns validation details without internal stacks", async () => {
    const response = await handleApi(async () => {
      z.string().parse(42);
      return json({});
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body).not.toHaveProperty("stack");
  });
  it("never caches API responses", () => {
    expect(json({}).headers.get("cache-control")).toBe("no-store");
  });
});
