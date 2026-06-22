import os
from playwright.sync_api import sync_playwright, expect

def verify_ffa_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={'width': 1280, 'height': 720})

        # Load the local HTML file
        path = os.path.abspath("html/index.html")
        page.goto(f"file://{path}")

        # Show the app
        page.evaluate("document.getElementById('app').style.display = 'flex'")

        # Wait for app to be visible
        expect(page.locator("#app")).to_be_visible()

        # Screenshot of Main Menu (FFA Tab)
        page.screenshot(path="/home/jules/verification/main_menu_ffa.png")

        # Switch to Create Lobby Tab
        page.get_by_role("button", name="Lobby erstellen").click()
        page.screenshot(path="/home/jules/verification/create_lobby_tab.png")

        # Switch to Open Lobbies Tab
        page.get_by_role("button", name="Offene Lobbys").click()
        page.screenshot(path="/home/jules/verification/open_lobbies_tab.png")

        # Show Waiting Area (Mocking some data)
        page.evaluate("""() => {
            document.getElementById('tab-browser').style.display = 'none';
            document.getElementById('tab-create').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'flex';
            document.getElementById('lobby-title').innerText = 'TEST LOBBY';
            const list = document.getElementById('player-list');
            list.innerHTML = '<div class="player-item ready"><span>JULES (H)</span><span>BLUE</span></div>';
        }""")
        page.screenshot(path="/home/jules/verification/waiting_area.png")

        # Show HUD
        page.evaluate("""() => {
            document.getElementById('lobby-waiting-area').style.display = 'none';
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-scores').style.display = 'flex';
        }""")
        page.screenshot(path="/home/jules/verification/hud.png")

        # Show Winner Screen
        page.evaluate("""() => {
            document.getElementById('game-hud').style.display = 'none';
            document.getElementById('winner-screen').style.display = 'flex';
            document.getElementById('winner-name').innerText = 'JULES WINS!';
            document.getElementById('match-stats-table').innerHTML = '<table><tr><th>NAME</th><th>KILLS</th></tr><tr><td>JULES</td><td>15</td></tr></table>';
        }""")
        page.screenshot(path="/home/jules/verification/winner_screen.png")

        browser.close()

if __name__ == "__main__":
    os.makedirs("/home/jules/verification", exist_ok=True)
    verify_ffa_ui()
