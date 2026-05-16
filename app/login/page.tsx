import { LoginForm } from "./login-form";

/**
 * The Login screen (plan §4, §16) — a quiet, centered single password field
 * under the wordmark. No tagline, no marketing copy: this is a gate, not a
 * landing page. The middleware lets `/login` through ungated so the screen is
 * always reachable.
 */
export default function LoginPage() {
  return (
    <main className="column flex min-h-screen flex-col items-center justify-center gap-6">
      <h1 className="text-h1 font-h1 text-ink">Pick Me a Dinner</h1>
      <LoginForm />
    </main>
  );
}
