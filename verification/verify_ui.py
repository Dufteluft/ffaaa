import os
from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the HTML file directly
        file_path = "file://" + os.path.abspath("html/index.html")
        page.goto(file_path)

        # Mocking the FiveM environment
        page.evaluate("""
            window.GetParentResourceName = () => 'ffa-lobby';
            window.postMessage({
                action: 'open',
                myId: 1,
                config: {
                    Locale: 'de',
                    Locales: {
                        'de': {
                            'menu_title': 'FFA LOBBY SYSTEM',
                            'tab_ffa': 'FFA Lobby',
                            'tab_create': 'Lobby erstellen',
                            'tab_list': 'Offene Lobbys',
                            'all_maps': 'ALLE KARTEN',
                            'all_weapons': 'ALLE WAFFEN',
                            'players_filter': 'SPIELER',
                            'any_players': 'ALLE',
                            'not_full': 'NICHT VOLL',
                            'lobby_name': 'Lobby Name',
                            'map_select': 'Map auswählen',
                            'mode_select': 'Spielmodus',
                            'loadout_select': 'Waffen-Loadout',
                            'round_time': 'Rundenzeit (Min)',
                            'max_players': 'Max. Spieler',
                            'vehicles_allowed': 'Fahrzeuge erlaubt',
                            'friendly_fire': 'Freundliches Feuer',
                            'respawn_time': 'Respawn-Zeit (Sek)',
                            'kill_limit': 'Kill-Limit zum Sieg',
                            'btn_create': 'Lobby erstellen',
                            'btn_cancel': 'Abbrechen',
                            'btn_join': 'Beitreten',
                            'btn_ready': 'Bereit',
                            'btn_start': 'Spiel starten',
                            'btn_leave': 'Lobby verlassen',
                            'btn_kick': 'Kicken',
                            'btn_close_lobby': 'Lobby schließen',
                            'btn_back_lobby': 'Zurück zur Lobby',
                            'btn_back_menu': 'Hauptmenü',
                            'lobby_prefix': 'LOBBY:',
                            'players_header': 'SPIELER',
                            'settings_header': 'EINSTELLUNGEN',
                            'team_blue': 'Team Blau',
                            'team_red': 'Team Rot',
                            'spectator': 'Zuschauer',
                            'random': 'Zufall',
                            'waiting_for_players': 'Warte auf Spieler...',
                            'countdown': 'Start in %s Sekunden',
                            'game_ended': 'Runde beendet!',
                            'winner': 'Gewinner: %s',
                            'wins_suffix': 'GEWINNT!',
                            'kills': 'Kills',
                            'deaths': 'Tode',
                            'kd_ratio': 'K/D',
                            'score': 'Score',
                            'notif_leave_zone': 'Du verlässt das Kampfgebiet!',
                            'notif_weapon_not_allowed': 'Diese Waffe ist hier nicht erlaubt!',
                            'notif_kicked': 'Du wurdest aus der Lobby gekickt.',
                            'system_msg': 'SYSTEM'
                        }
                    },
                    WeaponLoadouts: {
                        'pistol': [],
                        'smg': [],
                        'assault': []
                    }
                },
                maps: [
                    { id: 'legion', label: 'Würfelpark' },
                    { id: 'sandyshores', label: 'Sandy Shores' }
                ]
            }, '*');
        """)

        # Capture Main Menu (FFA Tab)
        page.screenshot(path="verification/main_menu_ffa.png")

        # Switch to "Lobby erstellen" tab
        page.click("button[data-tab='create']")
        page.wait_for_timeout(500)
        page.screenshot(path="verification/create_tab.png")

        # Mock a lobby join
        page.evaluate("""
            window.postMessage({
                action: 'lobbyJoined',
                lobby: {
                    name: 'TEST LOBBY',
                    mapLabel: 'Würfelpark',
                    mode: 'ffa',
                    roundTime: 15,
                    loadout: 'all'
                }
            }, '*');

            window.postMessage({
                action: 'updateLobbyPlayers',
                players: [
                    { id: 1, name: 'JULES', team: 'none', ready: true, isHost: true },
                    { id: 2, name: 'PLAYER 2', team: 'none', ready: false, isHost: false }
                ]
            }, '*');
        """)
        page.wait_for_timeout(500)
        page.screenshot(path="verification/waiting_area.png")

        # Mock HUD
        page.evaluate("""
            window.postMessage({ action: 'gameStarting' }, '*');
            window.postMessage({
                action: 'updateHUD',
                time: '14:55',
                kills: 5,
                mode: 'ffa'
            }, '*');
            window.postMessage({
                action: 'updateHUDDetails',
                health: 80,
                armor: 50,
                ammo: '30/90'
            }, '*');
        """)
        page.wait_for_timeout(500)
        page.screenshot(path="verification/hud.png")

        # Mock Winner Screen
        page.evaluate("""
            window.postMessage({
                action: 'showWinner',
                winnerName: 'JULES',
                stats: [
                    { name: 'JULES', kills: 10, deaths: 2, kd: '5.00' },
                    { name: 'PLAYER 2', kills: 2, deaths: 10, kd: '0.20' }
                ]
            }, '*');
        """)
        page.wait_for_timeout(500)
        page.screenshot(path="verification/winner_screen.png")

        browser.close()

if __name__ == "__main__":
    verify_ui()
