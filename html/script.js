let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let translations = {};

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

// Initialization & Localization
function setupLocalization(localeData) {
    translations = localeData;
    document.querySelectorAll('[data-locale]').forEach(elem => {
        const key = elem.getAttribute('data-locale');
        if (translations[key]) {
            elem.innerText = translations[key];
        }
    });
}

// Tab Management
const tabs = document.querySelectorAll('.tab-btn');
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const target = tab.dataset.tab;
        if (target === currentTab) return;

        playSound('click');
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        currentTab = target;

        if (target === 'create') {
            document.getElementById('browser-view').style.display = 'none';
            document.getElementById('create-view').style.display = 'flex';
        } else {
            document.getElementById('browser-view').style.display = 'flex';
            document.getElementById('create-view').style.display = 'none';
            fetchLobbies();
        }
    });
});

// NUI Message Handlers
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            myPlayerId = data.myId;
            initializeMenu(data.config, data.maps);
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayers(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            toggleHUDMode(data.isPersistent ? 'ffa' : 'custom'); // Persistent Lobbies are always FFA
            break;
        case 'updateHUD':
            updateHUDStats(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
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
        case 'syncSettings':
            if (currentLobby) updateLobbyInfo(data.lobby);
            break;
    }
});

function initializeMenu(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    setupLocalization(config.Locales[config.Locale]);

    // Populate Map Select
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = `<option value="all">${translations['map_select']}</option>`;

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        mapSelect.innerHTML += opt;
        filterMaps.innerHTML += opt;
    });

    // Populate Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (const key in config.WeaponLoadouts) {
        loadoutSelect.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
    }

    fetchLobbies();
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbies(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const freeSlotsFilter = document.getElementById('filter-free-slots').checked;
    const mapFilter = document.getElementById('filter-maps').value;

    lobbies.forEach(lobby => {
        if (freeSlotsFilter && lobby.playerCount >= lobby.maxPlayers) return;
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;

        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info">
                <h3>${lobby.name}</h3>
                <span class="map">${lobby.mapLabel} | ${lobby.mode.toUpperCase()}</span>
                <span class="host">Host: ${lobby.hostName}</span>
            </div>
            <div class="lobby-meta">
                <span class="player-tag">${lobby.playerCount} / ${lobby.maxPlayers}</span>
                <button class="confirm-btn" style="padding: 10px 20px; margin-left: 20px;" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">
                    ${translations['btn_join']}
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(id, mapId) {
    playSound('click');
    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: id })
        });
    }
}

// Lobby Creation
document.getElementById('btn-submit-create').addEventListener('click', () => {
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    if (selectedLoadouts.length === 0) return; // Validation

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

    playSound('click');
    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

// Slider Value Sync
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
        document.getElementById(`${id}-val`).innerText = el.value;
    });
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    updateLobbyInfo(lobby);
    document.getElementById('chat-messages').innerHTML = '';
}

function updateLobbyInfo(lobby) {
    let loadoutDisplay = 'N/A';
    if (Array.isArray(lobby.loadout)) {
        loadoutDisplay = lobby.loadout.join(', ').toUpperCase();
    } else if (typeof lobby.loadout === 'string') {
        loadoutDisplay = lobby.loadout.toUpperCase();
    }

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-box">
            <span class="label">${translations['map_select']}</span>
            <span class="val">${lobby.mapLabel}</span>
        </div>
        <div class="info-box">
            <span class="label">${translations['mode_select']}</span>
            <span class="val">${lobby.mode.toUpperCase()}</span>
        </div>
        <div class="info-box">
            <span class="label">${translations['loadout_select']}</span>
            <span class="val">${loadoutDisplay}</span>
        </div>
    `;
}

function renderPlayers(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <div class="p-info">
                <span class="name">${p.name.toUpperCase()}</span>
                <span class="team" style="font-size: 10px; color: var(--text-muted)">${p.team.toUpperCase()}</span>
            </div>
            <div class="p-actions">
                ${isHost && p.id != myPlayerId ? `<button onclick="kickPlayer(${p.id})"><i class="fa-solid fa-user-slash"></i></button>` : ''}
            </div>
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

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="name">${name}:</span><span class="text">${message}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// Gameplay HUD logic
function toggleHUDMode(mode) {
    if (mode === 'ffa') {
        document.querySelectorAll('.ffa-only').forEach(e => e.style.display = 'flex');
        document.querySelectorAll('.tdm-only').forEach(e => e.style.display = 'none');
    } else {
        document.querySelectorAll('.ffa-only').forEach(e => e.style.display = 'none');
        document.querySelectorAll('.tdm-only').forEach(e => e.style.display = 'flex');
    }
}

function updateHUDStats(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-fill').style.width = `${data.health}%`;
    document.getElementById('hud-armor-fill').style.width = `${data.armor}%`;
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    if (seconds > 0) {
        el.style.display = 'block';
        document.getElementById('countdown-number').innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + translations['wins_suffix'];

    const table = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>${translations['kills']}</th><th>${translations['deaths']}</th><th>${translations['kd_ratio']}</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    table.innerHTML = html;

    // Map Voting
    const voting = document.getElementById('vote-options');
    voting.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = map.label;
        btn.onclick = () => {
            document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('voted'));
            btn.classList.add('voted');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voting.appendChild(btn);
    });
}

// Global Event Listeners
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
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
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
