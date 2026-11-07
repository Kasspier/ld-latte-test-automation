import { mkdirSync, writeFileSync } from "node:fs";

// Generate deterministic Postman v2.1 JSON. Runtime IDs/tokens stay in run-local variables.
const test = (code) => ({
  listen: "test",
  script: { type: "text/javascript", exec: code.split("\n") },
});
const pre = (code) => ({
  listen: "prerequest",
  script: { type: "text/javascript", exec: code.split("\n") },
});
const status = (code) => `pm.test('HTTP ${code}', () => pm.response.to.have.status(${code}));`;
const body = "const body = pm.response.json();";
const check = (label, code) => `pm.test(${JSON.stringify(label)}, () => { ${code} });`;
const eq = (field, value) =>
  check(`${field} = ${value}`, `pm.expect(body.${field}).to.eql(${JSON.stringify(value)});`);

function req(name, method, url, payload, expected, extra = "", options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (options.token) headers.Authorization = `Bearer {{${options.token}}}`;
  return {
    name,
    request: {
      method,
      header: Object.entries(headers).map(([key, value]) => ({ key, value })),
      url,
      ...(payload !== undefined
        ? {
            body: {
              mode: "raw",
              raw: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
              options: { raw: { language: "json" } },
            },
          }
        : {}),
    },
    event: [
      ...(options.pre ? [pre(options.pre)] : []),
      test([status(expected), body, extra].filter(Boolean).join("\n")),
    ],
  };
}
const app = "{{base_url}}";
const rest = "{{supabase_url}}/rest/v1/requests";
const A = { token: "token_a" };
const B = { token: "token_b" };
const direct = (token, more = {}) => ({ token, headers: { apikey: "{{supabase_key}}", ...more } });
const payloadA = {
  id: "{{request_a}}",
  title: "{{search_title}}",
  description: "Собирать заявки без ручного переноса",
  category: "Бот",
};
const payloadB = {
  id: "{{request_b}}",
  title: "Заявка Б {{run_id}}",
  description: "Только для пользователя Б",
  category: "Отчёт",
};
const own = check(
  "Владелец — пользователь А",
  "pm.expect(body.data.user_id).to.eql(pm.variables.get('user_a')); ",
);
const unchanged = check(
  "Заявка не изменена атакой",
  "pm.expect(body.data.title).to.eql(pm.variables.get('search_title')); pm.expect(body.data.status).to.eql('В работе');",
);

const smoke = {
  name: "00 Contract smoke",
  item: [
    req(
      "Same-origin signup reaches validation",
      "POST",
      `${app}/api/auth/signup`,
      {},
      400,
      eq("code", "VALIDATION_ERROR"),
      { headers: { Origin: "{{base_url}}" } },
    ),
    req(
      "Invalid signup data",
      "POST",
      `${app}/api/auth/signup`,
      { email: "bad", password: "123" },
      400,
      eq("code", "VALIDATION_ERROR"),
    ),
    req(
      "Malformed JSON",
      "POST",
      `${app}/api/auth/login`,
      "{broken",
      400,
      eq("code", "INVALID_JSON"),
    ),
    req(
      "Unsupported content type",
      "POST",
      `${app}/api/auth/login`,
      "{}",
      415,
      eq("code", "UNSUPPORTED_MEDIA_TYPE"),
      { headers: { "Content-Type": "text/plain" } },
    ),
    req(
      "Cross-origin write",
      "POST",
      `${app}/api/auth/login`,
      {},
      403,
      eq("code", "ORIGIN_REJECTED"),
      { headers: { Origin: "https://untrusted.example" } },
    ),
    req(
      "Unexpected auth fields",
      "POST",
      `${app}/api/auth/signup`,
      { email: "test@example.com", password: "Good-test-pass123", admin: true },
      400,
      eq("code", "VALIDATION_ERROR"),
    ),
  ],
};

const setup = `
if (!pm.variables.get('run_id')) {
  const id = pm.variables.replaceIn('{{$guid}}');
  pm.variables.set('run_id', id);
  pm.variables.set('request_a', pm.variables.replaceIn('{{$guid}}'));
  pm.variables.set('request_b', pm.variables.replaceIn('{{$guid}}'));
  pm.variables.set('search_title', 'Postman ' + id);
  const domain = pm.environment.get('email_domain') || 'example.com';
  for (const user of ['a', 'b']) {
    const email = pm.environment.get('email_' + user);
    pm.variables.set('existing_' + user, Boolean(email));
    pm.variables.set('email_' + user, email || 'latte.' + id + '.' + user + '@' + domain);
    pm.variables.set('password_' + user, pm.environment.get('password_' + user) || 'Latte-Test!' + id);
  }
}
`;
const integration = {
  name: "01 Integration and RLS",
  event: [pre(setup)],
  item: [
    ...["a", "b"].map((user) =>
      req(
        `Register ${user.toUpperCase()} (skip if existing)`,
        "POST",
        `${app}/api/auth/signup`,
        { email: `{{email_${user}}}`, password: `{{password_${user}}}` },
        201,
        check(
          "Регистрация возвращает признак подтверждения",
          "pm.expect(body.confirmationRequired).to.be.a('boolean');",
        ) +
          "\n" +
          check(
            "Для автоматического нового пользователя подтверждение отключено",
            "pm.expect(body.confirmationRequired, 'Use confirmed existing accounts or disable Confirm email in a dedicated test project').to.eql(false);",
          ),
        { pre: `if (pm.variables.get('existing_${user}')) pm.execution.skipRequest();` },
      ),
    ),
    req(
      "Cookie login A",
      "POST",
      `${app}/api/auth/login`,
      { email: "{{email_a}}", password: "{{password_a}}" },
      200,
      check(
        "Вернулась почта А",
        "pm.expect(body.user.email).to.eql(pm.variables.get('email_a').toLowerCase());",
      ),
    ),
    req(
      "Cookie session A",
      "GET",
      `${app}/api/auth/session`,
      undefined,
      200,
      check(
        "Сессия принадлежит А",
        "pm.expect(body.user.email).to.eql(pm.variables.get('email_a').toLowerCase());",
      ),
    ),
    req("Cookie logout", "POST", `${app}/api/auth/logout`, {}, 200, eq("ok", true)),
    req(
      "Cookie session after logout",
      "GET",
      `${app}/api/auth/session`,
      undefined,
      401,
      eq("code", "UNAUTHORIZED"),
    ),
    ...["a", "b"].map((user) =>
      req(
        `Get Supabase token ${user.toUpperCase()}`,
        "POST",
        "{{supabase_url}}/auth/v1/token?grant_type=password",
        { email: `{{email_${user}}}`, password: `{{password_${user}}}` },
        200,
        check(
          "Токен и пользователь получены",
          "pm.expect(body.access_token).to.be.a('string').and.not.empty; pm.expect(body.user.id).to.be.a('string');",
        ) +
          `\npm.variables.set('token_${user}', body.access_token); pm.variables.set('user_${user}', body.user.id);`,
        { headers: { apikey: "{{supabase_key}}" } },
      ),
    ),
    req(
      "Invalid bearer token",
      "GET",
      `${app}/api/requests`,
      undefined,
      401,
      eq("code", "UNAUTHORIZED"),
      { headers: { Authorization: "Bearer invalid-token" } },
    ),
    req(
      "Create A",
      "POST",
      `${app}/api/requests`,
      payloadA,
      201,
      [own, eq("data.status", "Новая"), eq("replayed", false)].join("\n"),
      A,
    ),
    req("Replay create A", "POST", `${app}/api/requests`, payloadA, 200, eq("replayed", true), A),
    req(
      "Conflicting create A",
      "POST",
      `${app}/api/requests`,
      { ...payloadA, title: "Изменённый запрос" },
      409,
      eq("code", "ID_CONFLICT"),
      A,
    ),
    req(
      "Exactly one A after retry",
      "GET",
      `${app}/api/requests?q={{search_title}}`,
      undefined,
      200,
      eq("total", 1) +
        "\n" +
        check(
          "Одна запись с нужным ID",
          "pm.expect(body.data).to.have.lengthOf(1); pm.expect(body.data[0].id).to.eql(pm.variables.get('request_a'));",
        ),
      A,
    ),
    req(
      "Read A after separate request",
      "GET",
      `${app}/api/requests/{{request_a}}`,
      undefined,
      200,
      own,
      A,
    ),
    req(
      "Edit A and set in progress",
      "PATCH",
      `${app}/api/requests/{{request_a}}`,
      { description: "Изменённое описание", category: "Интеграция", status: "В работе" },
      200,
      [
        eq("data.description", "Изменённое описание"),
        eq("data.category", "Интеграция"),
        eq("data.status", "В работе"),
      ].join("\n"),
      A,
    ),
    req(
      "Combined title search and status",
      "GET",
      `${app}/api/requests?q={{search_title}}&status=${encodeURIComponent("В работе")}`,
      undefined,
      200,
      eq("total", 1),
      A,
    ),
    req(
      "Nonmatching status",
      "GET",
      `${app}/api/requests?q={{search_title}}&status=${encodeURIComponent("Новая")}`,
      undefined,
      200,
      eq("total", 0),
      A,
    ),
    req(
      "Empty search result",
      "GET",
      `${app}/api/requests?q=missing-{{run_id}}`,
      undefined,
      200,
      eq("total", 0),
      A,
    ),
    req(
      "Invalid list status",
      "GET",
      `${app}/api/requests?status=Invalid`,
      undefined,
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Invalid page",
      "GET",
      `${app}/api/requests?page=0`,
      undefined,
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Invalid request ID",
      "GET",
      `${app}/api/requests/bad-id`,
      undefined,
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Blank required field",
      "POST",
      `${app}/api/requests`,
      { ...payloadA, title: "   " },
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Invalid category",
      "POST",
      `${app}/api/requests`,
      { ...payloadA, category: "Unknown" },
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Cannot inject owner through API",
      "POST",
      `${app}/api/requests`,
      { ...payloadA, user_id: "{{user_b}}" },
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Cannot inject initial status",
      "POST",
      `${app}/api/requests`,
      { ...payloadA, status: "Завершена" },
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Empty patch",
      "PATCH",
      `${app}/api/requests/{{request_a}}`,
      {},
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "Cannot update owner through API",
      "PATCH",
      `${app}/api/requests/{{request_a}}`,
      { user_id: "{{user_b}}" },
      400,
      eq("code", "VALIDATION_ERROR"),
      A,
    ),
    req(
      "B cannot read A",
      "GET",
      `${app}/api/requests/{{request_a}}`,
      undefined,
      404,
      eq("code", "NOT_FOUND"),
      B,
    ),
    req(
      "B cannot update A",
      "PATCH",
      `${app}/api/requests/{{request_a}}`,
      { title: "Взлом" },
      404,
      eq("code", "NOT_FOUND"),
      B,
    ),
    req(
      "B list excludes A",
      "GET",
      `${app}/api/requests?q={{search_title}}`,
      undefined,
      200,
      eq("total", 0),
      B,
    ),
    req(
      "Create B",
      "POST",
      `${app}/api/requests`,
      payloadB,
      201,
      check("Владелец — Б", "pm.expect(body.data.user_id).to.eql(pm.variables.get('user_b'));"),
      B,
    ),
    req(
      "A cannot read B",
      "GET",
      `${app}/api/requests/{{request_b}}`,
      undefined,
      404,
      eq("code", "NOT_FOUND"),
      A,
    ),
    req(
      "Direct REST A can read own row",
      "GET",
      `${rest}?id=eq.{{request_a}}&select=*`,
      undefined,
      200,
      check(
        "Одна своя запись",
        "pm.expect(body).to.have.lengthOf(1); pm.expect(body[0].user_id).to.eql(pm.variables.get('user_a'));",
      ),
      direct("token_a"),
    ),
    req(
      "Direct REST B cannot read A",
      "GET",
      `${rest}?id=eq.{{request_a}}&select=*`,
      undefined,
      200,
      check("RLS возвращает пустой массив", "pm.expect(body).to.eql([]);"),
      direct("token_b"),
    ),
    req(
      "Direct REST B cannot update A",
      "PATCH",
      `${rest}?id=eq.{{request_a}}`,
      { title: "Взлом через REST" },
      200,
      check("Нет изменённых строк", "pm.expect(body).to.eql([]);"),
      direct("token_b", { Prefer: "return=representation" }),
    ),
    req(
      "Direct REST cannot forge owner on insert",
      "POST",
      rest,
      { user_id: "{{user_a}}", title: "Чужая заявка", description: "X", category: "Бот" },
      403,
      eq("code", "42501"),
      direct("token_b"),
    ),
    req(
      "Direct REST cannot change owner",
      "PATCH",
      `${rest}?id=eq.{{request_a}}`,
      { user_id: "{{user_b}}" },
      403,
      eq("code", "42501"),
      direct("token_a"),
    ),
    req(
      "Direct REST cannot change creation time",
      "PATCH",
      `${rest}?id=eq.{{request_a}}`,
      { created_at: "2000-01-01T00:00:00Z" },
      403,
      eq("code", "42501"),
      direct("token_a"),
    ),
    req(
      "Direct REST cannot choose initial status",
      "POST",
      rest,
      { title: "X", description: "Y", category: "Бот", status: "Завершена" },
      403,
      eq("code", "42501"),
      direct("token_a"),
    ),
    req(
      "Direct REST category constraint",
      "POST",
      rest,
      { title: "X", description: "Y", category: "Invalid" },
      400,
      eq("code", "23514"),
      direct("token_a"),
    ),
    req(
      "Direct REST cannot delete",
      "DELETE",
      `${rest}?id=eq.{{request_a}}`,
      undefined,
      403,
      eq("code", "42501"),
      direct("token_a"),
    ),
    req(
      "Verify A unchanged after all attacks",
      "GET",
      `${app}/api/requests/{{request_a}}`,
      undefined,
      200,
      unchanged,
      A,
    ),
    req(
      "Complete A",
      "PATCH",
      `${app}/api/requests/{{request_a}}`,
      { status: "Завершена" },
      200,
      eq("data.status", "Завершена"),
      A,
    ),
    req(
      "Completed filter",
      "GET",
      `${app}/api/requests?q={{search_title}}&status=${encodeURIComponent("Завершена")}`,
      undefined,
      200,
      eq("total", 1),
      A,
    ),
  ],
};

mkdirSync(new URL("../postman/", import.meta.url), { recursive: true });
const collection = {
  info: {
    name: "LD LATTE — API and Supabase RLS",
    description:
      "Run 00 Contract smoke without Supabase. Run 01 Integration and RLS against a dedicated configured test project. Read docs/TESTING.md first. Uses two users and run-local bearer tokens. Creates test records; no destructive cleanup.",
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [smoke, integration],
};
writeFileSync(
  new URL("../postman/LD-LATTE.postman_collection.json", import.meta.url),
  JSON.stringify(collection, null, 2) + "\n",
);
const environment = {
  name: "LD LATTE local — fill locally",
  values: Object.entries({
    base_url: "http://127.0.0.1:3000",
    supabase_url: "",
    supabase_key: "",
    email_domain: "example.com",
    email_a: "",
    password_a: "",
    email_b: "",
    password_b: "",
  }).map(([key, value]) => ({
    key,
    value,
    enabled: true,
    type: key.startsWith("password") ? "secret" : "default",
  })),
  _postman_variable_scope: "environment",
};
writeFileSync(
  new URL("../postman/local.postman_environment.json", import.meta.url),
  JSON.stringify(environment, null, 2) + "\n",
);
console.log(`Generated ${smoke.item.length + integration.item.length} requests in 2 folders.`);
