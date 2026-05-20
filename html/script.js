/**
 * FiveM FFA Lobby System - Frontend Logik
 * Entwickelt für ESX Legacy
 */

let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let selectedLoadouts = [];

// Audio-Setup für UI-Interaktionen und Spiel-Events
const sounds = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3')
};

/**
 * Spielt einen Sound aus der Asset-Liste ab
 * @param {string} name - Name des Sounds
 */
function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(() => {});
    }
}

// Tab-Wechsel Logik für das Hauptmenü
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        currentTab = btn.dataset.tab;
        if (currentTab === 'create') {
            document.getElementById('tab-create').classList.add('active');
        } else {
            document.getElementById('tab-browser').classList.add('active');
            fetchLobbies();
        }
    });
});

/**
 * Synchronisiert Slider-Werte mit den dazugehörigen Labels
 * @param {string} id - ID des Slider-Elements
 */
const setupSlider = (id) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// NUI Message Listener für Kommunikation von Lua zu JS
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            if (data.config) setupInitialData(data.config, data.maps);
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

/**
 * Initialisiert die UI mit Map-Daten und Loadout-Optionen vom Server
 */
function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALLE MAPS</option>';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt.cloneNode(true));
        filterMaps.appendChild(opt);
    });

    const loadoutContainer = document.getElementById('loadout-multi-select');
    loadoutContainer.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="checkbox" value="${key}" id="ld-${key}">
            <label for="ld-${key}">${key.toUpperCase()}</label>
        `;
        loadoutContainer.appendChild(div);
    }

    applyLocalization();
}

/**
 * Wendet die Lokalisierung auf alle Elemente mit [data-locale] Attribut an
 */
function applyLocalization() {
    const locale = serverConfig.Locales[serverConfig.Locale];
    if (!locale) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locale[key]) el.innerText = locale[key];
    });
}

/**
 * Fragt die aktuelle Lobbyliste beim Server ab
 */
function fetchLobbies() {
    if (currentTab === 'create') return;

    // Playwright check
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';

    fetch(`https://${resourceName}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

/**
 * Rendert die Lobbyliste im Browser-Tab
 */
function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()}</div>
                <div class="map-name-row">${lobby.mapLabel}</div>
                <div class="host-name">HOST: ${lobby.hostName}</div>
            </div>
            <div class="player-count">
                <i class="fa-solid fa-users"></i> ${lobby.playerCount}/${lobby.maxPlayers}
            </div>
            <div class="action-area">
                <button class="action-btn" onclick="joinLobby('${lobby.id}')">BEITRETEN</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

/**
 * Sammelt die Form-Daten und sendet sie zur Lobby-Erstellung an den Server
 */
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('#loadout-multi-select input:checked').forEach(i => selectedLoadouts.push(i.value));

    if (selectedLoadouts.length === 0) {
        selectedLoadouts.push('all');
    }

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts,
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked
    };

    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

/**
 * Zeigt den Wartebereich der Lobby an
 */
function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODUS: ${lobby.mode.toUpperCase()}</p>
        <p>LOADOUT: ${Array.isArray(lobby.loadout) ? lobby.loadout.join(', ').toUpperCase() : lobby.loadout.toUpperCase()}</p>
        <p>ZEIT: ${lobby.roundTime === 0 ? '∞' : lobby.roundTime + ' MIN'}</p>
    `;

    document.getElementById('team-selection-container').style.display = lobby.mode === 'tdm' ? 'flex' : 'none';
}

/**
 * Rendert die Spielerliste im Wartebereich
 */
function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost && !currentLobby.isPersistent) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

/**
 * Host-Aktion: Spieler kicken
 */
function kickPlayer(id) {
    playSound('click');
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    playSound('start');
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/leaveLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
        fetch(`https://${resourceName}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

/**
 * Fügt eine Nachricht zum Lobby-Chat hinzu
 */
function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    if (name === 'SYSTEM') div.className = 'chat-system';
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg.trim().length > 0) {
            const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
            fetch(`https://${resourceName}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

/**
 * Zeigt den Runden-Countdown an
 */
function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-display');
    if (seconds > 0) {
        overlay.style.display = 'block';
        overlay.innerText = seconds;
    } else {
        overlay.style.display = 'none';
    }
}

/**
 * Aktualisiert HUD-Elemente für Zeit, Kills und Score
 */
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
}

/**
 * Aktualisiert Balken-Anzeigen für Leben und Rüstung
 */
function updateHUDDetails(data) {
    document.getElementById('bar-health').style.width = data.health + '%';
    document.getElementById('bar-armor').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

/**
 * Zeigt den Sieger-Bildschirm mit Statistiken
 */
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    renderMapVoting();
}

/**
 * Erstellt die Map-Voting UI im Winner Screen
 */
function renderMapVoting() {
    const grid = document.getElementById('vote-map-grid');
    grid.innerHTML = '';

    // Wähle 3 zufällige Maps für das Voting aus
    const shuffled = [...serverMaps].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    selected.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `
            <span>${map.label.toUpperCase()}</span>
            <span class="vote-count" id="vote-count-${map.id}">0</span>
        `;
        div.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            const countEl = div.querySelector('.vote-count');
            countEl.innerText = parseInt(countEl.innerText) + 1;
            const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
            fetch(`https://${resourceName}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        grid.appendChild(div);
    });
}

document.getElementById('btn-close-winner').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/closeWinnerScreen`, { method: 'POST' });
});

// ESC / Backspace zum Schließen des Menüs
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape' || e.key === 'Backspace') {
        const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
        fetch(`https://${resourceName}/closeUI`, { method: 'POST' });
    }
});

// Automatischer Refresh der Lobbyliste alle 5 Sekunden
setInterval(fetchLobbies, 5000);

/**
 * Host-Aktion: Bestehende Lobby bearbeiten
 */
document.getElementById('btn-edit-settings').addEventListener('click', () => {
    if (!isHost || !currentLobby) return;
    playSound('click');

    document.querySelector('[data-tab="create"]').click();

    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
    document.getElementById('round-time').value = currentLobby.roundTime;
    document.getElementById('max-players').value = currentLobby.maxPlayers;
    document.getElementById('respawn-time').value = currentLobby.respawnTime;
    document.getElementById('kill-limit').value = currentLobby.killLimit;
    document.getElementById('vehicles-allowed').checked = currentLobby.vehiclesAllowed;
    document.getElementById('friendly-fire').checked = currentLobby.friendlyFire;

    ['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) document.getElementById(id + '-val').innerText = el.value;
    });

    const createBtn = document.getElementById('btn-create-lobby');
    createBtn.innerText = "EINSTELLUNGEN SPEICHERN";
    createBtn.onclick = (e) => {
        e.preventDefault();
        const selectedLoadouts = [];
        document.querySelectorAll('#loadout-multi-select input:checked').forEach(i => selectedLoadouts.push(i.value));

        const settings = {
            lobbyId: currentLobby.id,
            name: document.getElementById('lobby-name').value,
            mapId: document.getElementById('map-select').value,
            mode: document.getElementById('mode-select').value,
            loadout: selectedLoadouts,
            roundTime: parseInt(document.getElementById('round-time').value),
            maxPlayers: parseInt(document.getElementById('max-players').value),
            respawnTime: parseInt(document.getElementById('respawn-time').value),
            killLimit: parseInt(document.getElementById('kill-limit').value),
            vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
            friendlyFire: document.getElementById('friendly-fire').checked
        };

        const resourceName = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'ffa-lobby';
        fetch(`https://${resourceName}/updateSettings`, {
            method: 'POST',
            body: JSON.stringify(settings)
        });

        createBtn.innerText = "LOBBY ERSTELLEN";
        createBtn.onclick = null;
    };
});
