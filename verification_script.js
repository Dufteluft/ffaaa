const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const filePath = 'file://' + path.resolve('html/index.html');
  await page.goto(filePath);

  // Mock GetParentResourceName
  await page.evaluate(() => {
    window.GetParentResourceName = () => 'ffa-lobby';
  });

  // Verify Tab Switching
  await page.click('.tab-btn[data-tab="create"]');
  const createTabVisible = await page.isVisible('#tab-create.active');
  console.log('Create Tab Visible:', createTabVisible);

  await page.click('.tab-btn[data-tab="lobby"]');
  const lobbyTabVisible = await page.isVisible('#tab-lobby.active');
  console.log('Lobby Tab Visible:', lobbyTabVisible);

  // Take a screenshot of the Create Tab
  await page.click('.tab-btn[data-tab="create"]');
  await page.evaluate(() => {
    document.getElementById('app').style.display = 'flex';
  });
  await page.screenshot({ path: 'verification/create_tab.png' });

  await browser.close();
})();
