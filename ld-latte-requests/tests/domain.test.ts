import { describe, expect, it } from "vitest";
import {
  createRequestSchema,
  updateRequestSchema,
  credentialsSchema,
  listSchema,
  escapeLike,
} from "../src/lib/domain";

const draft = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "  Бот  ",
  description: "  Сбор заявок  ",
  category: "Бот",
};

describe("Request validation", () => {
  it("trims required text before saving", () => {
    expect(createRequestSchema.parse(draft)).toMatchObject({
      title: "Бот",
      description: "Сбор заявок",
    });
  });
  it.each(["", "   ", "\n\t"])("rejects an empty title: %j", (title) => {
    expect(createRequestSchema.safeParse({ ...draft, title }).success).toBe(false);
  });
  it("rejects blank description and unknown category", () => {
    expect(createRequestSchema.safeParse({ ...draft, description: " " }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...draft, category: "Admin" }).success).toBe(false);
  });
  it.each(["user_id", "created_at", "status"])("rejects mass assignment on creation: %s", (key) => {
    expect(createRequestSchema.safeParse({ ...draft, [key]: "forged" }).success).toBe(false);
  });
  it.each(["id", "user_id", "created_at", "updated_at"])(
    "rejects protected update field: %s",
    (key) => {
      expect(updateRequestSchema.safeParse({ title: "Valid", [key]: draft.id }).success).toBe(
        false,
      );
    },
  );
  it("allows all specified statuses and rejects an empty patch", () => {
    for (const status of ["Новая", "В работе", "Завершена"])
      expect(updateRequestSchema.safeParse({ status }).success).toBe(true);
    expect(updateRequestSchema.safeParse({}).success).toBe(false);
    expect(updateRequestSchema.safeParse({ status: "Удалена" }).success).toBe(false);
  });
  it("validates maximum lengths and IDs", () => {
    expect(createRequestSchema.safeParse({ ...draft, id: "bad" }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...draft, title: "a".repeat(161) }).success).toBe(false);
    expect(createRequestSchema.safeParse({ ...draft, description: "a".repeat(5001) }).success).toBe(
      false,
    );
  });
});

describe("Search and authentication input", () => {
  it("escapes wildcard characters without changing Cyrillic", () => {
    expect(escapeLike("Бот 50%_\\")).toBe("Бот 50\\%\\_\\\\");
  });
  it("validates pagination and known status", () => {
    expect(listSchema.parse({})).toEqual({ q: "", page: 1 });
    expect(listSchema.safeParse({ page: "-1" }).success).toBe(false);
    expect(listSchema.safeParse({ page: "1.5" }).success).toBe(false);
    expect(listSchema.safeParse({ status: "bad" }).success).toBe(false);
  });
  it("normalizes email but never changes the password", () => {
    expect(
      credentialsSchema.parse({ email: "USER@example.com", password: "  ABCdef123  " }),
    ).toEqual({ email: "user@example.com", password: "  ABCdef123  " });
  });
  it("rejects invalid email and weak short password", () => {
    expect(credentialsSchema.safeParse({ email: "bad", password: "long-enough" }).success).toBe(
      false,
    );
    expect(credentialsSchema.safeParse({ email: "a@b.com", password: "123" }).success).toBe(false);
  });
});
