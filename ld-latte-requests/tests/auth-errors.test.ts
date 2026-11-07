import { describe, expect, it } from "vitest";
import { signupError } from "../src/lib/auth-errors";

describe("Signup error messages", () => {
  it("identifies the email quota independently of general request throttling", () => {
    const error = signupError({ status: 429, code: "over_email_send_rate_limit" });
    expect(error).toMatchObject({ status: 429, code: "EMAIL_RATE_LIMITED" });
    expect(error.message).toContain("писем подтверждения");
  });
  it("explains the built-in mail recipient restriction", () => {
    expect(signupError({ status: 400, code: "email_address_not_authorized" })).toMatchObject({
      status: 400,
      code: "EMAIL_DELIVERY_RESTRICTED",
    });
  });
  it("reports a rejected email address", () => {
    expect(signupError({ status: 400, code: "email_address_invalid" })).toMatchObject({
      status: 400,
      code: "INVALID_EMAIL",
    });
  });
  it("keeps request limits separate", () => {
    expect(signupError({ status: 429, code: "over_request_rate_limit" })).toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
  });
  it("does not reveal whether an email is already registered", () => {
    expect(signupError({ status: 400, code: "user_already_exists" })).toMatchObject({
      status: 400,
      code: "SIGNUP_FAILED",
    });
  });
});
