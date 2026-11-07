import { ApiError } from "./api";

/** Distinguish the email provider's quota from request throttling without exposing user existence. */
export function signupError(error: { code?: string; status?: number }): ApiError {
  if (error.code === "over_email_send_rate_limit") {
    return new ApiError(
      429,
      "Supabase ограничил отправку писем подтверждения. Повторные нажатия не помогут: попробуйте позже или обратитесь к администратору.",
      "EMAIL_RATE_LIMITED",
    );
  }
  if (error.code === "email_address_not_authorized") {
    return new ApiError(
      400,
      "Почтовый сервис проекта пока не может отправлять письма на этот адрес. Обратитесь к администратору.",
      "EMAIL_DELIVERY_RESTRICTED",
    );
  }
  if (error.code === "email_address_invalid") {
    return new ApiError(
      400,
      "Supabase не принимает этот адрес. Укажите действующую почту.",
      "INVALID_EMAIL",
    );
  }
  if (error.status === 429) {
    return new ApiError(
      429,
      "Слишком много запросов. Подождите и повторите попытку.",
      "RATE_LIMITED",
    );
  }
  return new ApiError(
    400,
    "Не удалось зарегистрироваться. Проверьте данные или попробуйте войти.",
    "SIGNUP_FAILED",
  );
}
