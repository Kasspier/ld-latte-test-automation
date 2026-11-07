"use client";

import { useEffect, useRef, useState } from "react";
import { statuses, type AutomationRequest, type Status } from "@/lib/domain";
import { api, HttpError } from "@/lib/http";
import { AuthForm, type User } from "./auth-form";
import { Icon } from "./icon";
import { RequestEditor } from "./request-editor";

interface List {
  data: AutomationRequest[];
  total: number;
  page: number;
  pageSize: number;
}
const categoryIcon = { Бот: "bot", Интеграция: "link", Отчёт: "chart", Другое: "spark" } as const;
const badgeClass = { Новая: "new", "В работе": "progress", Завершена: "done" } as const;

export function Portal() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [setupError, setSetupError] = useState("");
  const [sessionRetry, setSessionRetry] = useState(0);
  const [list, setList] = useState<List | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "">("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<AutomationRequest | null | false>(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const logoutLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    setSetupError("");
    api<{ user: User }>("/api/auth/session", { signal: controller.signal })
      .then((result) => setUser(result.user))
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof HttpError && error.status === 401) setUser(null);
        else setSetupError(error.message);
      });
    return () => controller.abort();
  }, [sessionRetry]);

  function expired() {
    setUser(null);
    setList(null);
    setEditor(false);
    setNotice("");
    setError("");
    setQuery("");
    setStatus("");
    setPage(1);
  }

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () => {
        const params = new URLSearchParams({ q: query, page: String(page) });
        if (status) params.set("status", status);
        api<List>(`/api/requests?${params}`, { signal: controller.signal })
          .then(setList)
          .catch((error) => {
            if (controller.signal.aborted) return;
            if (error instanceof HttpError && error.status === 401) expired();
            else {
              setError(error.message);
              setList(null);
            }
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      query ? 300 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [user, query, status, page, revision]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  async function logout() {
    if (logoutLock.current) return;
    logoutLock.current = true;
    setLogoutBusy(true);
    setError("");
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      expired();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось выйти");
    } finally {
      logoutLock.current = false;
      setLogoutBusy(false);
    }
  }

  if (setupError)
    return (
      <main className="setup-page">
        <a className="brand" href="/">
          LD <span>LATTE</span>
          <i />
        </a>
        <div className="setup-card">
          <div className="mini-icon">
            <Icon name="link" size={28} />
          </div>
          <span className="eyebrow">ПЕРВЫЙ ЗАПУСК</span>
          <h1>
            Подключим рабочее
            <br />
            пространство
          </h1>
          <p className="muted">{setupError}</p>
          <ol>
            <li>Создайте тестовый проект Supabase.</li>
            <li>
              Выполните SQL-миграцию из папки <code>supabase/migrations</code>.
            </li>
            <li>
              Заполните <code>.env.local</code> по образцу <code>.env.example</code> и перезапустите
              приложение.
            </li>
          </ol>
          <p className="muted">Пошаговая инструкция находится в README проекта.</p>
          <button
            className="button primary"
            onClick={() => {
              setUser(undefined);
              setSessionRetry((v) => v + 1);
            }}
          >
            Проверить подключение
            <Icon name="arrow" size={18} />
          </button>
        </div>
      </main>
    );
  if (user === undefined)
    return (
      <main className="boot">
        <span className="brand">
          LD <span>LATTE</span>
          <i />
        </span>
        <span className="muted">Открываем пространство…</span>
      </main>
    );
  if (!user)
    return (
      <AuthForm
        onLogin={(value) => {
          setUser(value);
          setPage(1);
          setList(null);
        }}
      />
    );

  return (
    <div className="workspace">
      <aside className="sidebar">
        <a className="brand" href="/">
          LD <span>LATTE</span>
          <i />
        </a>
        <span className="sidebar-label">РАБОЧЕЕ ПРОСТРАНСТВО</span>
        <div className="nav-active">
          <Icon name="grid" size={19} />
          Мои заявки
          <span className="nav-dot" />
        </div>
        <div className="sidebar-guide">
          <div className="guide-icon">
            <Icon name="spark" size={23} />
          </div>
          <h3>
            Меньше рутины.
            <br />
            Больше возможностей.
          </h3>
          <p>Боты, интеграции и отчёты — начинаются с вашей идеи.</p>
          <button className="text-button" onClick={() => setEditor(null)}>
            Предложить идею <Icon name="arrow" size={16} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <span className="live-dot" /> ПОРТАЛ АВТОМАТИЗАЦИИ<span>СОЗДАНО ДЛЯ КОМАНДЫ</span>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar">
          <div className="breadcrumbs">
            Рабочее пространство
            <Icon name="chevron" size={13} />
            <strong>Мои заявки</strong>
          </div>
          <div className="account">
            <span className="avatar">{user.email?.slice(0, 1).toUpperCase() || "L"}</span>
            <span className="account-email">{user.email}</span>
            <button
              className="icon-button"
              type="button"
              aria-label="Выйти из аккаунта"
              title="Выйти"
              onClick={logout}
              disabled={logoutBusy}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>
        <main className="dashboard">
          <section className="hero">
            <div>
              <span className="eyebrow">
                <span className="tiny-line" /> ОТ ИДЕИ К АВТОМАТИЗАЦИИ
              </span>
              <h1>
                Освободите время
                <br />
                для <em>главного.</em>
              </h1>
              <p>
                Расскажите о задаче, которую пора упростить.
                <br />
                Все ваши идеи и их прогресс — в одном месте.
              </p>
              <button className="button primary" onClick={() => setEditor(null)}>
                <Icon name="plus" size={18} />
                Новая заявка
              </button>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="art-circle" />
              <span className="art-star">✳</span>
              <div className="art-card">
                <span className="art-check">
                  <Icon name="check" size={19} />
                </span>
                <div>
                  <strong>Идея обретает форму</strong>
                  <span>Один шаг к простым процессам</span>
                </div>
              </div>
              <span className="art-caption">MAKE ROOM FOR WHAT MATTERS</span>
            </div>
          </section>
          <section className="requests-section" aria-labelledby="requests-heading">
            <div className="section-heading">
              <div>
                <h2 id="requests-heading">
                  Мои заявки <span className="count">{loading ? "…" : (list?.total ?? "—")}</span>
                </h2>
                <p className="muted">
                  {query || status
                    ? "Результаты с учётом поиска и фильтра"
                    : "Ваши задачи, идеи и маленькие большие изменения"}
                </p>
              </div>
              <span className="private-note">
                <Icon name="check" size={14} /> Видны только вам
              </span>
            </div>
            <div className="toolbar">
              <div className="status-tabs" aria-label="Фильтр по статусу">
                {(["", ...statuses] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    onClick={() => {
                      setStatus(value);
                      setPage(1);
                    }}
                  >
                    {value || "Все заявки"}
                  </button>
                ))}
              </div>
              <label className="search-field">
                <Icon name="search" size={17} />
                <input
                  aria-label="Поиск по названию"
                  placeholder="Найти заявку…"
                  value={query}
                  maxLength={100}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Очистить поиск"
                    className="clear-search"
                    onClick={() => {
                      setQuery("");
                      setPage(1);
                    }}
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </label>
            </div>
            {error && (
              <div className="message error" role="alert">
                {error}
                <button className="text-button" onClick={() => setRevision((v) => v + 1)}>
                  Повторить
                </button>
              </div>
            )}
            <div className="request-list" aria-busy={loading}>
              {loading ? (
                <div className="list-loading" role="status">
                  Загружаем заявки…
                  <div className="skeleton" />
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              ) : list?.data.length ? (
                <>
                  <div className="list-columns" aria-hidden="true">
                    <span>ЗАЯВКА</span>
                    <span>КАТЕГОРИЯ</span>
                    <span>СОЗДАНА</span>
                    <span>СТАТУС</span>
                    <span />
                  </div>
                  {list.data.map((item) => (
                    <button
                      className="request-row"
                      key={item.id}
                      onClick={() => setEditor(item)}
                      aria-label={`Открыть заявку: ${item.title}`}
                    >
                      <div className="request-title">
                        <span
                          className={`category-icon category-${categoriesIndex(item.category)}`}
                        >
                          <Icon name={categoryIcon[item.category]} size={21} />
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <span>
                            <b className="compact-category">{item.category} · </b>
                            {item.description}
                          </span>
                        </div>
                      </div>
                      <span className="category-name">{item.category}</span>
                      <time dateTime={item.created_at}>
                        {new Intl.DateTimeFormat("ru-RU", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(item.created_at))}
                      </time>
                      <span className={`badge ${badgeClass[item.status]}`}>
                        <i />
                        {item.status}
                      </span>
                      <span className="row-arrow">
                        <Icon name="arrow" size={18} />
                      </span>
                    </button>
                  ))}
                </>
              ) : (
                !error && (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Icon name={query || status ? "search" : "spark"} size={30} />
                    </div>
                    <h3>
                      {query || status
                        ? "Таких заявок пока нет"
                        : "Большие изменения начинаются с идеи"}
                    </h3>
                    <p>
                      {query || status
                        ? "Попробуйте другое название или измените фильтр."
                        : "Создайте первую заявку — опишите задачу, а остальное постепенно обретёт форму."}
                    </p>
                    {query || status ? (
                      <button
                        className="button secondary"
                        onClick={() => {
                          setQuery("");
                          setStatus("");
                          setPage(1);
                        }}
                      >
                        Сбросить фильтры
                      </button>
                    ) : (
                      <button className="button secondary" onClick={() => setEditor(null)}>
                        <Icon name="plus" size={17} />
                        Создать первую заявку
                      </button>
                    )}
                  </div>
                )
              )}
            </div>
            {!loading && list && list.total > 20 && (
              <nav className="pagination" aria-label="Страницы заявок">
                <button
                  className="button secondary"
                  disabled={page === 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Назад
                </button>
                <span>
                  {page} / {Math.ceil(list.total / 20)}
                </span>
                <button
                  className="button secondary"
                  disabled={page * 20 >= list.total}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Далее
                </button>
              </nav>
            )}
          </section>
          <footer className="dashboard-footer">
            <span>LD LATTE · ИДЕИ, КОТОРЫЕ РАБОТАЮТ</span>
            <span>Пространство для полезных изменений</span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={19} />
          {notice}
          <button
            className="icon-button"
            onClick={() => setNotice("")}
            aria-label="Закрыть уведомление"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {editor !== false && (
        <RequestEditor
          item={editor}
          onClose={() => setEditor(false)}
          onExpired={expired}
          onSaved={(message) => {
            setEditor(false);
            setNotice(message);
            setRevision((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

function categoriesIndex(category: AutomationRequest["category"]) {
  return ["Бот", "Интеграция", "Отчёт", "Другое"].indexOf(category);
}
