"use client";

import { useActionState, useId } from "react";
import { login, type LoginState } from "./actions";

const INITIAL: LoginState = {};

const focusRing =
  "focus-visible:outline focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-action";

/**
 * The Login form — a single password field and nothing else. A wrong password
 * fills `state.error` with an inline message; React 19 resets the uncontrolled
 * field after the action, so the cleared input is automatic.
 */
export function LoginForm() {
  const fieldId = useId();
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    INITIAL,
  );
  const errorId = `${fieldId}-error`;

  return (
    <form action={formAction} className="flex w-full flex-col gap-3">
      <label htmlFor={fieldId} className="sr-only">
        Password
      </label>
      <input
        id={fieldId}
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        aria-invalid={state.error != null}
        aria-describedby={state.error ? errorId : undefined}
        className={`min-h-11 rounded-input border border-line bg-surface px-3
          text-body text-ink ${focusRing}`}
      />
      {state.error && (
        <p id={errorId} role="alert" className="text-chip text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`min-h-11 rounded-control bg-action px-4 text-body
          font-emphasis text-action-ink transition-colors duration-micro
          hover:bg-action-hover disabled:opacity-60 ${focusRing}`}
      >
        Enter
      </button>
    </form>
  );
}
