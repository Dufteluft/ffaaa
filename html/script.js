let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Audio Setup
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

// Lokalisierung
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

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        if (tab === 'create') {
            document.getElementById('create-lobby-view').classList.add('active');
            document.getElementById('sidebar-filters').style.display = 'none';
        } else {
            document.getElementById('lobby-list-view').classList.add('active');
            document.getElementById('sidebar-filters').style.display = 'flex';
            currentTab = tab;
            fetchLobbies();
        }
    });
});

// Slider Sync
function setupSlider(id, valId) {
    const slider = document.getElementById(id);
    const output = document.getElementById(valId);
    if (slider && output) {
        slider.addEventListener('input', () => {
            output.innerText = slider.value;
        });
    }
}
setupSlider('create-round-time', 'val-round-time');
setupSlider('create-max-players', 'val-max-players');
setupSlider('create-respawn-time', 'val-respawn-time');
setupSlider('create-kill-limit', 'val-kill-limit');

// NUI Message Handling
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
            showLobbyWaitingArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            updateLobbySettings(data.lobby);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            showHUD(data.isPersistent);
            break;
        case 'hideHUD':
            document.getElementById('gameplay-hud').style.display = 'none';
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'updateHUD':
            updateHUDStats(data);
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    applyLocalization(config.Locales[config.Locale]);

    // Map Selects
    const createMap = document.getElementById('create-map-select');
    const filterMap = document.getElementById('filter-maps');
    createMap.innerHTML = '';
    filterMap.innerHTML = '<option value="all">ALL MAPS</option>';

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        createMap.innerHTML += opt;
        filterMap.innerHTML += opt;
    });

    // Loadout Multi-Select
    const loadoutContainer = document.getElementById('create-loadout-select');
    loadoutContainer.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('label');
        div.innerHTML = `<input type="checkbox" name="loadout" value="${key}"> ${key.toUpperCase()}`;
        loadoutContainer.appendChild(div);
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

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name} (${lobby.mode.toUpperCase()})</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}
                </div>
            </div>
            <div class="player-info">
                <i class="fa-solid fa-users"></i> ${lobby.playerCount}/${lobby.maxPlayers}
            </div>
            <div class="status-badge">${lobby.status}</div>
            <button class="confirm-btn" onclick="joinLobby('${lobby.id}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                ${serverConfig.Locales[serverConfig.Locale].btn_join}
            </button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: id })
    });
}

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const loadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(el => el.value);

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: loadouts.length > 0 ? loadouts : 'all',
        roundTime: parseInt(document.getElementById('create-round-time').value),
        maxPlayers: parseInt(document.getElementById('create-max-players').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked,
        respawnTime: parseInt(document.getElementById('create-respawn-time').value),
        killLimit: parseInt(document.getElementById('create-kill-limit').value)
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function showLobbyWaitingArea(lobby) {
    currentLobby = lobby;
    isHost = (lobby.host == myPlayerId);

    playSound('join');
    document.getElementById('waiting-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('waiting-lobby-id').innerText = lobby.id;
    document.getElementById('waiting-max-players').innerText = lobby.maxPlayers;

    document.getElementById('lobby-waiting-area').style.display = 'flex';

    if (isHost) {
        document.getElementById('host-settings-editor').style.display = 'block';
        document.getElementById('player-info-display').style.display = 'none';
        document.getElementById('btn-waiting-start').style.display = 'block';
        document.getElementById('btn-waiting-close').style.display = 'block';
        renderSettingsEditor(lobby);
    } else {
        document.getElementById('host-settings-editor').style.display = 'none';
        document.getElementById('player-info-display').style.display = 'block';
        document.getElementById('btn-waiting-start').style.display = 'none';
        document.getElementById('btn-waiting-close').style.display = 'none';
        updateLobbyInfoSummary(lobby);
    }
}

function renderSettingsEditor(lobby) {
    const container = document.getElementById('settings-editor-content');
    // Vereinfachte Version für die Demo, im echten Script würden hier Inputs sein
    container.innerHTML = `
        <div class="input-group">
            <label>NAME</label>
            <input type="text" value="${lobby.name}" onchange="saveSettings('name', this.value)">
        </div>
        <div class="input-row">
            <div class="input-group">
                <label>MAP</label>
                <select onchange="saveSettings('mapId', this.value)">
                    ${serverMaps.map(m => `<option value="${m.id}" ${m.id == lobby.mapId ? 'selected' : ''}>${m.label}</option>`).join('')}
                </select>
            </div>
            <div class="input-group">
                <label>MODUS</label>
                <select onchange="saveSettings('mode', this.value)">
                    <option value="ffa" ${lobby.mode == 'ffa' ? 'selected' : ''}>FFA</option>
                    <option value="tdm" ${lobby.mode == 'tdm' ? 'selected' : ''}>TDM</option>
                </select>
            </div>
        </div>
    `;
}

function saveSettings(key, value) {
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
        method: 'POST',
        body: JSON.stringify({ key, value })
    });
}

function updateLobbyInfoSummary(lobby) {
    const summary = document.getElementById('waiting-info-summary');
    summary.innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>LOADOUT: ${Array.isArray(lobby.loadout) ? lobby.loadout.join(', ') : lobby.loadout}</p>
    `;
}

function renderPlayerList(players) {
    const container = document.getElementById('waiting-player-list');
    container.innerHTML = '';
    document.getElementById('waiting-player-count').innerText = players.length;

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <div style="display: flex; gap: 10px; align-items: center;">
                <span class="team-tag">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer(${p.id})"><i class="fa-solid fa-user-minus"></i></button>` : ''}
            </div>
        `;
        container.appendChild(item);
    });

    if (isHost) {
        document.getElementById('btn-waiting-start').disabled = (players.length < 2);
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// HUD Functions
function showHUD(isPersistent) {
    document.getElementById('gameplay-hud').style.display = 'block';
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-fill').style.width = data.health + '%';
    document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function updateHUDStats(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-score-container').style.display = 'flex';
        document.getElementById('hud-score-blue').style.display = 'block';
        document.getElementById('hud-score-red').style.display = 'block';
        document.querySelectorAll('.score-divider').forEach(el => el.style.display = 'block');

        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-score-container').style.display = 'none';
    }
}

function showCountdown(seconds) {
    const el = document.getElementById('game-countdown');
    const text = document.getElementById('countdown-text');

    if (seconds > 0) {
        el.style.display = 'flex';
        text.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerHTML = `${data.winnerName.toUpperCase()} <span data-locale="winner_suffix">${serverConfig.Locales[serverConfig.Locale].winner_suffix}</span>`;

    const body = document.getElementById('winner-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        body.innerHTML += `
            <tr>
                <td>${s.name.toUpperCase()}</td>
                <td>${s.kills}</td>
                <td>${s.deaths}</td>
                <td>${s.kd}</td>
            </tr>
        `;
    });

    const voteContainer = document.getElementById('map-vote-options');
    voteContainer.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        voteContainer.innerHTML += `<button class="vote-btn" onclick="voteMap('${map.id}', this)">${map.label}</button>`;
    });
}

function voteMap(mapId, btn) {
    document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

// Chat Functions
function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-entry';
    msg.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

// Event Listeners for Buttons
document.getElementById('btn-waiting-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-waiting-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-waiting-leave').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-waiting-close').addEventListener('click', () => {
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

document.getElementById('btn-winner-back').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
