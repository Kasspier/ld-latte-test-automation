import { z } from "zod";

export const categories = ["Бот", "Интеграция", "Отчёт", "Другое"] as const;
export const statuses = ["Новая", "В работе", "Завершена"] as const;
export const requestFields = {
  title: z.string().trim().min(1, "Укажите название").max(160, "Не более 160 символов"),
  description: z.string().trim().min(1, "Опишите задачу").max(5000, "Не более 5000 символов"),
  category: z.enum(categories),
};
export const createRequestSchema = z.object({ id: z.uuid(), ...requestFields }).strict();
export const updateRequestSchema = z
  .object({
    ...requestFields,
    status: z.enum(statuses),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Нет изменений");
export const credentialsSchema = z
  .object({
    email: z
      .email("Укажите корректную почту")
      .max(254)
      .transform((value) => value.toLowerCase()),
    password: z
      .string()
      .min(8, "Пароль: минимум 8 символов")
      .max(128, "Пароль: максимум 128 символов"),
  })
  .strict();
export const listSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(statuses).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

/** Escape LIKE wildcards: search treats a user-entered % or _ as literal text. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

export type Category = (typeof categories)[number];
export type Status = (typeof statuses)[number];
export interface AutomationRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: Category;
  status: Status;
  created_at: string;
  updated_at: string;
}
export type RequestDraft = Pick<AutomationRequest, "title" | "description" | "category" | "status">;
