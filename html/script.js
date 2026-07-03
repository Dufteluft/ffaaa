/**
 * GTA V FFA Lobby System - Frontend Logik
 * Verwaltet UI-Interaktionen, Soundeffekte und Kommunikation mit FiveM
 */

let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Soundeffekte Konfiguration
const sounds = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3')
};

/**
 * Spielt einen Soundeffekt ab
 * @param {string} name - Name des Sounds aus dem sounds Objekt
 */
function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(() => {});
    }
}

/**
 * Übersetzungs-Helper für das NUI
 * @param {string} str - Lokalisierungsschlüssel
 * @param {...string} args - Optionale Argumente für Platzhalter
 */
function _U(str, ...args) {
    if (serverConfig.Locales && serverConfig.Locales[serverConfig.Locale] && serverConfig.Locales[serverConfig.Locale][str]) {
        let text = serverConfig.Locales[serverConfig.Locale][str];
        args.forEach((arg, i) => {
            text = text.replace('%s', arg);
        });
        return text;
    }
    return str;
}

/**
 * Wendet Lokalisierungen auf alle Elemente mit data-locale Attribut an
 */
function applyLocalization() {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        el.innerText = _U(key);
    });
}

// Tab-Wechsel Logik
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        playSound('click');
        switchTab(tab);
    });
});

/**
 * Wechselt zwischen den Haupt-Tabs des Menüs
 * @param {string} tab - Ziel-Tab ('ffa', 'create', 'list')
 */
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    if (tab === 'create') {
        document.getElementById('tab-content-list').style.display = 'none';
        document.getElementById('tab-content-create').style.display = 'block';
    } else {
        document.getElementById('tab-content-list').style.display = 'flex';
        document.getElementById('tab-content-create').style.display = 'none';
        fetchLobbies();
    }
}

// Slider-Synchronisation mit Label-Anzeige
const setupSliderSync = (id) => {
    const slider = document.getElementById(`create-${id}`);
    const val = document.getElementById(`create-${id}-val`);
    if (slider && val) {
        slider.addEventListener('input', () => { val.innerText = slider.value; });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSliderSync);

// Event-Listener für Nachrichten vom Spiel-Client
window.addEventListener('message', (event) => {
    const data = event.data;
    switch (data.action) {
        case 'open':
            myPlayerId = data.myId;
            serverConfig = data.config;
            serverMaps = data.maps;
            setupFormOptions();
            applyLocalization();
            document.getElementById('app').style.display = 'flex';
            if (!data.isInGame) switchTab('ffa');
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showWaitingArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            currentLobby = data.lobby;
            updateWaitingAreaInfo();
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('hud').style.display = 'flex';
            document.getElementById('hud-tdm-scores').style.display = data.mode === 'tdm' ? 'block' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('hud').style.display = 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health-fill').style.width = `${data.health}%`;
            document.getElementById('hud-armor-fill').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

/**
 * Erstellt Dropdowns und Loadout-Optionen basierend auf der Config
 */
function setupFormOptions() {
    const mapSelect = document.getElementById('create-map-select');
    mapSelect.innerHTML = '';
    serverMaps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    const loadoutMulti = document.getElementById('create-loadout-multi');
    loadoutMulti.innerHTML = '';
    for (const [key, loadout] of Object.entries(serverConfig.WeaponLoadouts)) {
        const label = document.createElement('label');
        label.className = 'loadout-option';
        label.innerHTML = `<input type="checkbox" name="loadout" value="${key}"> ${key.toUpperCase()}`;
        loadoutMulti.appendChild(label);
    }
}

/**
 * Fordert aktuelle Lobbys vom Server an
 */
function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

/**
 * Zeigt die Lobbyliste im Browser an
 */
function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';
    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <h3>${lobby.name}</h3>
                <p>${lobby.mapLabel} | ${lobby.mode.toUpperCase()} | ${lobby.playerCount}/${lobby.maxPlayers}</p>
            </div>
            <button class="action-btn" onclick="joinLobby('${lobby.id}')">${_U('btn_join')}</button>
        `;
        container.appendChild(div);
    });
}

function joinLobby(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: id })
    });
}

// Event-Listener für Lobby-Erstellung
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);
    const settings = {
        name: document.getElementById('create-lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
        roundTime: parseInt(document.getElementById('create-round-time').value),
        maxPlayers: parseInt(document.getElementById('create-max-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn-time').value),
        killLimit: parseInt(document.getElementById('create-kill-limit').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-friendly-fire').checked
    };
    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

/**
 * Initialisiert den Wartebereich nach Beitritt
 * @param {object} lobby - Lobby-Datenobjekt
 */
function showWaitingArea(lobby) {
    currentLobby = lobby;
    isHost = (myPlayerId == lobby.host);
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('waiting-start-btn').style.display = isHost ? 'block' : 'none';
    document.getElementById('waiting-close-btn').style.display = isHost ? 'block' : 'none';
    updateWaitingAreaInfo();
}

function updateWaitingAreaInfo() {
    document.getElementById('waiting-lobby-name').innerText = currentLobby.name;
    document.getElementById('waiting-lobby-id').innerText = currentLobby.id;
}

/**
 * Rendert die Spielerliste im Wartebereich
 */
function renderPlayerList(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.isHost ? 'host' : ''} ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name}</span>
            <div class="p-actions">
                <span>${_U('team_' + p.team) || p.team}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')">KICK</button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });
    if (isHost) {
        document.getElementById('waiting-start-btn').disabled = (players.length < 2 && !currentLobby.isPersistent);
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

// Steuerungs-Buttons im Wartebereich
document.getElementById('waiting-ready-btn').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('waiting-start-btn').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('waiting-leave-btn').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('waiting-close-btn').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

// Chat Logik
document.getElementById('waiting-chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg.trim()) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

/**
 * Fügt eine Nachricht zum Lobby-Chat hinzu
 */
function addChatMessage(name, message) {
    const container = document.getElementById('waiting-chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

/**
 * Zeigt den Siegerbildschirm an
 */
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerText = data.winnerName + " " + _U('winner');

    const tbody = document.querySelector('#winner-stats-table tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });

    const voteContainer = document.getElementById('winner-vote-options');
    voteContainer.innerHTML = '';
    serverMaps.forEach(map => {
        const btn = document.createElement('button');
        btn.innerText = map.label;
        btn.onclick = () => { playSound('click'); fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: map.id }) }); };
        voteContainer.appendChild(btn);
    });
}

document.getElementById('btn-winner-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// Schließen via ESC
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Automatischer Refresh der Lobbyliste alle 5 Sekunden
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
