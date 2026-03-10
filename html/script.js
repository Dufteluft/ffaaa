let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
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

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Toggle Views
        if (tab === 'create') {
            document.getElementById('lobby-list-container').style.display = 'none';
            document.getElementById('sidebar-filters').style.display = 'none';
            document.getElementById('create-lobby-tab').style.display = 'block';
        } else {
            document.getElementById('lobby-list-container').style.display = 'flex';
            document.getElementById('sidebar-filters').style.display = 'flex';
            document.getElementById('create-lobby-tab').style.display = 'none';
            currentTab = tab;
            fetchLobbies();
        }
    });
});

// Slider Value Sync
const setupSlider = (id) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => { span.innerText = slider.value; });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
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
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
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
            handleCountdown(data.seconds);
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
    L = config.Locales[config.Locale] || {};

    // Apply Localization to UI
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (L[key]) el.innerText = L[key];
    });

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

    const loadoutSelect = document.getElementById('loadout-select-simple');
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

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const mapImg = `https://via.placeholder.com/120x70/0f1419/ffffff?text=${lobby.mapLabel}`;

        item.innerHTML = `
            <div class="lobby-map-preview"><img src="${mapImg}"></div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
            </div>
            <div class="player-count"><strong>${lobby.playerCount}/${lobby.maxPlayers}</strong></div>
            <div class="action-area">${renderActionButton(lobby)}</div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) return `<button class="action-btn btn-disabled" disabled>FULL</button>`;
    if (lobby.status === 'ACTIVE') return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}')">SPECTATE</button>`;
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${L['btn_join'] || 'JOIN'}</button>`;
}

window.joinLobby = (lobbyId) => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
};

document.getElementById('btn-create-lobby-action').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: document.getElementById('loadout-select-simple').value,
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        vehiclesAllowed: document.getElementById('toggle-vehicles').checked,
        friendlyFire: document.getElementById('toggle-ff').checked,
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value)
    };
    fetch(`https://${GetParentResourceName()}/createLobby`, { method: 'POST', body: JSON.stringify(settings) });
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="icon-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

window.kickPlayer = (id) => {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, { method: 'POST', body: JSON.stringify({ id }) });
};

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

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, { method: 'POST', body: JSON.stringify({ team: btn.dataset.team }) });
    });
});

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-score-tdm').style.display = 'flex';
        document.getElementById('score-blue').innerText = data.scoreBlue || 0;
        document.getElementById('score-red').innerText = data.scoreRed || 0;
    } else {
        document.getElementById('hud-score-tdm').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    document.getElementById('bar-health').style.width = data.health + '%';
    document.getElementById('bar-armor').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo || '0';
}

function handleCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    if (seconds > 0) {
        el.style.display = 'flex';
        el.querySelector('.countdown-number').innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

// Chat
function addChatMessage(name, message) {
    const box = document.getElementById('chat-messages');
    box.innerHTML += `<div><strong>${name}:</strong> ${message}</div>`;
    box.scrollTop = box.scrollHeight;
}

document.getElementById('btn-send-chat').addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    if (input.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, { method: 'POST', body: JSON.stringify({ message: input.value }) });
        input.value = '';
    }
});

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const tbody = document.querySelector('#match-stats-table tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        tbody.innerHTML += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });

    // Map Voting
    const grid = document.getElementById('map-voting-grid');
    grid.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        grid.innerHTML += `
            <div class="map-vote-item" onclick="voteMap('${map.id}')">
                <img src="https://via.placeholder.com/150x60/0f1419/ffffff?text=${map.label}">
                <div class="map-vote-label">${map.label}</div>
            </div>
        `;
    });
}

window.voteMap = (mapId) => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId }) });
};

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
});
