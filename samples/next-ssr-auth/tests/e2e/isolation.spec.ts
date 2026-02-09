import { expect, test } from "@playwright/test";

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

test("SSR sessions stay isolated between browser A and browser B", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await login(pageA, "user_a", "pass_a");
  await expect(pageA.getByText("Current User (/me): User A (user_a)")).toBeVisible({ timeout: 30_000 });

  await login(pageB, "user_b", "pass_b");
  await expect(pageB.getByText("Current User (/me): User B (user_b)")).toBeVisible({ timeout: 30_000 });

  await pageA.reload();
  await expect(pageA.getByText("Current User (/me): User A (user_a)")).toBeVisible();
  await expect(pageA.getByText("Current User (/me): User B (user_b)")).toHaveCount(0);

  await pageB.reload();
  await expect(pageB.getByText("Current User (/me): User B (user_b)")).toBeVisible();
  await expect(pageB.getByText("Current User (/me): User A (user_a)")).toHaveCount(0);

  const cookiesA = await contextA.cookies();
  const cookiesB = await contextB.cookies();
  const tokenA = cookiesA.find((item) => item.name === "aptx_access_token")?.value;
  const tokenB = cookiesB.find((item) => item.name === "aptx_access_token")?.value;
  expect(tokenA).toBeTruthy();
  expect(tokenB).toBeTruthy();
  expect(tokenA).not.toBe(tokenB);

  await contextA.close();
  await contextB.close();
});
