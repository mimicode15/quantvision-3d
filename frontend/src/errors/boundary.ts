import { make } from "../dom";
import { ErrorThrottle, isHarmless } from "./throttle";

const AUTO_HIDE_MS = 12_000;

/**
 * Catches errors nothing else caught and shows a small, dismissible notice instead of leaving
 * the page silently broken. Returns a function that removes it again.
 */
export function installErrorBoundary(host: HTMLElement = document.body): () => void {
  const throttle = new ErrorThrottle();
  let toast: HTMLElement | null = null;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const hide = (): void => {
    clearTimeout(hideTimer);
    toast?.remove();
    toast = null;
  };

  const report = (error: unknown): void => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (isHarmless(message)) return;
    console.error(error);
    if (!throttle.allow(Date.now())) return;

    hide();
    toast = make("div", "qv-toast");
    toast.setAttribute("role", "alert");
    const text = make(
      "p",
      undefined,
      "Something went wrong. Most of the app should keep working. If a control stops responding, reload the page.",
    );
    const detail = make("p", "qv-toast__detail", message.slice(0, 140));
    const reload = make("button", "qv-btn", "Reload");
    reload.type = "button";
    reload.addEventListener("click", () => window.location.reload());
    const close = make("button", "qv-btn", "Dismiss");
    close.type = "button";
    close.addEventListener("click", hide);
    const buttons = make("div", "qv-buttons");
    buttons.append(reload, close);
    toast.append(text, detail, buttons);
    host.append(toast);
    hideTimer = setTimeout(hide, AUTO_HIDE_MS);
  };

  const onError = (event: ErrorEvent): void => report(event.error ?? event.message);
  const onRejection = (event: PromiseRejectionEvent): void => report(event.reason);
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
    hide();
  };
}
