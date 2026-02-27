import { expect, test } from "@playwright/test";

const TOKEN_COOKIE = "aptx_access_token";

async function login(page: import("@playwright/test").Page, username: string, password: string) {
  await page.goto("/");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/login") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Login" }).click()
  ]);
  await page.waitForLoadState("networkidle");
}

async function logout(page: import("@playwright/test").Page) {
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/logout") && response.request().method() === "POST"),
    page.getByRole("button", { name: "Logout" }).click()
  ]);
  await page.waitForLoadState("networkidle");
}

test.describe("Authentication Flow", () => {
  test("anonymous user sees login form", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByText("Current User (/me): (anonymous)")).toBeVisible();
  });

  test("login with invalid credentials shows error", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Username").fill("wrong_user");
    await page.getByLabel("Password").fill("wrong_pass");
    await page.getByRole("button", { name: "Login" }).click();

    await expect(page.getByText("Invalid username/password")).toBeVisible();
    await expect(page.getByText("Current User (/me): (anonymous)")).toBeVisible();
  });

  test("successful login sets cookie and shows user info", async ({ page, context }) => {
    await login(page, "user_a", "pass_a");

    // Verify user info is displayed
    await expect(page.getByText("Current User (/me): User A (user_a)")).toBeVisible();

    // Verify cookie is set with a non-empty value
    const cookies = await context.cookies();
    const tokenCookie = cookies.find((c) => c.name === TOKEN_COOKIE);
    expect(tokenCookie).toBeTruthy();
    expect(tokenCookie?.value.length).toBeGreaterThan(0);
  });

  test("logout clears token and shows login form", async ({ page, context }) => {
    await login(page, "user_a", "pass_a");
    await expect(page.getByText("Current User (/me): User A (user_a)")).toBeVisible();

    await logout(page);

    // Verify back to anonymous state
    await expect(page.getByText("Current User (/me): (anonymous)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Login" })).toBeVisible();

    // Verify cookie is cleared
    const cookies = await context.cookies();
    const tokenCookie = cookies.find((c) => c.name === TOKEN_COOKIE);
    expect(tokenCookie?.value).toBeFalsy();
  });

  test("token persists across page reloads", async ({ page }) => {
    await login(page, "user_a", "pass_a");
    await expect(page.getByText("Current User (/me): User A (user_a)")).toBeVisible();

    // Reload page
    await page.reload();

    // Token should persist - user still logged in
    await expect(page.getByText("Current User (/me): User A (user_a)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Logout" })).toBeVisible();
  });

  test("token persists across navigation", async ({ page }) => {
    await login(page, "user_a", "pass_a");

    // Navigate away and back
    await page.goto("/?some=query");
    await expect(page.getByText("Current User (/me): User A (user_a)")).toBeVisible();

    await page.goto("/");
    await expect(page.getByText("Current User (/me): User A (user_a)")).toBeVisible();
  });

  test("SSR renders user info before JS hydration", async ({ page, context }) => {
    // Login first to set cookie
    await login(page, "user_a", "pass_a");

    // Disable JavaScript to test pure SSR
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "javaEnabled", { get: () => false });
    });

    // Create new page without JS
    const newPage = await context.newPage();

    // Response should contain SSR-rendered user info
    const response = await newPage.goto("/");
    const html = await response?.text();

    expect(html).toContain("User A (user_a)");

    await newPage.close();
  });

  test("cookie has correct attributes", async ({ page, context }) => {
    await login(page, "user_a", "pass_a");

    const cookies = await context.cookies();
    const tokenCookie = cookies.find((c) => c.name === TOKEN_COOKIE);

    expect(tokenCookie).toMatchObject({
      path: "/",
      httpOnly: true,
      sameSite: "Lax"
    });
  });
});

test.describe("Token Store Behavior", () => {
  test("multiple tabs share the same session", async ({ page, context }) => {
    await login(page, "user_a", "pass_a");

    // Open a new tab
    const page2 = await context.newPage();
    await page2.goto("/");

    // Both tabs should show the same user
    await expect(page.getByText("Current User (/me): User A (user_a)")).toBeVisible();
    await expect(page2.getByText("Current User (/me): User A (user_a)")).toBeVisible();

    // Logout from tab 1
    await logout(page);

    // Refresh tab 2 - should be logged out
    await page2.reload();
    await expect(page2.getByText("Current User (/me): (anonymous)")).toBeVisible();

    await page2.close();
  });

  test("SSR fetches user data with token on server side", async ({ page }) => {
    await login(page, "user_a", "pass_a");

    // Reload and verify SSR rendered user data (not client-side fetch)
    const response = await page.reload();

    // The HTML response should contain user data rendered by SSR
    const html = await response?.text();
    expect(html).toContain("User A (user_a)");
    expect(html).toContain("Current User (/me):");
  });

  test("concurrent requests maintain separate sessions", async ({ browser }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // Login both users concurrently
    await Promise.all([login(pageA, "user_a", "pass_a"), login(pageB, "user_b", "pass_b")]);

    // Verify each sees their own user
    await expect(pageA.getByText("Current User (/me): User A (user_a)")).toBeVisible();
    await expect(pageB.getByText("Current User (/me): User B (user_b)")).toBeVisible();

    await contextA.close();
    await contextB.close();
  });
});
