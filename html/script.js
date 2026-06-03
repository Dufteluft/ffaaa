let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let myPlayerId = null;
let currentLobby = null;
let isHost = false;

// Audio engine
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

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = tab;
        updateTabVisibility();

        if (currentTab === 'ffa' || currentTab === 'list') {
            fetchLobbies();
        }
    });
});

function updateTabVisibility() {
    document.getElementById('tab-lobby-list').style.display = (currentTab === 'ffa' || currentTab === 'list') ? 'block' : 'none';
    document.getElementById('tab-create-lobby').style.display = (currentTab === 'create') ? 'block' : 'none';
    document.getElementById('lobby-filters').style.display = (currentTab === 'list') ? 'flex' : 'none';
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && (currentTab === 'ffa' || currentTab === 'list')) {
        fetchLobbies();
    }
}, 5000);

// NUI Message Router
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
            showLobbyWaitingRoom(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            handleGameStarting();
            break;
        case 'showHUD':
            document.getElementById('hud').style.display = 'block';
            if (data.isPersistent) {
                document.getElementById('hud-timer').innerText = '∞';
            }
            break;
        case 'hideHUD':
            document.getElementById('hud').style.display = 'none';
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
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function applyLocalization() {
    const lang = serverConfig.Locales[serverConfig.Locale];
    if (!lang) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (lang[key]) {
            el.innerText = lang[key];
        }
    });
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization();

    // Setup Map Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    // Setup Multi-Select Loadouts
    const loadoutContainer = document.getElementById('loadout-multi-select');
    loadoutContainer.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const item = document.createElement('div');
        item.className = 'multi-select-item';
        item.dataset.value = key;
        item.innerHTML = `<i class="fa-regular fa-square"></i> <span>${config.WeaponLoadouts[key].label}</span>`;
        item.onclick = () => {
            item.classList.toggle('active');
            const icon = item.querySelector('i');
            icon.className = item.classList.contains('active') ? 'fa-solid fa-square-check' : 'fa-regular fa-square';
        };
        loadoutContainer.appendChild(item);
    }
}

// Lobby List Rendering
function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const filterFree = document.getElementById('filter-free-slots').checked;

    lobbies.forEach(lobby => {
        if (filterFree && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <h3>${lobby.name}</h3>
            <div class="lobby-info">
                <span><i class="fa-solid fa-user"></i> ${lobby.hostName}</span>
                <span><i class="fa-solid fa-users"></i> ${lobby.playerCount}/${lobby.maxPlayers}</span>
            </div>
            <div class="lobby-info">
                <span><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
            </div>
            <button class="join-btn" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                ${serverConfig.Locales[serverConfig.Locale]['btn_join']}
            </button>
        `;
        container.appendChild(item);
    });
}

window.joinLobby = (lobbyId, mapId) => {
    playSound('click');
    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobbyId })
        });
    }
};

// Lobby Creation
document.getElementById('btn-create-lobby-submit').onclick = () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('.multi-select-item.active')).map(el => el.dataset.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked,
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value)
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
};

// Slider Updates
const setupSlider = (id) => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    el.oninput = () => val.innerText = el.value;
};
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

// Waiting Room
function showLobbyWaitingRoom(lobby, host) {
    currentLobby = lobby;
    isHost = host;
    playSound('join');

    document.getElementById('waiting-lobby-name').innerText = lobby.name;
    document.getElementById('app').style.display = 'none';
    document.getElementById('lobby-waiting-room').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = host ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = host ? 'block' : 'none';
}

document.getElementById('btn-edit-settings').onclick = () => {
    playSound('click');
    document.getElementById('lobby-waiting-room').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="create"]').classList.add('active');
    currentTab = 'create';
    updateTabVisibility();

    // Fill form with current settings
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
    document.getElementById('round-time').value = currentLobby.roundTime;
    document.getElementById('round-time-val').innerText = currentLobby.roundTime;
    document.getElementById('max-players').value = currentLobby.maxPlayers;
    document.getElementById('max-players-val').innerText = currentLobby.maxPlayers;
    document.getElementById('vehicles-allowed').checked = currentLobby.vehiclesAllowed;
    document.getElementById('friendly-fire').checked = currentLobby.friendlyFire;
    document.getElementById('respawn-time').value = currentLobby.respawnTime;
    document.getElementById('respawn-time-val').innerText = currentLobby.respawnTime;
    document.getElementById('kill-limit').value = currentLobby.killLimit;
    document.getElementById('kill-limit-val').innerText = currentLobby.killLimit;

    // Multi-select loadout
    const loadouts = Array.isArray(currentLobby.loadout) ? currentLobby.loadout : [currentLobby.loadout];
    document.querySelectorAll('.multi-select-item').forEach(item => {
        const val = item.dataset.value;
        if (loadouts.includes(val)) {
            item.classList.add('active');
            item.querySelector('i').className = 'fa-solid fa-square-check';
        } else {
            item.classList.remove('active');
            item.querySelector('i').className = 'fa-regular fa-square';
        }
    });

    // Change create button to update button temporarily or just reuse it
    const btn = document.getElementById('btn-create-lobby-submit');
    btn.innerText = serverConfig.Locales[serverConfig.Locale]['btn_update'] || 'UPDATE';
    btn.onclick = () => {
        playSound('click');
        const selectedLoadouts = Array.from(document.querySelectorAll('.multi-select-item.active')).map(el => el.dataset.value);
        const settings = {
            lobbyId: currentLobby.id,
            name: document.getElementById('lobby-name').value,
            mapId: document.getElementById('map-select').value,
            mode: document.getElementById('mode-select').value,
            loadout: selectedLoadouts,
            roundTime: parseInt(document.getElementById('round-time').value),
            maxPlayers: parseInt(document.getElementById('max-players').value),
            vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
            friendlyFire: document.getElementById('friendly-fire').checked,
            respawnTime: parseInt(document.getElementById('respawn-time').value),
            killLimit: parseInt(document.getElementById('kill-limit').value)
        };
        fetch(`https://${GetParentResourceName()}/updateSettings`, {
            method: 'POST',
            body: JSON.stringify(settings)
        });
        // Reset button
        btn.innerText = serverConfig.Locales[serverConfig.Locale]['btn_create'];
        btn.onclick = originalCreateLobbySubmit;
    };
};

const originalCreateLobbySubmit = document.getElementById('btn-create-lobby-submit').onclick;

function renderPlayerList(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown"></i>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(item);
    });
}

window.kickPlayer = (id) => {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
};

document.getElementById('btn-ready-toggle').onclick = () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
};

document.getElementById('btn-start-game').onclick = () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
};

document.getElementById('btn-leave-lobby').onclick = () => {
    playSound('click');
    document.getElementById('lobby-waiting-room').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
};

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.onclick = () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    };
});

// Chat
function addChatMessage(name, message) {
    const container = document.getElementById('lobby-chat-messages');
    const msg = document.createElement('div');
    msg.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('lobby-chat-input').onkeypress = (e) => {
    if (e.key === 'Enter') {
        const message = e.target.value;
        if (message.trim().length > 0) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
            e.target.value = '';
        }
    }
};

// Gameplay HUD
function handleGameStarting() {
    document.getElementById('app').style.display = 'none';
    document.getElementById('lobby-waiting-room').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'none';
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'block';
        if (data.scoreBlue !== undefined) document.querySelector('#hud-tdm-score .blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.querySelector('#hud-tdm-score .red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health').style.width = data.health + '%';
    document.getElementById('hud-armor').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo || '0 / 0';
}

function showCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display').innerText = `${serverConfig.Locales[serverConfig.Locale]['winner'].replace('%s', data.winnerName)}`;

    const tbody = document.querySelector('#winner-stats-table tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });

    const voteList = document.getElementById('map-vote-list');
    voteList.innerHTML = '';
    serverMaps.forEach(map => {
        const item = document.createElement('div');
        item.className = 'vote-item';
        item.innerText = map.label;
        item.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            item.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteList.appendChild(item);
    });
}

document.getElementById('btn-back-lobby').onclick = () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-room').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
};

document.getElementById('btn-back-menu').onclick = () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
};
