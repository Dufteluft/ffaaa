import os
from playwright.sync_api import sync_playwright

def run_verification(page):
    # Get the absolute path to index.html
    current_dir = os.getcwd()
    file_url = f"file://{current_dir}/html/index.html"

    # Inject mock for GetParentResourceName and fetch
    page.add_init_script("""
        window.GetParentResourceName = () => 'ffa-lobby';
        const originalFetch = window.fetch;
        window.fetch = (url, options) => {
            console.log('Mock fetch:', url, options);
            if (url.includes('fetchLobbies')) {
                return Promise.resolve({
                    json: () => Promise.resolve([])
                });
            }
            return Promise.resolve({ ok: true });
        };
        // Mock Config and Maps since they usually come from Lua
        window.addEventListener('load', () => {
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
                            lobby_name: 'Lobby Name',
                            map_select: 'Map auswählen',
                            mode_select: 'Spielmodus',
                            loadout_select: 'Waffen-Loadout',
                            round_time: 'Rundenzeit (Min)',
                            max_players: 'Max. Spieler',
                            vehicles_allowed: 'Fahrzeuge erlaubt',
                            friendly_fire: 'Freundliches Feuer',
                            respawn_time: 'Respawn-Zeit (Sek)',
                            kill_limit: 'Kill-Limit zum Sieg',
                            btn_create: 'Lobby erstellen'
                        }
                    }
                },
                maps: [
                    { id: 'legion', label: 'Würfelpark' },
                    { id: 'sandyshores', label: 'Sandy Shores' }
                ]
            }, '*');
        });
    """)

    page.goto(file_url)
    page.wait_for_timeout(1000)

    # Take screenshot of first tab (FFA)
    page.screenshot(path="/home/jules/verification/screenshots/tabs_ffa.png")
    page.wait_for_timeout(500)

    # Click on "Create Lobby" tab
    page.click('button[data-tab="create"]')
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/tab_create.png")

    # Click on "Open Lobbies" tab
    page.click('button[data-tab="lobby"]')
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/tab_list.png")

    # Mock HUD show
    page.evaluate("""
        window.postMessage({
            action: 'showHUD',
            isPersistent: false
        }, '*');
        window.postMessage({
            action: 'updateHUD',
            time: '12:34',
            kills: 5,
            deaths: 2,
            mode: 'ffa'
        }, '*');
        window.postMessage({
            action: 'updateHUDDetails',
            health: 80,
            armor: 40,
            ammo: '30/250'
        }, '*');
    """)
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/screenshots/hud.png")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
