import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Signed-out screens are the only ones reachable without a real Supabase project. They cover the
// shared building blocks (inputs, buttons, labels, focus, landmarks, color contrast) in both themes
// at a desktop and a phone width, so a regression in those shows up here before it ships.
const PAGES = ["/login", "/signup"] as const;
const THEMES = ["light", "dark"] as const;
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

for (const path of PAGES) {
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      test(`${path} has no WCAG A/AA violations (${theme}, ${viewport.name})`, async ({ browser }) => {
        const context = await browser.newContext({
          colorScheme: theme,
          viewport: { width: viewport.width, height: viewport.height },
        });
        const page = await context.newPage();
        await page.goto(path);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
          .analyze();

        const summary = results.violations.map(
          (v) => `${v.id} (${v.impact}): ${v.help} - ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}`,
        );
        expect(summary, summary.join("\n")).toEqual([]);

        // A page that scrolls sideways at phone width is a layout bug, not an accessibility rule axe knows.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow).toBeLessThanOrEqual(0);

        await context.close();
      });
    }
  }
}
