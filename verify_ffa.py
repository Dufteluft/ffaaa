import asyncio
from playwright.async_api import async_playwright
import os

async def verify_ffa_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={'width': 1280, 'height': 720})

        # Load the local index.html
        path = os.path.abspath("html/index.html")
        await page.goto(f"file://{path}")

        # Mocking the NUI 'open' message
        await page.evaluate("""
            window.postMessage({
                action: 'open',
                config: {
                    Locale: 'de',
                    Locales: {
                        de: {
                            menu_title: 'FFA LOBBY SYSTEM',
                            tab_ffa: 'FFA Lobby',
                            tab_create: 'Lobby erstellen',
                            tab_list: 'Offene Lobbys',
                            btn_create: 'Lobby erstellen'
                        }
                    },
                    WeaponLoadouts: {
                        pistol: [{name: 'WEAPON_PISTOL', label: 'Pistole'}],
                        smg: [{name: 'WEAPON_SMG', label: 'SMG'}]
                    }
                },
                maps: [
                    {id: 'legion', label: 'Würfelpark'},
                    {id: 'airport', label: 'Flughafen'}
                ]
            }, '*');
        """)

        # Show app
        await page.evaluate("document.getElementById('app').style.display = 'flex'")
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/screenshots/tab_ffa.png")

        # Switch to Create Tab
        await page.click('button[data-tab="create"]')
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/screenshots/tab_create.png")

        # Switch to Lobby List
        await page.click('button[data-tab="lobby"]')
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/screenshots/tab_lobby.png")

        # Mock Show HUD
        await page.evaluate("""
            window.postMessage({
                action: 'showHUD',
                mode: 'tdm'
            }, '*');
        """)
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/screenshots/hud_tdm.png")

        # Mock Show Winner
        await page.evaluate("""
            window.postMessage({
                action: 'showWinner',
                winnerName: 'Jules',
                stats: [
                    {name: 'Jules', kills: 15, deaths: 5, kd: '3.00'},
                    {name: 'Player2', kills: 10, deaths: 10, kd: '1.00'}
                ]
            }, '*');
        """)
        await page.wait_for_timeout(500)
        await page.screenshot(path="verification/screenshots/winner_screen.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_ffa_ui())
