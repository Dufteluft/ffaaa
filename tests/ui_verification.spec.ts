import { test, expect } from '@playwright/test';

test.describe('FFA Lobby System UI Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigiere zur NUI-Seite
    await page.goto('http://localhost:3000/html/index.html'); // Lokaler Pfad für Tests

    // Simuliere 'open' Message vom Spiel
    await page.evaluate(() => {
      window.postMessage({
        action: 'open',
        config: {
          Locale: 'de',
          MenuKey: 'F5',
          WeaponLoadouts: { 'pistol': [], 'smg': [], 'all': [] },
          Locales: {
            'de': {
              'menu_title': 'FFA LOBBY SYSTEM',
              'tab_ffa': 'FFA Lobby',
              'tab_create': 'Lobby erstellen',
              'tab_list': 'Offene Lobbys'
            }
          }
        },
        maps: [
          { id: 'legion', label: 'Würfelpark' },
          { id: 'airport', label: 'Flughafen' }
        ]
      }, '*');
    });
  });

  test('should display the main menu with tabs', async ({ page }) => {
    await expect(page.locator('#locale-menu-title')).toHaveText('FFA LOBBY SYSTEM');
    await expect(page.locator('[data-tab="ffa"]')).toBeVisible();
    await expect(page.locator('[data-tab="create"]')).toBeVisible();
    await expect(page.locator('[data-tab="list"]')).toBeVisible();
  });

  test('should switch to create lobby tab', async ({ page }) => {
    await page.click('[data-tab="create"]');
    await expect(page.locator('#tab-content-create')).toHaveClass(/active/);
    await expect(page.locator('#sidebar-filters')).toHaveClass(/hidden/);
    await expect(page.locator('#locale-create-title')).toBeVisible();
  });

  test('should show lobby list when data is received', async ({ page }) => {
    await page.evaluate(() => {
      window.postMessage({
        action: 'updateLobbies',
        lobbies: [
          { id: '1234', name: 'Test Lobby', mapLabel: 'Würfelpark', mode: 'ffa', playerCount: 5, maxPlayers: 16, status: 'waiting', mapId: 'legion' }
        ]
      }, '*');
    });

    await expect(page.locator('.lobby-item')).toBeVisible();
    await expect(page.locator('.match-type')).toHaveText('TEST LOBBY');
  });

  test('should show lobby waiting area after joining', async ({ page }) => {
    await page.evaluate(() => {
      window.postMessage({
        action: 'lobbyJoined',
        lobby: { id: '1234', name: 'Test Lobby', mapLabel: 'Würfelpark', mode: 'ffa', roundTime: 15, killLimit: 30 }
      }, '*');

      window.postMessage({
        action: 'updateLobbyPlayers',
        players: [
          { id: 1, name: 'Jules', team: 'ffa', ready: true, isHost: true }
        ]
      }, '*');
    });

    await expect(page.locator('#lobby-waiting-area')).toBeVisible();
    await expect(page.locator('#lobby-title-display')).toHaveText('TEST LOBBY');
    await expect(page.locator('.player-item')).toContainText('JULES');
  });

  test('should display HUD correctly', async ({ page }) => {
    await page.evaluate(() => {
      window.postMessage({ action: 'gameStarting' }, '*');
      window.postMessage({
        action: 'updateHUDDetails',
        health: 80,
        armor: 50,
        ammo: 30
      }, '*');
      window.postMessage({
        action: 'updateHUD',
        time: '12:34',
        kills: 5,
        deaths: 2
      }, '*');
    });

    await expect(page.locator('#game-hud')).toBeVisible();
    await expect(page.locator('#hud-health-bar')).toHaveStyle('width: 80%');
    await expect(page.locator('#hud-time-left')).toHaveText('12:34');
    await expect(page.locator('#hud-kills')).toHaveText('5');
  });
});
