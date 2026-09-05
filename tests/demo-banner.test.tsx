import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import DemoBanner, { DEMO_BANNER_HEIGHT } from "@/components/ui/DemoBanner";

/**
 * The banner is the only thing telling a visitor that this deployment cannot
 * move funds, so "it renders" is not enough — it has to be *visible*. The nav
 * is `fixed top-0`, so a banner placed in normal flow would sit behind it.
 * These tests pin the layering contract that keeps it on top.
 */

function z(source: string): number | null {
  const tw = source.match(/z-\[(\d+)\]/);
  if (tw) return Number(tw[1]);
  const cls = source.match(/\bz-(\d+)\b/);
  return cls ? Number(cls[1]) : null;
}

describe("demo banner", () => {
  it("says the deployment cannot move funds", () => {
    const { container } = render(<DemoBanner />);
    const text = container.textContent ?? "";
    expect(text).toMatch(/TESTNET DEMO/);
    expect(text).toMatch(/escrow disabled/i);
  });

  it("points at the repository that replaces this one", () => {
    const { container } = render(<DemoBanner />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("https://github.com/wienerlabs/mandate");
  });

  it("is pinned to the top of the viewport, not in normal flow", () => {
    const { container } = render(<DemoBanner />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toMatch(/\bfixed\b/);
    expect(el.className).toMatch(/\btop-0\b/);
    expect(el.style.height).toBe(`${DEMO_BANNER_HEIGHT}px`);
  });

  it("is announced to assistive technology", () => {
    const { container } = render(<DemoBanner />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("role")).toBe("note");
    expect(el.getAttribute("aria-label")).toBeTruthy();
  });
});

describe("layering contract with the fixed nav", () => {
  const bannerSrc = readFileSync("src/components/ui/DemoBanner.tsx", "utf8");
  const navSrc = readFileSync("src/components/ui/Nav.tsx", "utf8");
  const layoutSrc = readFileSync("src/app/layout.tsx", "utf8");

  it("the banner stacks above the nav", () => {
    const bz = z(bannerSrc);
    const nz = z(navSrc);
    expect(bz, "banner needs a z-index").not.toBeNull();
    expect(nz, "nav needs a z-index").not.toBeNull();
    expect(bz!).toBeGreaterThan(nz!);
  });

  it("the nav is pushed down by exactly the banner height", () => {
    // If the nav kept `top-0` it would cover the banner.
    expect(navSrc).not.toMatch(/className="fixed top-0/);
    expect(navSrc).toMatch(/top:\s*DEMO_BANNER_HEIGHT/);
  });

  it("page content clears both bars", () => {
    expect(layoutSrc).toMatch(/paddingTop:\s*63\s*\+\s*DEMO_BANNER_HEIGHT/);
  });

  it("the banner is mounted in the root layout, so it is on every page", () => {
    expect(layoutSrc).toMatch(/<DemoBanner\s*\/>/);
  });
});
