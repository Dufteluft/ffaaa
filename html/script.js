let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let L = {}; // Localized strings

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

// Localization Helper
function _L(key, ...args) {
    let str = L[key] || key;
    args.forEach((val, i) => {
        str = str.replace('%s', val);
    });
    return str;
}

// Tab Navigation
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

    // UI Visibility logic
    const sidebar = document.getElementById('sidebar');
    const browser = document.getElementById('lobby-browser');
    const createTab = document.getElementById('create-lobby-tab');

    if (tab === 'create') {
        sidebar.classList.add('hidden');
        browser.classList.remove('active');
        createTab.classList.add('active');
    } else {
        sidebar.classList.remove('hidden');
        browser.classList.add('active');
        createTab.classList.remove('active');
        fetchLobbies();
    }
}

// Slider Value Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (el && val) {
        el.addEventListener('input', () => val.innerText = el.value);
    }
});

// Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;
    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            if (data.isInGame) {
                document.querySelector('.main-container').style.display = 'none';
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
            showLobbyWaitingArea(data.lobby, data.action === 'lobbyCreated');
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
            document.getElementById('hud-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('health-bar').style.width = data.health + '%';
            document.getElementById('armor-bar').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'countdown':
            const cd = document.getElementById('countdown-display');
            if (data.seconds > 0) {
                cd.style.display = 'flex';
                document.getElementById('countdown-number').innerText = data.seconds;
            } else {
                cd.style.display = 'none';
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'updateVotes':
            for (let mapId in data.votes) {
                const el = document.getElementById(`vote-${mapId}`);
                if (el) el.innerText = data.votes[mapId];
            }
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    L = config.Locales[config.Locale];

    // Localize UI
    for (let key in L) {
        const el = document.getElementById('l-' + key);
        if (el) el.innerText = L[key].toUpperCase();
        // Also check for clones (like map_select_2)
        const el2 = document.getElementById('l-' + key + '_2');
        if (el2) el2.innerText = L[key].toUpperCase();
    }

    // Populate Maps
    const mapSelect = document.getElementById('map-select');
    const editMapSelect = document.getElementById('edit-map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    editMapSelect.innerHTML = '';
    filterMaps.innerHTML = `<option value="all">${L['map_select'] || 'ALL MAPS'}</option>`;

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
        editMapSelect.appendChild(opt.cloneNode(true));
        filterMaps.appendChild(opt.cloneNode(true));
    });

    // Populate Loadouts (Checkboxes)
    const container = document.getElementById('loadout-checkboxes');
    container.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('label');
        div.className = 'checkbox-item';
        div.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}" ${key === 'all' ? 'checked' : ''}>
            <span>${key.toUpperCase()}</span>
        `;
        container.appendChild(div);
    }

    fetchLobbies();
}

let lastFetchedLobbies = [];

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    lastFetchedLobbies = lobbies;
    applyFilters();
}

function applyFilters() {
    const mapFilter = document.getElementById('filter-maps').value;
    const playerFilter = document.getElementById('filter-players').checked;

    const filtered = lastFetchedLobbies.filter(l => {
        if (mapFilter !== 'all' && l.mapId !== mapFilter) return false;
        if (playerFilter && l.playerCount >= l.maxPlayers) return false;
        return true;
    });

    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    filtered.forEach((lobby, i) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${i * 0.05}s`;

        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        let color = '#00ff88';
        if (percent > 80) color = '#ff9500';

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="https://via.placeholder.com/160x90/0f1419/ffffff?text=${lobby.mapLabel}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL'}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel.toUpperCase()}</div>
                <div class="host-name">HOST: ${lobby.hostName.toUpperCase()}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="30" cy="30" r="25"></circle>
                    <circle class="circle-progress" cx="30" cy="30" r="25" style="stroke: ${color}; stroke-dasharray: 157; stroke-dashoffset: ${157 - (percent/100)*157};"></circle>
                </svg>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="action-btn ${lobby.status === 'ACTIVE' ? 'btn-spectate' : 'btn-join'}" onclick="joinLobby('${lobby.id}')">
                ${lobby.status === 'ACTIVE' ? 'SPECTATE' : 'JOIN'}
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

// Create Lobby Action
document.getElementById('btn-create-lobby-action').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(el => el.value);
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-toggle').checked,
        friendlyFire: document.getElementById('ff-toggle').checked
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

// Lobby Waiting Area
function showLobbyWaitingArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title-display').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-id-display').innerText = lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';
    document.getElementById('host-edit-controls').style.display = asHost ? 'block' : 'none';

    const loadoutDisplay = Array.isArray(lobby.loadout) ? lobby.loadout.join(', ').toUpperCase() : lobby.loadout.toUpperCase();
    document.getElementById('lobby-settings-summary').innerHTML = `
        <div class="summary-item"><span>MAP:</span> ${lobby.mapLabel.toUpperCase()}</div>
        <div class="summary-item"><span>MODE:</span> ${lobby.mode.toUpperCase()}</div>
        <div class="summary-item"><span>TIME:</span> ${lobby.roundTime} MIN</div>
        <div class="summary-item"><span>LOADOUT:</span> ${loadoutDisplay}</div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <div class="p-info">
                <span class="p-name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
                <span class="p-team" style="color: ${p.team === 'blue' ? 'var(--blue-team)' : (p.team === 'red' ? 'var(--red-team)' : 'inherit')}">${p.team.toUpperCase()}</span>
            </div>
            <div class="p-actions">
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
                <div class="ready-indicator">${p.ready ? 'READY' : 'NOT READY'}</div>
            </div>
        `;
        list.appendChild(div);
    });
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, { method: 'POST', body: JSON.stringify({ id }) });
}

// Team Selection
document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, { method: 'POST', body: JSON.stringify({ team: btn.dataset.team }) });
    });
});

// Lobby Actions
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

document.getElementById('btn-update-settings').addEventListener('click', () => {
    playSound('click');
    const settings = {
        mapId: document.getElementById('edit-map-select').value,
        mode: document.getElementById('edit-mode-select').value
    };
    fetch(`https://${GetParentResourceName()}/updateSettings`, { method: 'POST', body: JSON.stringify(settings) });
});

// Chat
function addChatMessage(name, msg) {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<b style="color: var(--primary)">${name}:</b> ${msg}`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
}

document.getElementById('btn-send-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (msg) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, { method: 'POST', body: JSON.stringify({ message: msg }) });
        input.value = '';
    }
}

// Winner Screen & Map Voting
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName.toUpperCase();

    const body = document.getElementById('stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        body.appendChild(row);
    });

    // Map Voting
    const grid = document.getElementById('map-voting-grid');
    grid.innerHTML = '';
    serverMaps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `
            <img src="https://via.placeholder.com/160x100/0f1419/ffffff?text=${map.label}" alt="${map.label}">
            <div class="vote-label">${map.label.toUpperCase()}</div>
            <div class="vote-count" id="vote-${map.id}">0</div>
        `;
        div.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: map.id }) });
        };
        grid.appendChild(div);
    });
}

document.getElementById('btn-winner-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-main-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// Filter Event Listeners
document.getElementById('filter-maps').addEventListener('change', applyFilters);
document.getElementById('filter-players').addEventListener('change', applyFilters);

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
});
