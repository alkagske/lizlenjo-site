import { expect, test } from '@playwright/test';

test.describe('Home', () => {
  test('renders the Atelier sections', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page).toHaveTitle(/Liz Lenjo/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Law, cut to measure');
    for (const h of ['Current roles', 'Six swatches', 'Inspiration versus Exploitation', 'Consulting through WIPO', 'Recognition', 'Invite Liz to speak, moderate']) {
      await expect(page.getByRole('heading', { name: new RegExp(h) })).toBeVisible();
    }
    await expect(page.locator('.role')).toHaveCount(8);
    await expect(page.locator('.swatch')).toHaveCount(6);
    await expect(page.locator('.swing')).toHaveCount(8);
    expect(errors).toEqual([]);
  });

  test('has no horizontal scroll', async ({ page }) => {
    await page.goto('/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('slider moves with the arrow buttons and keyboard', async ({ page }) => {
    await page.goto('/');
    const counter = page.locator('[data-counter]');
    await expect(counter).toHaveText('01 / 07');
    await page.getByRole('button', { name: 'Next look' }).click();
    await expect(counter).toHaveText('02 / 07');
    await page.getByRole('button', { name: 'Previous look' }).click();
    await page.getByRole('button', { name: 'Previous look' }).click();
    await expect(counter).toHaveText('07 / 07');
    await page.locator('body').click({ position: { x: 5, y: 400 } });
    await page.keyboard.press('ArrowRight');
    await expect(counter).toHaveText('01 / 07');
  });

  test('header shrinks after scrolling', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('[data-header]');
    await expect(header).not.toHaveClass(/is-scrolled/);
    await page.mouse.wheel(0, 600);
    await expect(header).toHaveClass(/is-scrolled/);
  });

  test('top 25 Women in Digital shows text only (logo pending)', async ({ page }) => {
    await page.goto('/');
    const tag = page.locator('.swing', { hasText: 'Top 25 Women in Digital' });
    await expect(tag.locator('img')).toHaveCount(0);
  });

  test('enquiry form submits', async ({ page }) => {
    await page.goto('/#enquire');
    await page.getByRole('button', { name: 'Panel' }).click();
    await page.getByPlaceholder('Your name').fill('Playwright Test');
    await page.getByPlaceholder('Email', { exact: true }).fill('test@example.com');
    await page.getByPlaceholder('Event, date and city').fill('Smoke test, Nairobi');
    await page.getByRole('button', { name: /Send enquiry/ }).click();
    await expect(page.getByText('Thank you. Liz’s office will be in touch.')).toBeVisible({ timeout: 15_000 });
  });
});

test('respects reduced motion', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  const anim = await page.locator('.marquee').first().evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
  const counter = page.locator('[data-counter]');
  await page.waitForTimeout(6500);
  await expect(counter).toHaveText('01 / 07'); // no autoplay
  await ctx.close();
});
