from playwright.sync_api import sync_playwright
import os

def verify_ffa_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 800})

        # Load the index.html file
        path = os.path.abspath("html/index.html")
        page.goto(f"file://{path}")

        # Mock GetParentResourceName and NUI config
        page.evaluate("""() => {
            window.GetParentResourceName = () => 'ffa_resource';
            window.serverConfig = {
                Locale: 'de',
                Locales: {
                    de: {
                        menu_title: 'FFA LOBBY SYSTEM',
                        tab_ffa: 'FFA Lobby',
                        tab_create: 'Lobby erstellen',
                        tab_list: 'Offene Lobbys',
                        btn_join: 'Beitreten',
                        btn_create: 'Lobby erstellen',
                        btn_cancel: 'Abbrechen',
                        lobby_name: 'Lobby Name',
                        map_select: 'Map auswählen',
                        mode_select: 'Spielmodus',
                        loadout_select: 'Waffen-Loadout',
                        round_time: 'Rundenzeit (Min)',
                        max_players: 'Max. Spieler',
                        respawn_time: 'Respawn-Zeit (Sek)',
                        kill_limit: 'Kill-Limit zum Sieg',
                        vehicles_allowed: 'Fahrzeuge erlaubt',
                        friendly_fire: 'Freundliches Feuer',
                        btn_ready: 'BEREIT',
                        btn_start: 'START',
                        btn_leave: 'VERLASSEN'
                    }
                },
                WeaponLoadouts: {
                    pistol: [],
                    smg: [],
                    assault: []
                }
            };
            window.serverMaps = [
                { id: 'legion', label: 'Würfelpark' },
                { id: 'sandyshores', label: 'Sandy Shores' }
            ];

            // Trigger the 'open' message
            window.postMessage({
                action: 'open',
                config: window.serverConfig,
                maps: window.serverMaps
            }, '*');
        }""")

        page.wait_for_selector("#app", state="visible")
        page.screenshot(path="verification/main_menu.png")

        # Click Create Lobby Tab
        page.click("button[data-tab='create']")
        page.wait_for_selector("#tab-create", state="visible")
        page.screenshot(path="verification/create_lobby_tab.png")

        # Mock Lobby Data and show Waiting Area
        page.evaluate("""() => {
            const lobby = {
                id: '1234',
                name: 'TEST LOBBY',
                mapLabel: 'Würfelpark',
                mode: 'tdm',
                roundTime: 15,
                killLimit: 30
            };
            window.postMessage({
                action: 'lobbyJoined',
                lobby: lobby
            }, '*');

            const players = [
                { id: 1, name: 'HostPlayer', team: 'blue', ready: true, isHost: true },
                { id: 2, name: 'GuestPlayer', team: 'red', ready: false, isHost: false }
            ];
            window.postMessage({
                action: 'updateLobbyPlayers',
                players: players
            }, '*');
        }""")

        page.wait_for_selector("#lobby-waiting-area", state="visible")
        page.screenshot(path="verification/waiting_area.png")

        # Show HUD
        page.evaluate("""() => {
            window.postMessage({ action: 'showHUD', isTDM: true }, '*');
            window.postMessage({
                action: 'updateHUD',
                time: '14:59',
                kills: 5,
                deaths: 2,
                scoreBlue: 10,
                scoreRed: 8
            }, '*');
            window.postMessage({
                action: 'updateHUDDetails',
                health: 85,
                armor: 50,
                ammo: 30
            }, '*');
        }""")

        page.wait_for_selector("#game-hud", state="visible")
        page.screenshot(path="verification/hud.png")

        # Show Winner Screen
        page.evaluate("""() => {
            const stats = [
                { name: 'HostPlayer', kills: 15, deaths: 5, kd: '3.00' },
                { name: 'GuestPlayer', kills: 10, deaths: 12, kd: '0.83' }
            ];
            window.postMessage({
                action: 'showWinner',
                winnerName: 'Team Blau',
                stats: stats
            }, '*');
        }""")

        page.wait_for_selector("#winner-screen", state="visible")
        page.screenshot(path="verification/winner_screen.png")

        browser.close()

if __name__ == "__main__":
    verify_ffa_ui()
