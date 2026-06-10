let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

const audioAssets = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3')
};

function playSound(name) {
    if (audioAssets[name]) {
        audioAssets[name].currentTime = 0;
        audioAssets[name].play().catch(() => {});
    }
}

function applyLocalization(config) {
    const locale = config.Locales[config.Locale];
    if (!locale) return;
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locale[key]) el.innerText = locale[key];
    });
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = tab;

        if (tab === 'create') {
            document.getElementById('create-lobby-tab').style.display = 'block';
            document.getElementById('lobby-list-container').style.display = 'none';
        } else {
            document.getElementById('create-lobby-tab').style.display = 'none';
            document.getElementById('lobby-list-container').style.display = 'flex';
            fetchLobbies();
        }
    });
});

// Slider Value Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (el && val) {
        el.addEventListener('input', () => { val.innerText = el.value; });
    }
});

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            if (data.isInGame) {
                document.getElementById('player-stats-sidebar').style.display = 'none';
            } else {
                document.getElementById('player-stats-sidebar').style.display = 'block';
                fetchLobbies();
            }
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
        case 'updateLobbyJoined': // Settings updated
            currentLobby = data.lobby;
            updateLobbySettingsUI(data.lobby);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'flex';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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
        case 'receiveStats':
            updateSidebarStats(data);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization(config);

    // Filter Maps
    const filterMap = document.getElementById('filter-maps');
    filterMap.innerHTML = '<option value="all">ALL MAPS</option>';
    maps.forEach(m => {
        filterMap.innerHTML += `<option value="${m.id}">${m.label.toUpperCase()}</option>`;
    });

    // Create Map Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(m => {
        mapSelect.innerHTML += `<option value="${m.id}">${m.label.toUpperCase()}</option>`;
    });

    // Loadout Multi-Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        loadoutSelect.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
    }

    // Winner Screen Map Voting
    const voteContainer = document.getElementById('map-voting-container');
    voteContainer.innerHTML = '';
    maps.slice(0, 4).forEach(m => {
        voteContainer.innerHTML += `
            <div class="vote-item" onclick="voteMap('${m.id}')" id="vote-${m.id}">
                <img src="assets/${m.id}.png" onerror="this.src='https://via.placeholder.com/120x70?text=${m.label}'">
                <div class="vote-count" id="count-${m.id}">0</div>
            </div>
        `;
    });

    fetch(`https://${GetParentResourceName()}/getStats`, { method: 'POST' });
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const mapFilter = document.getElementById('filter-maps').value;
    const playerFilter = document.getElementById('filter-players').value;

    lobbies.forEach(lobby => {
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;
        if (playerFilter === 'not-full' && lobby.playerCount >= lobby.maxPlayers) return;

        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="assets/${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/140x80?text=${lobby.mapLabel}'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | HOST: ${lobby.hostName}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="30" cy="30" r="${radius}"></circle>
                    <circle class="circle-progress" cx="30" cy="30" r="${radius}"
                        style="stroke: var(--primary); stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"></circle>
                </svg>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">BEITRETEN</button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId, mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId, mapId })
    });
}

function collectSettings() {
    const selectedLoadouts = Array.from(document.getElementById('loadout-select').selectedOptions).map(opt => opt.value);
    return {
        name: document.getElementById('lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'all',
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked
    };
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(collectSettings())
    });
});

document.getElementById('btn-save-settings').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
        method: 'POST',
        body: JSON.stringify(collectSettings())
    });
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('create-lobby-tab').style.display = 'none';
    document.getElementById('lobby-list-container').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();

    // Host Controls
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-save-settings').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    updateLobbySettingsUI(lobby);
}

function updateLobbySettingsUI(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-item">MAP: <b>${lobby.mapLabel}</b></div>
        <div class="info-item">MODUS: <b>${lobby.mode.toUpperCase()}</b></div>
        <div class="info-item">ZEIT: <b>${lobby.roundTime} MIN</b></div>
        <div class="info-item">LIMIT: <b>${lobby.killLimit > 0 ? lobby.killLimit : 'AUS'}</b></div>
        <div class="info-item">VEHICLES: <b>${lobby.vehiclesAllowed ? 'AN' : 'AUS'}</b></div>
        <div class="info-item">FF: <b>${lobby.friendlyFire ? 'AN' : 'AUS'}</b></div>
    `;

    if (isHost) {
        document.getElementById('lobby-name').value = lobby.name;
        document.getElementById('map-select').value = lobby.mapId;
        document.getElementById('mode-select').value = lobby.mode;
        document.getElementById('round-time').value = lobby.roundTime;
        document.getElementById('round-time-val').innerText = lobby.roundTime;
        document.getElementById('max-players').value = lobby.maxPlayers;
        document.getElementById('max-players-val').innerText = lobby.maxPlayers;
        document.getElementById('respawn-time').value = lobby.respawnTime;
        document.getElementById('respawn-time-val').innerText = lobby.respawnTime;
        document.getElementById('kill-limit').value = lobby.killLimit;
        document.getElementById('kill-limit-val').innerText = lobby.killLimit;
        document.getElementById('vehicles-allowed').checked = lobby.vehiclesAllowed;
        document.getElementById('friendly-fire').checked = lobby.friendlyFire;
    }
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            <span style="font-size: 10px; color: var(--text-muted);">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
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

function addChatMessage(name, msg) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name">${name}:</span> ${msg}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

function showCountdown(seconds) {
    const overlay = document.getElementById('big-countdown');
    const num = overlay.querySelector('.countdown-number');
    if (seconds <= 0) {
        overlay.style.display = 'none';
        return;
    }
    overlay.style.display = 'flex';
    num.innerText = seconds;
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) {
        document.querySelector('.score-blue').innerText = data.scoreBlue;
        document.querySelector('.score-red').innerText = data.scoreRed;
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health').style.width = data.health + '%';
    document.getElementById('hud-armor').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo || '0';
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const table = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    table.innerHTML = html;
}

function voteMap(mapId) {
    playSound('click');
    document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
    document.getElementById('vote-' + mapId).classList.add('active');
    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId: mapId })
    });
}

function updateSidebarStats(data) {
    document.getElementById('stats-kills').innerText = data.kills || 0;
    document.getElementById('stats-deaths').innerText = data.deaths || 0;
    document.getElementById('stats-wins').innerText = data.wins || 0;
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
