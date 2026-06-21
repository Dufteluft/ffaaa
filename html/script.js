let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// Audio Assets
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

// Localization Engine
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'placeholder') {
                el.placeholder = locales[key];
            } else {
                el.innerText = locales[key];
            }
        }
    });
}

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('active')) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        currentTab = tab;

        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        if (tab === 'ffa' || tab === 'list') {
            document.getElementById('tab-browser').classList.add('active');
            fetchLobbies();
        } else if (tab === 'create') {
            document.getElementById('tab-create').classList.add('active');
        }
    });
});

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            myPlayerId = data.myId;
            setupInitialData(data.config, data.maps);
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
            showLobbyArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            updateLobbySettingsUI(data.settings);
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            updateHUDStats(data);
            break;
        case 'updateHUDDetails':
            updateHUDVitals(data);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization(config.Locales[config.Locale]);

    // Populate Selects
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        mapSelect.innerHTML += opt;
        filterMaps.innerHTML += opt;
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        loadoutSelect.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
    }
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

    const freeOnly = document.getElementById('filter-free-slots').checked;
    const mapFilter = document.getElementById('filter-maps').value;

    lobbies.forEach(lobby => {
        if (freeOnly && lobby.playerCount >= lobby.maxPlayers) return;
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="assets/maps/${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/120x70/222/fff?text=${lobby.mapLabel}'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}</div>
            </div>
            <div class="lobby-stats">
                <div class="player-count">${lobby.playerCount}/${lobby.maxPlayers} <i class="fa-solid fa-users"></i></div>
                <div class="status-badge ${lobby.status.toLowerCase()}">${lobby.status}</div>
            </div>
            <button class="join-btn" onclick="joinLobby('${lobby.id}')" data-locale="btn_join">BEITRETEN</button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

// Create Lobby
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA MATCH',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function showLobbyArea(lobby) {
    currentLobby = lobby;
    isHost = (lobby.host == myPlayerId);
    playSound('join');

    document.getElementById('display-lobby-id').innerText = lobby.id;
    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    // Show/Hide Host Controls
    document.querySelectorAll('.host-only').forEach(el => {
        el.style.display = isHost ? 'block' : 'none';
    });

    updateLobbySettingsUI(lobby);
}

function updateLobbySettingsUI(settings) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="setting-item"><span>MAP:</span> ${settings.mapLabel}</div>
        <div class="setting-item"><span>MODE:</span> ${settings.mode.toUpperCase()}</div>
        <div class="setting-item"><span>TIME:</span> ${settings.roundTime} MIN</div>
        <div class="setting-item"><span>LIMIT:</span> ${settings.killLimit} KILLS</div>
    `;
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <div class="p-info">
                <span class="p-name">${p.name.toUpperCase()}</span>
                <span class="p-team team-${p.team}">${p.team.toUpperCase()}</span>
            </div>
            <div class="p-actions">
                ${isHost && p.id != myPlayerId ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
                ${p.ready ? '<i class="fa-solid fa-check text-success"></i>' : '<i class="fa-solid fa-clock"></i>'}
            </div>
        `;
        container.appendChild(item);
    });

    if (isHost) {
        const allReady = players.every(p => p.ready || p.isHost);
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Actions
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
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

// Chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
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

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// Gameplay HUD & Countdown
function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    const num = document.getElementById('countdown-num');

    if (seconds > 0) {
        el.style.display = 'flex';
        num.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

function updateHUDStats(data) {
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.time !== undefined) document.getElementById('hud-time').innerText = data.time;
    if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
}

function updateHUDVitals(data) {
    document.getElementById('health-fill').style.width = data.health + '%';
    document.getElementById('armor-fill').style.width = data.armor + '%';
    document.getElementById('weapon-ammo').innerText = data.ammo;
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName;

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const voteList = document.getElementById('map-votes');
    voteList.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        voteList.innerHTML += `<div class="vote-item" onclick="voteMap('${map.id}', this)">${map.label}</div>`;
    });
}

function voteMap(mapId, el) {
    document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
    el.classList.add('active');
    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

// UI Close Helper
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Slider Helpers
const setupSlider = (id) => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (el && val) {
        el.addEventListener('input', () => { val.innerText = el.value; });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
