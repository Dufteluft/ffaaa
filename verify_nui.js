const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const filePath = 'file://' + path.resolve('html/index.html');
  console.log('Loading:', filePath);

  await page.goto(filePath);

  // Mock GetParentResourceName for FiveM
  await page.evaluate(() => {
    window.GetParentResourceName = () => 'ffa-lobby';
  });

  // Verify elements exist
  const tabs = await page.$$eval('.tab-btn', btns => btns.map(b => b.innerText));
  console.log('Tabs:', tabs);

  const title = await page.textContent('.header-title');
  console.log('Header Title:', title);

  // Take screenshot
  await page.screenshot({ path: 'verification_nui.png' });

  await browser.close();
})();
