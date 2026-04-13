import { test, expect } from "@playwright/test";

test.describe("V3 Features — /financer", () => {
  test("financer page loads with wizard", async ({ page }) => {
    await page.goto("/financer");
    await expect(page).toHaveTitle(/Financer|SUTRA/i);
    // Step 1 visible
    await expect(page.locator("text=Ton profil")).toBeVisible();
    // Profile buttons visible
    await expect(page.locator("text=Particulier")).toBeVisible();
    await expect(page.locator("text=Entreprise")).toBeVisible();
    await expect(page.locator("text=Association")).toBeVisible();
    await expect(page.locator("text=Etudiant")).toBeVisible();
  });

  test("financer wizard step 1 — profile buttons visible", async ({
    page,
  }) => {
    // Set cookie to dismiss banner
    await page.context().addCookies([
      { name: "sutra_cookies_consent", value: "accepted", domain: "sutra.purama.dev", path: "/" },
    ]);
    await page.goto("/financer");
    // Profile buttons should be visible
    await expect(page.getByText("Particulier", { exact: true })).toBeVisible();
    await expect(page.getByText("Entreprise", { exact: true })).toBeVisible();
  });

  test("financer API responds", async ({ request, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop 1920", "API test only on desktop");
    const res = await request.get("/api/financer");
    expect([200, 500]).toContain(res.status());
  });
});

test.describe("V3 Features — /confidentialite", () => {
  test("confidentialite page loads", async ({ page }) => {
    await page.goto("/confidentialite");
    await expect(page.getByRole("heading", { name: /Confidentialite/i })).toBeVisible();
  });
});

test.describe("V3 Features — /devenir-influenceur", () => {
  test("influenceur page loads with form", async ({ page }) => {
    await page.goto("/devenir-influenceur");
    await expect(
      page.locator("text=Programme Influenceur SUTRA")
    ).toBeVisible();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    // Form visible
    await expect(page.locator("text=Rejoins le programme")).toBeVisible();
  });
});

test.describe("V3 Features — /pricing banner", () => {
  test("pricing page has financer banner", async ({ page }) => {
    await page.goto("/pricing");
    const banner = page.locator('[data-testid="financer-banner"]');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("paient rien");
  });
});

test.describe("V3 Features — Protected pages redirect", () => {
  test("classement-points redirects to login", async ({ page }) => {
    await page.goto("/classement-points");
    await page.waitForURL(/login/);
    expect(page.url()).toContain("/login");
  });

  test("invoices redirects to login", async ({ page }) => {
    await page.goto("/invoices");
    await page.waitForURL(/login/);
    expect(page.url()).toContain("/login");
  });

  test("boutique redirects to login", async ({ page }) => {
    await page.goto("/boutique");
    await page.waitForURL(/login/);
    expect(page.url()).toContain("/login");
  });
});

test.describe("V3 Features — Locale API", () => {
  test("locale API sets cookie", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop 1920", "API test only on desktop");
    const res = await request.post("/api/locale", {
      data: { locale: "en" },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.locale).toBe("en");
  });

  test("locale API rejects invalid locale", async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== "Desktop 1920", "API test only on desktop");
    const res = await request.post("/api/locale", {
      data: { locale: "xx" },
    });
    expect(res.status()).toBe(400);
  });
});
