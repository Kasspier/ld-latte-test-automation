import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../src/lib/api";

const state = vi.hoisted(() => ({ authenticate: vi.fn(), from: vi.fn() }));
vi.mock("../src/lib/supabase", () => ({ authenticated: state.authenticate }));
import { POST } from "../src/app/api/requests/route";
import { GET, PATCH } from "../src/app/api/requests/[id]/route";

const id = "11111111-1111-4111-8111-111111111111";
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = { id, title: "Бот", description: "Сбор заявок", category: "Бот" };
const row = { ...input, user_id: owner, status: "Новая" };
const context = { params: Promise.resolve({ id }) };
const write = (method: string, data: unknown) =>
  new Request(`http://localhost/api/requests/${id}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
const table = (singleResult: unknown, maybeResult?: unknown) => ({
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue(singleResult),
  maybeSingle: vi.fn().mockResolvedValue(maybeResult ?? singleResult),
});

beforeEach(() => {
  vi.clearAllMocks();
  state.authenticate.mockResolvedValue({ supabase: { from: state.from }, user: { id: owner } });
});

describe("Request HTTP behavior with a controlled Supabase boundary", () => {
  it("ignores client identity by rejecting forged fields before any database write", async () => {
    const response = await POST(write("POST", { ...input, user_id: "someone-else" }));
    expect(response.status).toBe(400);
    expect(state.from).not.toHaveBeenCalled();
  });
  it("uses the verified owner and lets the database assign initial status", async () => {
    const query = table({ data: row, error: null });
    state.from.mockReturnValue(query);
    const response = await POST(write("POST", input));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: row, replayed: false });
    expect(query.insert).toHaveBeenCalledWith({ ...input, user_id: owner });
  });
  it("returns an existing owned record on an identical retry", async () => {
    state.from.mockReturnValue(table({ data: null, error: { code: "23505" } }, { data: row }));
    const response = await POST(write("POST", input));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: row, replayed: true });
  });
  it("rejects a retry that changes the content", async () => {
    state.from.mockReturnValue(table({ data: null, error: { code: "23505" } }, { data: row }));
    const response = await POST(write("POST", { ...input, title: "Другая задача" }));
    expect(response.status).toBe(409);
  });
  it("does not return someone else's duplicate record", async () => {
    state.from.mockReturnValue(table({ data: null, error: { code: "23505" } }, { data: null }));
    const response = await POST(write("POST", input));
    expect(response.status).toBe(409);
    expect(await response.json()).not.toHaveProperty("data");
  });
  it("returns the same not-found result for an inaccessible request", async () => {
    state.from.mockReturnValue(table({ data: null, error: null }));
    const response = await GET(new Request(`http://localhost/api/requests/${id}`), context);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NOT_FOUND" });
  });
  it("cannot update an inaccessible request", async () => {
    state.from.mockReturnValue(table({ data: null, error: null }));
    const response = await PATCH(write("PATCH", { status: "В работе" }), context);
    expect(response.status).toBe(404);
  });
  it("rejects an unauthenticated create before accessing the database", async () => {
    state.authenticate.mockRejectedValue(new ApiError(401, "Войдите", "UNAUTHORIZED"));
    const response = await POST(write("POST", input));
    expect(response.status).toBe(401);
    expect(state.from).not.toHaveBeenCalled();
  });
  it("does not expose database internals on write failure", async () => {
    state.from.mockReturnValue(
      table({ data: null, error: { code: "INTERNAL", message: "private schema detail" } }),
    );
    const response = await POST(write("POST", input));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("private schema");
  });
});
