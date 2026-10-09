import { expect, test } from '@playwright/test';
// Uses tests/e2e/fixtures.sql, which publishes the sample posts in the LOCAL test database only.

test('Notes index: search, "/" shortcut, categories, archive', async ({ page }) => {
  await page.goto('/notes');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Notes on entertainment');
  const count = page.locator('.count').first();
  await expect(count).toHaveText(/^\d+ notes?$/);
  const total = Number((await count.textContent())!.split(' ')[0]);
  expect(total).toBeGreaterThanOrEqual(60); // imported WordPress archive
  await page.locator('body').press('/');
  await expect(page.getByLabel('Search Liz Notes')).toBeFocused();
  await page.keyboard.type('Swakopmund'); // appears only in a sample post's margin note (body text)
  await expect(count).toHaveText('1 note');
  await page.getByRole('button', { name: 'Clear ×' }).click();
  await page.getByRole('button', { name: 'Fashion law' }).click();
  const fashion = Number((await count.textContent())!.split(' ')[0]);
  expect(fashion).toBeGreaterThan(0);
  expect(fashion).toBeLessThan(total);
  await page.getByRole('button', { name: 'Archive' }).click();
  expect(await page.locator('.archive-year').count()).toBeGreaterThanOrEqual(2);
  await page.getByLabel('Search Liz Notes').fill('zzzzqqq');
  await expect(page.getByText('Nothing matches that search yet.')).toBeVisible();
});

test('Imported WordPress post renders with its comments, and the old URL redirects', async ({ page }) => {
  const res = await page.goto('/realising-the-value-in-entertainment/');
  expect(res?.url()).toMatch(/\/notes\/realising-the-value-in-entertainment$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Realising the Value in Entertainment');
  await expect(page.locator('.body figure figcaption')).toHaveText('Christopher Grey and I');
  await expect(page.locator('.meta').filter({ hasText: '2013' }).first()).toBeVisible();
});

test('Article: reading tools, series, related, comment', async ({ page }) => {
  await page.goto('/notes/inspiration-versus-exploitation-traditional-cultural');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Inspiration versus exploitation');
  await expect(page.locator('.dropcap')).toHaveCount(1);
  await expect(page.locator('.margin-note')).toHaveCount(3);
  await expect(page.getByRole('navigation', { name: 'Pattern set' })).toContainText('Part 3 of 3');
  await expect(page.locator('.keep-card')).toHaveCount(3);
  await expect(page.locator('.keep-card').first()).toContainText('Same pattern set');

  await page.getByRole('button', { name: 'Large text' }).click();
  await expect(page.locator('[data-article-body]')).toHaveCSS('font-size', '20px');
  await page.reload();
  await expect(page.locator('[data-article-body]')).toHaveCSS('font-size', '20px');

  await page.getByPlaceholder('Name').fill('Playwright');
  await page.getByPlaceholder('Email (not published)').fill('pw@example.com');
  await page.getByPlaceholder('Add to the conversation').fill('Would community protocols be enforceable abroad?');
  await page.getByRole('button', { name: 'Post comment' }).click();
  await expect(page.getByText('Your comment will appear once it has been reviewed.')).toBeVisible({ timeout: 15_000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('Drafts and unknown slugs are not public', async ({ page }) => {
  expect((await page.goto('/notes/image-rights-for-athletes-and-performers'))?.status()).toBe(404);
  expect((await page.goto('/notes/nope'))?.status()).toBe(404);
});

test('RSS feed lists published posts only', async ({ request }) => {
  const res = await request.get('/notes/rss.xml');
  expect(res.ok()).toBe(true);
  const xml = await res.text();
  expect(xml).toContain('<title>Liz Notes</title>');
  expect((xml.match(/<item>/g) || []).length).toBeGreaterThanOrEqual(6);
  expect(xml).not.toContain('Image rights for athletes'); // draft
});
