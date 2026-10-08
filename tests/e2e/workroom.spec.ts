import { expect, test } from '@playwright/test';
// The test server runs with DEV_ACCESS_BYPASS=1 on 127.0.0.1 (tests/e2e/e2e.dev.vars). In production,
// Cloudflare Access and the JWT check in src/middleware.ts guard these routes.

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => !!isMobile, 'Workroom flows are exercised at desktop width');

test('Access is required away from localhost', async ({ request }) => {
  const res = await request.get('/workroom', { headers: { host: 'lizlenjo.com' } });
  expect([401, 403]).toContain(res.status());
});

test('write, slash-command, autosave and publish a post', async ({ page }) => {
  await page.goto('/workroom');
  await page.getByRole('button', { name: 'New post' }).click();
  await expect(page).toHaveURL(/\/workroom\/editor\/\d+/);
  const title = `Smoke test post ${Date.now()}`;
  await page.locator('#ed-title').fill(title);
  await page.locator('#ed-excerpt').fill('Written by Playwright.');
  const body = page.locator('.ProseMirror');
  await body.click();
  await page.keyboard.type('Opening paragraph for the smoke test.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/head');
  await expect(page.getByRole('listbox', { name: 'Insert block' })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.keyboard.type('A heading');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/margin');
  await page.keyboard.press('Enter');
  await page.keyboard.type('a chalk note');
  await expect(body.locator('h2')).toHaveText('A heading');
  await expect(body.locator('aside[data-margin-note]')).toHaveText('a chalk note');
  await expect(page.getByRole('status').filter({ hasText: /Autosaved/ })).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.ed-ver').first()).toBeVisible();

  await page.getByRole('button', { name: 'Desktop' }).click();
  await expect(page.locator('.ed-frame .margin-note')).toHaveText('a chalk note');
  await page.getByRole('button', { name: 'LinkedIn' }).click();
  await expect(page.locator('.ed-li')).toContainText(title);
  await page.getByRole('button', { name: 'Write' }).click();

  await page.getByLabel('Category').selectOption('Governance'); // keeps the reader tests' category counts stable
  await page.getByLabel('Publish now').check();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page).toHaveURL(/\/workroom$/);
  await expect(page.getByText(title)).toBeVisible();

  await page.goto('/notes');
  await page.getByRole('link', { name: new RegExp(title) }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(page.locator('.margin-note')).toHaveText('a chalk note');
});

test('schedule a draft from the calendar', async ({ page }) => {
  await page.goto('/workroom/calendar');
  const draft = page.locator('.cal-draft').first();
  const name = (await draft.textContent())!.trim();
  // Next month, 15th: always in the future.
  await page.getByRole('button', { name: 'Next month' }).click();
  const target = page.locator('.cal-cell[data-day$="-15"]').first();
  await draft.dragTo(target);
  await expect(target.locator('.cal-chip', { hasText: name })).toBeVisible();
  await page.goto('/workroom?status=scheduled');
  await expect(page.getByText(name)).toBeVisible();
});

test('moderate comments', async ({ page }) => {
  await page.goto('/workroom/comments');
  const first = page.locator('[data-queue] article').first();
  if ((await first.count()) === 0) test.skip(true, 'no pending comments');
  page.once('dialog', (d) => d.accept());
  const count = await page.locator('[data-queue] article').count();
  await first.getByRole('button', { name: 'Approve' }).click();
  await expect(page.locator('[data-queue] article')).toHaveCount(count - 1);
});

test('insights, lookbook manager and subscribers render', async ({ page, request }) => {
  await page.goto('/workroom/insights');
  await expect(page.getByText('Read to the end').first()).toBeVisible();
  await page.goto('/workroom/lookbook');
  await expect(page.locator('.lbm-item')).toHaveCount(7);
  const csv = await request.get('/api/admin/subscribers.csv');
  expect(csv.headers()['content-type']).toContain('text/csv');
});

test('admin API rejects cross-site writes', async ({ request }) => {
  const res = await request.post('/api/admin/posts', { headers: { origin: 'https://evil.example' }, data: {} });
  expect(res.status()).toBe(403);
});
