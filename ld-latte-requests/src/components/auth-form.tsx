"use client";

import { useRef, useState, type FormEvent } from "react";
import { api } from "@/lib/http";
import { Icon } from "./icon";

export interface User {
  id: string;
  email: string;
}

export function AuthForm({ onLogin }: { onLogin: (user: User) => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const result = await api<{ user: User | null; message?: string }>(`/api/auth/${mode}`, {
        method: "POST",
        body: JSON.stringify({
          email: String(values.get("email")).trim(),
          password: values.get("password"),
        }),
      });
      form.reset();
      if (result.user) onLogin(result.user);
      else {
        setMode("login");
        setNotice(result.message || "Подтвердите почту и войдите в аккаунт.");
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <a className="brand" href="/" aria-label="LD LATTE — главная">
          LD <span>LATTE</span>
          <i />
        </a>
        <div>
          <span className="eyebrow">РАБОТАЕМ ПРОЩЕ</span>
          <h1>
            Хорошие идеи
            <br />
            заслуживают
            <br />
            <em>реализации.</em>
          </h1>
          <p>
            Оставляйте заявки на автоматизацию.
            <br />
            Следите за прогрессом. Освобождайте
            <br />
            время для того, что действительно важно.
          </p>
        </div>
        <span className="story-foot">ВНУТРЕННИЕ ИНСТРУМЕНТЫ · LD LATTE</span>
        <div className="orbit" aria-hidden="true">
          <div />
          <span>✳</span>
        </div>
      </section>
      <section className="auth-side">
        <div className="auth-card">
          <div className="mini-icon">
            <Icon name="spark" size={25} />
          </div>
          <span className="eyebrow">ПОРТАЛ АВТОМАТИЗАЦИИ</span>
          <h2>{mode === "login" ? "С возвращением" : "Начнём знакомство"}</h2>
          <p className="muted">
            {mode === "login"
              ? "Войдите, чтобы вернуться к своим заявкам."
              : "Создайте аккаунт для ваших идей и задач."}
          </p>
          <div className="auth-tabs" aria-label="Действие с аккаунтом">
            <button
              type="button"
              aria-pressed={mode === "login"}
              disabled={busy}
              onClick={() => {
                setMode("login");
                setError("");
                setNotice("");
              }}
            >
              Вход
            </button>
            <button
              type="button"
              aria-pressed={mode === "signup"}
              disabled={busy}
              onClick={() => {
                setMode("signup");
                setError("");
                setNotice("");
              }}
            >
              Регистрация
            </button>
          </div>
          <form onSubmit={submit}>
            <label>
              Электронная почта
              <input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
                maxLength={254}
                disabled={busy}
              />
            </label>
            <label>
              Пароль
              <input
                name="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                placeholder="Не менее 8 символов"
                required
                minLength={8}
                maxLength={128}
                disabled={busy}
              />
            </label>
            {error && (
              <div className="message error" role="alert">
                {error}
              </div>
            )}
            {notice && (
              <div className="message success" role="status">
                {notice}
              </div>
            )}
            <button className="button primary full" disabled={busy}>
              {busy ? "Подождите…" : mode === "login" ? "Войти в аккаунт" : "Создать аккаунт"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <p className="auth-note">
            <Icon name="check" size={15} /> Ваши заявки доступны только вам
          </p>
        </div>
        <span className="auth-copyright">LD LATTE / ПРОСТРАНСТВО ДЛЯ ИДЕЙ</span>
      </section>
    </main>
  );
}
