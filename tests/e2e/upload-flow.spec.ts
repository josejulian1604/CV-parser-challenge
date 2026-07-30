import { test, expect } from "@playwright/test";
import path from "node:path";

const FIXTURES_DIR = path.resolve(__dirname, "..", "fixtures");

test("uploading a real PDF redirects to /result and renders the extracted resume", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(
    path.join(FIXTURES_DIR, "pdf", "sample-1.pdf")
  );
  await page.getByRole("button", { name: /extract/i }).click();

  await expect(page).toHaveURL(/\/result$/, { timeout: 45_000 });
  // "Experience" renders twice by design (a mono eyebrow label + an italic
  // title, both reusing the same word) — assert at least one is visible.
  await expect(page.getByText("Experience", { exact: true }).first()).toBeVisible();
});

test("an unsupported file type stays on / and shows the correct error, no navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles({
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello world"),
  });
  await page.getByRole("button", { name: /extract/i }).click();

  await expect(page.getByText("This file type isn't supported")).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
});

test("direct navigation to /result with no active result redirects to / with a notice", async ({
  page,
}) => {
  await page.goto("/result");

  await expect(page).toHaveURL(/\/\?notice=no-result$/, { timeout: 15_000 });
  await expect(
    page.getByText("We couldn't find an active result — please upload again.")
  ).toBeVisible();
});

test("back then forward after a successful extraction still shows the result, no redirect flash", async ({
  page,
}) => {
  // The context provider lives in the root layout, which client-side history
  // navigation (unlike a hard reload/typed URL) doesn't remount — this pins
  // down that assumption with a real back/forward round-trip instead of
  // just inferring it from reading resume-data-context.tsx.
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(
    path.join(FIXTURES_DIR, "pdf", "sample-1.pdf")
  );
  await page.getByRole("button", { name: /extract/i }).click();
  await expect(page).toHaveURL(/\/result$/, { timeout: 45_000 });

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);

  await page.goForward();
  await expect(page).toHaveURL(/\/result$/);
  await expect(page.getByText("Experience", { exact: true }).first()).toBeVisible();
});

test('clicking "Upload another" lands cleanly on / — not hijacked by the no-result redirect', async ({
  page,
}) => {
  // Regression test for a real race: clear() (called by the back button)
  // updates context while /result may still be mounted, which can trigger
  // its own "no data → redirect to /?notice=no-result" effect. A correct
  // implementation must land on plain "/", not "/?notice=no-result".
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles(
    path.join(FIXTURES_DIR, "pdf", "sample-1.pdf")
  );
  await page.getByRole("button", { name: /extract/i }).click();
  await expect(page).toHaveURL(/\/result$/, { timeout: 45_000 });

  await page.getByRole("button", { name: /upload another/i }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("We couldn't find an active result")).not.toBeVisible();
});
