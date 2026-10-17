import { expect, test } from '@playwright/test';
import { FEATURES } from '../../src/content/features';

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

test('Lookbook is hidden while on hold', async ({ page }) => {
  test.skip(FEATURES.lookbook, 'Lookbook is live');
  expect((await page.goto('/lookbook'))?.status()).toBe(404);
  await page.goto('/');
  await expect(page.locator('a[href="/lookbook"]')).toHaveCount(0);
  await page.goto('/about');
  await expect(page.locator('a[href="/lookbook"]')).toHaveCount(0);
});

test('Lookbook opens a photo in the lightbox and pages with the keyboard', async ({ page }) => {
  test.skip(!FEATURES.lookbook, 'Lookbook on hold');
  await page.goto('/lookbook');
  await expect(page.locator('.pin')).toHaveCount(7);
  await page.locator('.pin-btn').first().click();
  const dlg = page.locator('[data-lightbox]');
  await expect(dlg).toBeVisible();
  await expect(page.locator('[data-lb-count]')).toHaveText('01 / 07');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-lb-count]')).toHaveText('02 / 07');
  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
});

test('Lookbook filters by collection', async ({ page }) => {
  test.skip(!FEATURES.lookbook, 'Lookbook on hold');
  await page.goto('/lookbook');
  await page.getByRole('button', { name: /^Editorial/ }).click();
  await expect(page.locator('.pin:visible')).toHaveCount(3);
  await noOverflow(page);
});

test('Privacy page and 404', async ({ page }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Your rights' })).toBeVisible();
  const res = await page.goto('/no-such-page');
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('cut from the pattern');
});

test('www forwards to the main address on every page and file', async ({ request }) => {
  for (const path of ['/', '/about', '/logo-9.webp', '/notes']) {
    const res = await request.get(path, { headers: { host: 'www.lizlenjo.com' }, maxRedirects: 0 });
    expect(res.status()).toBe(301);
    expect(res.headers()['location']).toMatch(new RegExp(`^https?://lizlenjo\\.com${path.replace('.', '\\.')}$`));
  }
});

test('Sign-in page at /workroom leads into the Workroom and is kept out of search', async ({ page, request }) => {
  const old = await request.get('/signin', { maxRedirects: 0 });
  expect(old.status()).toBe(301);
  expect(old.headers()['location']).toMatch(/\/workroom$/);
  await page.goto('/workroom');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Welcome back');
  await expect(page.getByRole('link', { name: /Continue with Google/ })).toHaveAttribute('href', '/workroom/posts');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await noOverflow(page);
});
