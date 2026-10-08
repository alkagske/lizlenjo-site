import { expect, test } from '@playwright/test';

const noOverflow = async (page: import('@playwright/test').Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

test('About shows the full profile', async ({ page }) => {
  await page.goto('/about');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Advocate of the High Court of Kenya');
  for (const t of ['Copyright Tribunal, Kenya', 'Audit Committee', 'Partners Against Piracy', 'CopyrightX', 'Intra-African Trade Fair', 'Chambers and Partners, Band 3']) {
    await expect(page.getByText(t).first()).toBeVisible();
  }
  await noOverflow(page);
});

test('About has no sticky headings over content', async ({ page }) => {
  await page.goto('/about');
  const sticky = await page.evaluate(() =>
    [...document.querySelectorAll('main h1, main h2, main h3')].filter((h) => {
      for (let el: Element | null = h; el && el !== document.body; el = el.parentElement) if (getComputedStyle(el).position === 'sticky') return true;
      return false;
    }).length,
  );
  expect(sticky).toBe(0);
});

test('Lookbook opens a photo in the lightbox and pages with the keyboard', async ({ page }) => {
  await page.goto('/lookbook');
  await expect(page.locator('.tile')).toHaveCount(7);
  await page.locator('.tile-btn').first().click();
  const dlg = page.locator('[data-lightbox]');
  await expect(dlg).toBeVisible();
  await expect(page.locator('[data-lb-count]')).toHaveText('01 / 07');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-lb-count]')).toHaveText('02 / 07');
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('Lookbook filters by collection', async ({ page }) => {
  await page.goto('/lookbook');
  await page.getByRole('button', { name: /^Editorial/ }).click();
  await expect(page.locator('.tile:visible')).toHaveCount(3);
  await noOverflow(page);
});

test('Privacy page and 404', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Your rights' })).toBeVisible();
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('cut from the pattern');
});
