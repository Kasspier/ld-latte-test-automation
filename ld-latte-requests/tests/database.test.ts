import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID = "11111111-1111-4111-8111-111111111111";
let db: PGlite;

/** Real PostgreSQL execution. Only Supabase's auth schema/JWT accessor is emulated. */
async function asUser<T>(
  user: string,
  fn: (tx: Parameters<Parameters<PGlite["transaction"]>[0]>[0]) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    return fn(tx);
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `);
  await db.query("insert into auth.users values ($1), ($2)", [A, B]);
  await db.exec(
    readFileSync(
      new URL("../supabase/migrations/20261106131943_create_automation_requests.sql", import.meta.url),
      "utf8",
    ),
  );
}, 60000);
afterAll(async () => {
  await db?.close();
});

describe.sequential("Migration, privileges and RLS against PostgreSQL", () => {
  it("creates an owned request with database default status", async () => {
    const result = await asUser(A, (tx) =>
      tx.query<{ user_id: string; status: string }>(
        "insert into public.requests(id,title,description,category) values ($1,'Тест','Описание','Бот') returning *",
        [ID],
      ),
    );
    expect(result.rows[0]).toMatchObject({ user_id: A, status: "Новая" });
  });
  it("persists data across separate transactions", async () => {
    const result = await asUser(A, (tx) =>
      tx.query("select * from public.requests where id=$1", [ID]),
    );
    expect(result.rows).toHaveLength(1);
  });
  it("hides A's request from B at the database level", async () => {
    const result = await asUser(B, (tx) =>
      tx.query("select * from public.requests where id=$1", [ID]),
    );
    expect(result.rows).toEqual([]);
  });
  it("prevents B from updating A's request", async () => {
    const result = await asUser(B, (tx) =>
      tx.query("update public.requests set title='Взлом' where id=$1 returning *", [ID]),
    );
    expect(result.rows).toEqual([]);
  });
  it("rejects owner impersonation on insert", async () => {
    await expect(
      asUser(B, (tx) =>
        tx.query(
          "insert into public.requests(user_id,title,description,category) values ($1,'X','Y','Бот')",
          [A],
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it.each(["user_id", "id", "created_at", "updated_at"])(
    "denies direct changes to protected column %s",
    async (column) => {
      await expect(
        asUser(A, (tx) =>
          tx.query(`update public.requests set ${column}=${column} where id=$1`, [ID]),
        ),
      ).rejects.toMatchObject({ code: "42501" });
    },
  );
  it("does not allow bypassing the initial status through direct REST-equivalent insert", async () => {
    await expect(
      asUser(A, (tx) =>
        tx.query(
          "insert into public.requests(title,description,category,status) values ('X','Y','Бот','Завершена')",
        ),
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("enforces required text and category constraints independently of Next.js", async () => {
    await expect(
      asUser(A, (tx) =>
        tx.query("insert into public.requests(title,description,category) values (' ','Y','Бот')"),
      ),
    ).rejects.toMatchObject({ code: "23514" });
    await expect(
      asUser(A, (tx) =>
        tx.query(
          "insert into public.requests(title,description,category) values ('X','Y','Unknown')",
        ),
      ),
    ).rejects.toMatchObject({ code: "23514" });
  });
  it("allows editing own request and updates the timestamp", async () => {
    const result = await asUser(A, (tx) =>
      tx.query<{ status: string; updated_at: Date; created_at: Date }>(
        "update public.requests set status='В работе',title='Обновлено' where id=$1 returning *",
        [ID],
      ),
    );
    expect(result.rows[0].status).toBe("В работе");
    expect(new Date(result.rows[0].updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(result.rows[0].created_at).getTime(),
    );
  });
  it("denies deletion even to the owner", async () => {
    await expect(
      asUser(A, (tx) => tx.query("delete from public.requests where id=$1", [ID])),
    ).rejects.toMatchObject({ code: "42501" });
  });
  it("denies anonymous access", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.exec("set local role anon");
        return tx.query("select * from public.requests");
      }),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
