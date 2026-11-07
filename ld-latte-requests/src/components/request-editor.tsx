"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { categories, statuses, type AutomationRequest, type RequestDraft } from "@/lib/domain";
import { api, HttpError } from "@/lib/http";
import { Icon } from "./icon";

export function RequestEditor({
  item,
  onClose,
  onSaved,
  onExpired,
}: {
  item: AutomationRequest | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  onExpired: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const initial: RequestDraft = item
    ? {
        title: item.title,
        description: item.description,
        category: item.category,
        status: item.status,
      }
    : { title: "", description: "", category: "Бот", status: "Новая" };
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const stableId = useRef<string | null>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function close() {
    if (lock.current) return;
    if (
      JSON.stringify(draft) !== JSON.stringify(initial) &&
      !window.confirm("Закрыть без сохранения изменений?")
    )
      return;
    onClose();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    stableId.current ??= crypto.randomUUID();
    const fields = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: draft.category,
    };
    if (!fields.title || !fields.description) {
      setError("Название и описание не должны состоять из пробелов.");
      lock.current = false;
      setBusy(false);
      return;
    }
    try {
      await api(item ? `/api/requests/${item.id}` : "/api/requests", {
        method: item ? "PATCH" : "POST",
        body: JSON.stringify(
          item ? { ...fields, status: draft.status } : { ...fields, id: stableId.current },
        ),
      });
      onSaved(item ? "Изменения сохранены" : "Заявка создана. Первый шаг сделан!");
    } catch (error) {
      if (error instanceof HttpError && error.status === 401) {
        onExpired();
        return;
      }
      setError(error instanceof Error ? error.message : "Не удалось сохранить заявку");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="editor"
      aria-labelledby="editor-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="editor-head">
        <div>
          <span className="eyebrow">ОТ ИДЕИ К РЕЗУЛЬТАТУ</span>
          <h2 id="editor-title">{item ? "Ваша заявка" : "Новая заявка"}</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          aria-label="Закрыть"
          onClick={close}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
      <p className="muted">
        {item
          ? "Уточните детали или обновите статус задачи."
          : "Расскажите, какую задачу вы хотите автоматизировать."}
      </p>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <label>
            Название <span className="required">*</span>
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Например, бот для записи клиентов"
              required
              maxLength={160}
            />
          </label>
          <label>
            Описание задачи <span className="required">*</span>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Что сейчас делаете вручную? Какой результат хотите получить?"
              required
              maxLength={5000}
              rows={5}
            />
            <span className="field-hint">{draft.description.length} / 5000</span>
          </label>
          <div className="form-row">
            <label>
              Категория <span className="required">*</span>
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as RequestDraft["category"] })
                }
              >
                {categories.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            {item ? (
              <label>
                Статус
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft({ ...draft, status: e.target.value as RequestDraft["status"] })
                  }
                >
                  {statuses.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="new-status">
                <span>Начальный статус</span>
                <span className="badge new">Новая</span>
              </div>
            )}
          </div>
        </fieldset>
        {error && (
          <div className="message error" role="alert">
            {error}
          </div>
        )}
        <div className="editor-footer">
          <button type="button" className="button secondary" onClick={close} disabled={busy}>
            Отмена
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? "Сохраняем…" : item ? "Сохранить изменения" : "Создать заявку"}
            <Icon name={item ? "check" : "plus"} size={18} />
          </button>
        </div>
      </form>
    </dialog>
  );
}
