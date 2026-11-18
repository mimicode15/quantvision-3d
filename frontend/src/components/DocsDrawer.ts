import { DOC_SECTIONS, type Block } from "../content/docs";
import { make } from "../dom";
import type { KatexLike } from "./MathHUD";

const loadKatex = async (): Promise<KatexLike> => {
  const { render } = await import("katex");
  return { render };
};

const FOCUSABLE = 'button, a[href], [tabindex]:not([tabindex="-1"])';

/** A slide-in panel that explains the hand controls and the math. Esc, the backdrop or Close shut it. */
export class DocsDrawer {
  readonly element: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly closeButton: HTMLButtonElement;
  private readonly body: HTMLElement;
  private opener: HTMLElement | null = null;
  private rendered = false;

  constructor(private readonly loader: () => Promise<KatexLike> = loadKatex) {
    this.element = make("div", "qv-drawer");
    this.element.hidden = true;

    const backdrop = make("div", "qv-drawer__backdrop");
    backdrop.addEventListener("click", () => this.close());

    this.panel = make("aside", "qv-drawer__panel");
    this.panel.setAttribute("role", "dialog");
    this.panel.setAttribute("aria-modal", "true");
    this.panel.setAttribute("aria-labelledby", "qv-docs-title");

    const head = make("div", "qv-drawer__head");
    const title = make("h2", undefined, "Docs");
    title.id = "qv-docs-title";
    this.closeButton = make("button", "qv-btn qv-drawer__close", "Close");
    this.closeButton.type = "button";
    this.closeButton.addEventListener("click", () => this.close());
    head.append(title, this.closeButton);

    this.body = make("div", "qv-drawer__body");
    const nav = make("nav", "qv-drawer__nav");
    nav.setAttribute("aria-label", "Docs sections");
    for (const section of DOC_SECTIONS) {
      const link = make("button", "qv-drawer__link", section.title);
      link.type = "button";
      link.addEventListener("click", () => {
        const target = this.body.querySelector(`#qv-doc-${section.id}`);
        if (target instanceof HTMLElement) {
          target.scrollIntoView({ block: "start" });
          target.focus({ preventScroll: true });
        }
      });
      nav.append(link);
    }

    this.panel.append(head, nav, this.body);
    this.element.append(backdrop, this.panel);
    this.element.addEventListener("keydown", (event) => this.onKey(event));
  }

  get isOpen(): boolean {
    return !this.element.hidden;
  }

  open(opener?: HTMLElement): void {
    if (this.isOpen) return;
    this.opener = opener ?? (document.activeElement as HTMLElement | null);
    // Build the text on first open so the page loads without it.
    if (!this.rendered) this.render();
    this.element.hidden = false;
    // one frame later so the slide-in transition runs
    requestAnimationFrame(() => this.element.classList.add("qv-drawer--open"));
    this.closeButton.focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.element.classList.remove("qv-drawer--open");
    this.element.hidden = true;
    this.opener?.focus();
    this.opener = null;
  }

  private onKey(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key !== "Tab") return;
    // keep Tab inside the panel while it is open
    const items = [...this.panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private render(): void {
    this.rendered = true;
    const mathNodes: { el: HTMLElement; tex: string }[] = [];

    for (const section of DOC_SECTIONS) {
      const wrap = make("section", "qv-doc");
      const heading = make("h3", undefined, section.title);
      heading.id = `qv-doc-${section.id}`;
      heading.tabIndex = -1;
      wrap.append(heading);
      for (const block of section.blocks) wrap.append(this.renderBlock(block, mathNodes));
      this.body.append(wrap);
    }

    this.loader()
      .then((katex) => {
        for (const { el, tex } of mathNodes) {
          try {
            katex.render(tex, el, { throwOnError: false, displayMode: true });
          } catch {
            /* leave the LaTeX text showing */
          }
        }
      })
      .catch(() => {
        /* KaTeX didn't load: the formulas stay as readable LaTeX */
      });
  }

  private renderBlock(block: Block, mathNodes: { el: HTMLElement; tex: string }[]): HTMLElement {
    if (block.kind === "p") return make("p", undefined, block.text);
    if (block.kind === "list") {
      const list = make("ul");
      for (const item of block.items) list.append(make("li", undefined, item));
      return list;
    }
    const figure = make("figure", "qv-doc__math");
    const formula = make("div", undefined, block.tex);
    mathNodes.push({ el: formula, tex: block.tex });
    figure.append(formula);
    if (block.caption) figure.append(make("figcaption", undefined, block.caption));
    return figure;
  }
}
