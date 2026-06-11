/**
 * Canvas-only responsive layer for the Visual editor's preview frame. The frame sets
 * `container-type: inline-size`; these rules restate brandCss's width-based @media
 * breakpoints as @container rules so narrowing the frame reflows chrome and sections
 * truthfully (the public site keeps its @media rules). Kept in sync with brandCss by
 * test/theme/frame-container-css.test.ts.
 */
export const frameContainerCss = `
@container (max-width: 900px) {
  .nac-feature-grid[data-columns="3"],
  .nac-feature-grid[data-columns="4"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width: 640px) {
  .nac-feature-grid[data-columns] {
    grid-template-columns: 1fr;
  }
}
@container (max-width: 900px) {
  .nac-stat-grid[data-columns="3"],
  .nac-stat-grid[data-columns="4"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@container (max-width: 640px) {
  .nac-stat-grid[data-columns] {
    grid-template-columns: 1fr;
  }
}
@container (max-width: 640px) {
  .nac-pricing {
    grid-template-columns: 1fr;
  }
}
@container (max-width: 768px) {
  .nac-split {
    grid-template-columns: 1fr;
    direction: ltr;
  }

  .nac-split[data-side="right"] {
    direction: ltr;
  }
}
@container (max-width: 768px) {
  /* Higher specificity than Tailwind's .flex utility on the desktop nav. */
  .nac-header .nac-nav {
    display: none;
  }

  .nac-nav-toggle {
    display: inline-flex;
  }

  /* The mobile nav panel sits below the header bar, full-width. */
  .nac-header .nac-mobile-nav {
    display: none;
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    flex-direction: column;
    background: var(--paper);
    border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem 1.5rem;
    gap: 0.25rem;
    z-index: 9;
    box-shadow: 0 4px 16px color-mix(in srgb, var(--ink) 8%, transparent);
  }

  .nac-header[data-open] .nac-mobile-nav {
    display: flex;
  }

  /* Ensure the header is a positioning context for the dropdown. */
  .nac-header {
    position: sticky;
    top: 0;
  }

  .nac-mobile-nav-link {
    display: block;
    padding: 0.625rem 0;
    font-size: 1rem;
    color: var(--muted);
    text-decoration: none;
    border-bottom: 1px solid var(--border);
    transition: color 0.15s ease;
  }

  .nac-mobile-nav-link:last-of-type {
    border-bottom: none;
  }

  .nac-mobile-nav-link:hover,
  .nac-mobile-nav-link:focus-visible {
    color: var(--accent);
  }

  .nac-mobile-nav-link:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
    border-radius: 2px;
  }

  .nac-mobile-cta {
    margin-top: 0.75rem;
    text-align: center;
  }
}
@container (max-width: 768px) {
  .nac-footer-columns {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@container (max-width: 640px) {
  .nac-footer-columns {
    grid-template-columns: 1fr 1fr;
  }
}
@container (max-width: 640px) {
  .nac-collection[data-layout] {
    grid-template-columns: 1fr;
  }
}
`
