let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let currentLobbies = [];
let mapVotes = {};

// Audio Engine
const audioAssets = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    leave: new Audio('assets/leave.mp3'),
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

// Localization Helper
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
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
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        if (tab === 'create') {
            document.getElementById('tab-create').classList.add('active');
        } else {
            document.getElementById('tab-browser').classList.add('active');
            currentTab = tab;
            fetchLobbies();
        }
        currentTab = tab;
    });
});

document.getElementById('open-create-tab').addEventListener('click', () => {
    document.querySelector('[data-tab="create"]').click();
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    document.querySelector('[data-tab="ffa"]').click();
});

// Slider Value Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const slider = document.getElementById(id);
    const display = document.getElementById(id + '-val');
    if (slider && display) {
        slider.addEventListener('input', () => {
            display.innerText = slider.value;
        });
    }
});

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
            currentLobbies = data.lobbies;
            renderLobbyList();
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
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'block' : 'none';
            document.getElementById('hud-timer').style.display = data.isPersistent ? 'none' : 'block';
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
            const cd = document.getElementById('big-countdown');
            if (data.seconds > 0) {
                cd.innerText = data.seconds;
                cd.style.display = 'block';
            } else {
                cd.style.display = 'none';
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'playSound':
            playSound(data.sound);
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

    // Populate Map Selects
    const mapSelect = document.getElementById('map-select');
    const filterMap = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMap.innerHTML = `<option value="all">${config.Locales[config.Locale]['all_maps'] || 'Alle Maps'}</option>`;

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label}</option>`;
        mapSelect.innerHTML += opt;
        filterMap.innerHTML += opt;
    });

    // Populate Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (const key in config.WeaponLoadouts) {
        loadoutSelect.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
    }
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList() {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const mapFilter = document.getElementById('filter-maps').value;
    const playerFilter = document.getElementById('filter-players').value;

    currentLobbies.forEach(lobby => {
        // Filters
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;
        if (playerFilter === 'not-full' && lobby.playerCount >= lobby.maxPlayers) return;

        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}</div>
            </div>
            <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                    ${lobby.playerCount >= lobby.maxPlayers ? 'FULL' : 'JOIN'}
                </button>
            </div>
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

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: document.getElementById('loadout-select').value,
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
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name;
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    updateLobbyInfoSummary(lobby);
}

function updateLobbyInfoSummary(lobby) {
    const summary = document.getElementById('lobby-info-summary');
    summary.innerHTML = `
        <div>MAP: ${lobby.mapLabel}</div>
        <div>MODE: ${lobby.mode.toUpperCase()}</div>
        <div>TIME: ${lobby.roundTime} MIN</div>
        <div>LOADOUT: ${lobby.loadout.toUpperCase()}</div>
        <div>VEHICLES: ${lobby.vehiclesAllowed ? 'YES' : 'NO'}</div>
        <div>KILL LIMIT: ${lobby.killLimit > 0 ? lobby.killLimit : 'NONE'}</div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        const allReady = players.every(p => p.ready);
        document.getElementById('btn-start-game').disabled = !allReady || players.length < 2;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    // Populate creation form with current settings
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
    document.getElementById('loadout-select').value = currentLobby.loadout;
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

    document.querySelector('[data-tab="create"]').click();
});

// HUD & Real-time
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.querySelector('.blue-score').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.querySelector('.red-score').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName;

    let html = `<table><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    document.getElementById('match-stats-table').innerHTML = html;

    // Map Voting
    const votingList = document.getElementById('map-voting-list');
    votingList.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label;
        div.onclick = () => voteMap(map.id, div);
        votingList.appendChild(div);
    });
}

function voteMap(mapId, el) {
    playSound('click');
    document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

// Interaction Listeners
document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    playSound('leave');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.getAttribute('data-team') })
        });
    });
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const message = e.target.value.trim();
        if (message) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message })
            });
            e.target.value = '';
        }
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Filters refresh
document.getElementById('filter-maps').addEventListener('change', renderLobbyList);
document.getElementById('filter-players').addEventListener('change', renderLobbyList);

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
