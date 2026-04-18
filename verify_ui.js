const { test, expect } = require('@playwright/test');
const path = require('path');

test('FFA UI Verification', async ({ page }) => {
  // Mock FiveM globals
  await page.addInitScript(() => {
    window.GetParentResourceName = () => 'ffa_lobby';
    window.nui_data = [];
    window.post = (url, data) => {
        window.nui_data.push({url, data});
    };
    // Mock jQuery $.post
    window.$ = {
        post: (url, data) => {
            window.nui_data.push({url, data});
        },
        on: () => {},
        find: () => ({ remove: () => {} }),
        append: () => {},
        empty: () => {},
        val: () => 'all',
        text: () => {},
        click: () => {},
        show: () => {},
        hide: () => {},
        fadeIn: () => ({ css: () => {} }),
        fadeOut: () => {},
        toggle: () => {},
        html: () => {},
        prop: () => {},
        removeClass: () => ({ addClass: () => {} }),
        scrollTop: () => {}
    };
  });

  const filePath = 'file://' + path.resolve('html/index.html');
  await page.goto(filePath);

  // Take screenshot of the main menu (should be hidden initially)
  await page.evaluate(() => {
    // Manually trigger 'open' message
    window.dispatchEvent(new MessageEvent('message', {
      data: {
        action: 'open',
        config: {
          Locale: 'de',
          Locales: { de: { menu_title: 'FFA LOBBY SYSTEM' } },
          WeaponLoadouts: { pistol: { label: 'Pistole' } }
        },
        maps: [{ id: 'legion', label: 'Würfelpark' }]
      }
    }));
  });

  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verification/main_menu.png' });

  // Click "Lobby erstellen" tab
  await page.click('[data-tab="create"]');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'verification/create_tab.png' });

  // Verify elements
  const title = await page.innerText('.header-title');
  expect(title).toBe('FFA LOBBY SYSTEM');
});
