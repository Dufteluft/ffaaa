let L = {}; // Lokalisierung
let currentTab = 'ffa';
let serverMaps = [];
let serverLoadouts = {};
let playerLobby = null;
let isHost = false;

// Audio setup
const sounds = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3')
};

function playSound(name) {
    if (sounds[name]) {
        sounds[name].currentTime = 0;
        sounds[name].play().catch(() => {});
    }
}

// UI-Initialisierung
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            L = data.config.Locales[data.config.Locale];
            serverMaps = data.maps;
            serverLoadouts = data.config.WeaponLoadouts;
            localizeUI();
            setupInitialData();
            document.getElementById('app').style.display = 'flex';
            fetchLobbies();
            playSound('click');
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyJoined':
        case 'lobbyCreated':
            playerLobby = data.lobby;
            isHost = (data.action === 'lobbyCreated');
            showWaitingArea();
            playSound('join');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            playSound('start');
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
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
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            playSound('win');
            break;
    }
});

function localizeUI() {
    for (let key in L) {
        const el = document.getElementById('l-' + key);
        if (el) el.innerText = L[key];
        // Auch für IDs mit Suffix wie _2
        const el2 = document.getElementById('l-' + key + '_2');
        if (el2) el2.innerText = L[key];
    }
}

function setupInitialData() {
    // Maps Dropdowns
    const mapSelects = ['filter-maps', 'create-map'];
    mapSelects.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = id.includes('filter') ? `<option value="all">${L['all'] || 'ALLE'}</option>` : '';
        serverMaps.forEach(map => {
            sel.innerHTML += `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        });
    });

    // Loadout Grid
    const grid = document.getElementById('loadout-grid');
    grid.innerHTML = '';
    for (let key in serverLoadouts) {
        grid.innerHTML += `
            <div class="checkbox-item">
                <input type="checkbox" name="loadout" value="${key}" id="chk-${key}">
                <label for="chk-${key}">${key.toUpperCase()}</label>
            </div>
        `;
    }
}

// Tab-Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;

        const sidebar = document.getElementById('sidebar-filters');
        const list = document.getElementById('lobby-list-container');
        const create = document.getElementById('create-lobby-view');

        if (currentTab === 'create') {
            sidebar.style.display = 'none';
            list.style.display = 'none';
            create.style.display = 'flex';
        } else {
            sidebar.style.display = 'flex';
            list.style.display = 'flex';
            create.style.display = 'none';
            fetchLobbies();
        }
    });
});

function fetchLobbies() {
    post('fetchLobbies', { tab: currentTab });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        const color = percent > 80 ? '#ff9500' : '#00ff88';
        const circ = 2 * Math.PI * 20;
        const offset = circ - (percent / 100) * circ;

        container.innerHTML += `
            <div class="lobby-item">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode.toUpperCase()}</div>
                    <div class="map-name-row">${lobby.mapLabel}</div>
                    <div style="font-size: 11px; color: #a0a0a0;">HOST: ${lobby.hostName}</div>
                </div>
                <div class="player-counter-wrapper">
                    <svg class="player-counter-svg" width="50" height="50">
                        <circle class="circle-bg" cx="25" cy="25" r="20"></circle>
                        <circle class="circle-progress" cx="25" cy="25" r="20"
                            style="stroke: ${color}; stroke-dasharray: ${circ}; stroke-dashoffset: ${offset};"></circle>
                    </svg>
                    <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
                </div>
                <div class="status-badge">${lobby.status}</div>
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${L['btn_join'] || 'BEITRETEN'}</button>
            </div>
        `;
    });
}

function joinLobby(id) {
    playSound('click');
    post('joinLobby', { lobbyId: id });
}

// Lobby Erstellen
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('input[name="loadout"]:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('create-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: selectedLoadouts, // Jetzt ein Array
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-max').value),
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-kills').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };

    post('createLobby', settings);
});

// Slider Updates
const sliders = ['create-time', 'create-max', 'create-respawn', 'create-kills'];
sliders.forEach(id => {
    const s = document.getElementById(id);
    const v = document.getElementById(id.replace('create-', '') + '-val');
    s.addEventListener('input', () => { v.innerText = s.value; });
});

// Wartebereich
function showWaitingArea() {
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-title-display').innerText = playerLobby.name.toUpperCase();

    document.getElementById('lobby-info-details').innerHTML = `
        <div>MAP: ${playerLobby.mapLabel}</div>
        <div>MODE: ${playerLobby.mode.toUpperCase()}</div>
        <div>LIMIT: ${playerLobby.killLimit || 'OFF'}</div>
    `;

    document.getElementById('btn-start-action').style.display = isHost ? 'block' : 'none';
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list-display');
    container.innerHTML = '';
    players.forEach(p => {
        container.innerHTML += `
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <span>${p.name.toUpperCase()}</span>
                <span style="font-size: 10px; color: #a0a0a0;">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button onclick="post('kickPlayer', {id: ${p.id}})" style="background:none; border:none; color:#ff4444; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
    });
}

// Chat
document.getElementById('btn-send-chat').addEventListener('click', sendChat);
document.getElementById('chat-input-field').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const input = document.getElementById('chat-input-field');
    if (input.value.trim()) {
        post('sendLobbyChat', { message: input.value });
        input.value = '';
    }
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages-display');
    container.innerHTML += `<div><span style="color:var(--primary); font-weight:800;">${name}:</span> ${message}</div>`;
    container.scrollTop = container.scrollHeight;
}

// Aktionen
document.getElementById('btn-ready-action').addEventListener('click', () => {
    playSound('click');
    post('toggleReady');
});
document.getElementById('btn-start-action').addEventListener('click', () => {
    playSound('start');
    post('startGame');
});
document.getElementById('btn-leave-action').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    post('leaveLobby');
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        post('setTeam', { team: btn.dataset.team });
    });
});

// HUD
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-hp-bar').style.width = data.health + '%';
    document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(secs) {
    const el = document.getElementById('hud-countdown');
    if (secs > 0) {
        el.style.display = 'block';
        el.innerText = secs;
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerText = data.winnerName.toUpperCase() + ' ' + (L['winner_suffix'] || 'GEWINNT!');

    let statsHtml = `<table><tr><th>NAME</th><th>KILLS</th><th>TODE</th></tr>`;
    data.stats.forEach(s => {
        statsHtml += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td></tr>`;
    });
    statsHtml += `</table>`;
    document.getElementById('winner-stats-container').innerHTML = statsHtml;

    const voteGrid = document.getElementById('map-voting-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 6).forEach(map => {
        voteGrid.innerHTML += `<div class="map-vote-item" onclick="voteMap('${map.id}', this)">${map.label}</div>`;
    });
}

function voteMap(id, el) {
    playSound('click');
    document.querySelectorAll('.map-vote-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    post('voteMap', { mapId: id });
}

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    post('leaveLobby');
});

document.getElementById('btn-winner-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    post('closeWinnerScreen');
});

// Helpers
function post(event, data = {}) {
    fetch(`https://${GetParentResourceName()}/${event}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') post('closeUI');
});
