let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let selectedLoadouts = [];
let L = {}; // Localization object

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

// Tab Management
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        playSound('click');
        switchTab(tab);
    });
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

    document.getElementById('lobby-browser').style.display = (tab === 'ffa' || tab === 'list') ? 'flex' : 'none';
    document.getElementById('create-lobby-tab').style.display = (tab === 'create') ? 'block' : 'none';

    if (tab === 'ffa' || tab === 'list') {
        fetchLobbies();
    }
}

// Slider Updates
const setupSlider = (id, valId) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(valId);
    slider.addEventListener('input', () => {
        span.innerText = slider.value;
    });
};
setupSlider('create-time', 'val-time');
setupSlider('create-players', 'val-players');
setupSlider('create-respawn', 'val-respawn');
setupSlider('create-killlimit', 'val-kills');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            initializeUI(data.config, data.maps);
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showWaitingArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'flex';
            document.getElementById('hud-team-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function initializeUI(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    L = config.Locales[config.Locale];

    // Localize static elements
    for (let key in L) {
        const el = document.getElementById('L_' + key);
        if (el) el.innerText = L[key];
        const els = document.querySelectorAll('.L_' + key);
        els.forEach(e => e.innerText = L[key]);
    }

    // Populate maps in dropdown and filters
    const filterMap = document.getElementById('filter-maps');
    const createMap = document.getElementById('create-map');
    filterMap.innerHTML = `<option value="all">${L['map_select'].toUpperCase()}</option>`;
    createMap.innerHTML = '';

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        filterMap.innerHTML += opt;
        createMap.innerHTML += opt;
    });

    // Populate Loadouts
    const loadoutGrid = document.getElementById('loadout-checkbox-grid');
    loadoutGrid.innerHTML = '';
    selectedLoadouts = [];

    for (let key in config.WeaponLoadouts) {
        if (key === 'all') continue;
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `<span>${key.toUpperCase()}</span>`;
        div.onclick = () => {
            div.classList.toggle('active');
            if (div.classList.contains('active')) {
                selectedLoadouts.push(key);
            } else {
                selectedLoadouts = selectedLoadouts.filter(l => l !== key);
            }
        };
        loadoutGrid.appendChild(div);
    }

    fetchLobbies();
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list');
    container.innerHTML = '';

    lobbies.forEach((lobby, index) => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.style.animationDelay = `${index * 0.05}s`;

        const modeLabel = lobby.mode === 'tdm' ? 'TDM' : 'FFA';
        const isFull = lobby.playerCount >= lobby.maxPlayers;

        div.innerHTML = `
            <div class="lobby-info-main">
                <h4>${lobby.name.toUpperCase()}</h4>
                <p><i class="fa-solid fa-map-pin"></i> ${lobby.mapLabel} | <i class="fa-solid fa-gamepad"></i> ${modeLabel} | <i class="fa-solid fa-user"></i> ${lobby.hostName}</p>
            </div>
            <div class="player-count">
                <span style="font-weight:900; font-size: 18px;">${lobby.playerCount}/${lobby.maxPlayers}</span>
            </div>
            <div class="lobby-status">
                <span class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</span>
            </div>
            <button class="action-btn btn-join" ${isFull ? 'disabled' : ''} onclick="joinLobby('${lobby.id}')">
                ${isFull ? 'FULL' : L['btn_join']}
            </button>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

// Create Lobby Submit
document.getElementById('btn-submit-create').addEventListener('click', () => {
    const name = document.getElementById('create-name').value;
    if (!name || name.length < 3) return;

    playSound('click');
    const settings = {
        name: name,
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-killlimit').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    switchTab('ffa');
});

// Waiting Area Logic
function showWaitingArea(lobby, host) {
    currentLobby = lobby;
    isHost = host;
    playSound('join');

    document.getElementById('main-container').style.display = 'none';
    document.getElementById('waiting-area').style.display = 'flex';
    document.getElementById('display-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('host-only-controls').style.display = host ? 'block' : 'none';
    document.getElementById('chat-messages').innerHTML = '';

    updateSettingsSummary(lobby);
}

function updateSettingsSummary(lobby) {
    const container = document.getElementById('lobby-settings-summary');
    if (isHost && !lobby.isPersistent) {
        container.innerHTML = `
            <div class="settings-edit-grid">
                <div class="edit-item">
                    <label>${L['round_time']}</label>
                    <input type="number" value="${lobby.roundTime}" onchange="updateLobbySetting('roundTime', this.value)">
                </div>
                <div class="edit-item">
                    <label>${L['kill_limit']}</label>
                    <input type="number" value="${lobby.killLimit}" onchange="updateLobbySetting('killLimit', this.value)">
                </div>
                <div class="edit-item">
                    <label>${L['respawn_time']}</label>
                    <input type="number" value="${lobby.respawnTime}" onchange="updateLobbySetting('respawnTime', this.value)">
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="settings-list">
                <p><strong>MAP:</strong> ${lobby.mapLabel}</p>
                <p><strong>MODE:</strong> ${lobby.mode.toUpperCase()}</p>
                <p><strong>TIME:</strong> ${lobby.roundTime} MIN</p>
                <p><strong>KILL LIMIT:</strong> ${lobby.killLimit > 0 ? lobby.killLimit : 'OFF'}</p>
            </div>
        `;
    }
}

function updateLobbySetting(key, value) {
    fetch(`https://${GetParentResourceName()}/updateSettings`, {
        method: 'POST',
        body: JSON.stringify({ [key]: parseInt(value) })
    });
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';

    let allReady = true;

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;

        let teamLabel = p.team.toUpperCase();
        if (teamLabel === 'NONE') teamLabel = 'WAITING';

        div.innerHTML = `
            <div class="p-info">
                <strong>${p.name.toUpperCase()}</strong>
                <span style="font-size: 10px; color: var(--text-muted); display: block;">${teamLabel}</span>
            </div>
            <div class="p-actions">
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-minus"></i></button>` : ''}
                ${p.isHost ? '<i class="fa-solid fa-crown" style="color:var(--warning)"></i>' : ''}
            </div>
        `;

        if (!p.ready) allReady = false;
        container.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start').style.display = 'block';
        document.getElementById('btn-start').disabled = !allReady || players.length < 1; // 1 for testing
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.getElementById('btn-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave').addEventListener('click', () => {
    playSound('click');
    document.getElementById('waiting-area').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
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

// Chat
function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value;
    if (msg.trim().length > 0) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: msg })
        });
        input.value = '';
    }
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

document.getElementById('btn-send-chat').addEventListener('click', () => {
    sendChatMessage();
});

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<span style="color:var(--primary)">${name}:</span> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-bar').style.width = data.health + '%';
    document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerText = `${L['winner']}: ${data.winnerName}`;

    const container = document.getElementById('winner-stats-container');
    let html = `<table><thead><tr><th>${L['kills'].toUpperCase()}</th><th>${L['deaths'].toUpperCase()}</th><th>K/D</th><th>NAME</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td><td>${s.name.toUpperCase()}</td></tr>`;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    renderMapVoting();
}

function renderMapVoting() {
    const container = document.getElementById('map-vote-grid');
    container.innerHTML = '';

    // Pick 4 random maps for voting
    const shuffled = [...serverMaps].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);

    selected.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `<span>${map.label.toUpperCase()}</span>`;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('selected'));
            div.classList.add('selected');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        container.appendChild(div);
    });
}

document.getElementById('btn-winner-back').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('main-container').style.display === 'flex' &&
        (currentTab === 'ffa' || currentTab === 'list')) {
        fetchLobbies();
    }
}, 5000);
