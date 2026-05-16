import { requireSession } from "./require-session";

/**
 * Wrap a Server Action so it runs only for an authenticated session
 * (review fix F1). Authentication is the default: every mutating action is
 * wrapped with this. `login` is the single deliberate exception — it cannot
 * authenticate, it is how a session starts.
 *
 * The wrapper preserves the action's argument and return types, so a wrapped
 * action is a drop-in for the bare one at every call site.
 */
export function authedAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  return async (...args: Args): Promise<Result> => {
    await requireSession();
    return action(...args);
  };
}
