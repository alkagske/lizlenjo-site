import { expect, test } from '@playwright/test';
// Uses tests/e2e/fixtures.sql, which publishes the sample posts in the LOCAL test database only.

test('Notes index: search, "/" shortcut, categories, archive', async ({ page }) => {
  await page.goto('/notes');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Notes on entertainment');
  await expect(page.locator('.count')).toHaveText('6 notes');
  await page.locator('body').press('/');
  await expect(page.getByLabel('Search Liz Notes')).toBeFocused();
  await page.keyboard.type('customs'); // body text only
  await expect(page.locator('.count')).toHaveText('1 note');
  await page.getByRole('button', { name: 'Clear ×' }).click();
  await page.getByRole('button', { name: 'Fashion law' }).click();
  await page.getByRole('button', { name: 'Copyright' }).click();
  await expect(page.locator('.count')).toHaveText('3 notes');
  await page.getByRole('button', { name: 'Archive' }).click();
  await expect(page.locator('.archive-year')).toHaveCount(2);
  await page.getByLabel('Search Liz Notes').fill('zzzz');
  await expect(page.getByText('Nothing matches that search yet.')).toBeVisible();
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
  expect((xml.match(/<item>/g) || []).length).toBe(6);
});
