import {expect, test} from './fixtures';

test.describe('Cross-Platform Ecosystem & Unified Roadmap', () => {
  test('sidebar and roadmap feature Python Lab connection', async ({page}) => {
    await page.goto('./');

    // On mobile viewports, open mobile navigation drawer
    const mobileMenu = page.getByRole('button', {name: 'Open navigation'});
    if (await mobileMenu.isVisible()) {
      await mobileMenu.click();
    }

    // Sidebar ecosystem link
    const pyLabLink = page.locator('.ecosystem a[href*="python-lab"]');
    await expect(pyLabLink).toBeVisible();
    await expect(pyLabLink).toHaveAttribute('href', 'https://shadabur-rahaman.github.io/python-lab/#/home');
    await expect(pyLabLink).toContainText('Python Lab');
    await expect(pyLabLink).toContainText('Programming Foundation');

    // Roadmap page Stage 0 banner
    await page.goto('./roadmap');
    const prereqBanner = page.locator('.roadmap-prereq-banner');
    await expect(prereqBanner).toBeVisible();
    await expect(prereqBanner).toContainText('Stage 0 · Python Programming Foundation');
    const startPyLab = prereqBanner.getByRole('link', {name: /Start in Python Lab/i});
    await expect(startPyLab).toBeVisible();
    await expect(startPyLab).toHaveAttribute('href', 'https://shadabur-rahaman.github.io/python-lab/#/home');
  });

  test('lesson journey provides foundation bridge to Python Lab on first lesson', async ({page}) => {
    await page.goto('./learn/introduction');
    const journey = page.getByRole('navigation', {name: 'Lesson progression'});
    await expect(journey).toBeVisible();

    const foundationLink = journey.getByRole('link', {name: /Foundation: Python Lab/i});
    await expect(foundationLink).toBeVisible();
    await expect(foundationLink).toHaveAttribute('href', 'https://shadabur-rahaman.github.io/python-lab/#/home');
  });
});
