import { expect, test } from '@playwright/test';

const widths = [320, 360, 390, 768, 1024, 1440];
const scales = [16, 24, 32] as const;

test('design page has no horizontal overflow', async ({ page }) => {
  await page.goto('/design');
  for (const width of widths) {
    for (const scale of scales) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate((scaleValue) => {
        document.documentElement.style.fontSize = scaleValue;
      }, `${scale}px`);
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      }));
      expect(dimensions.scrollWidth, `${scale} at ${width}px`).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});
