let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let lobbiesCache = [];

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
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        if (tab === 'ffa' || tab === 'list') {
            document.getElementById('tab-list-view').classList.add('active');
            currentTab = tab;
            fetchLobbies();
        } else if (tab === 'create') {
            document.getElementById('tab-create-view').classList.add('active');
            currentTab = tab;
        }
    });
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
            lobbiesCache = data.lobbies;
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
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
            break;
        case 'showHUD':
            document.getElementById('hud').style.display = 'block';
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
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    applyLocalization(config.Locales[config.Locale]);

    // Setup Map Dropdown
    const createMapSelect = document.getElementById('create-map-select');
    const filterMapSelect = document.getElementById('filter-maps');
    createMapSelect.innerHTML = '';
    filterMapSelect.innerHTML = `<option value="all" data-locale="filter_all_maps">${config.Locales[config.Locale].filter_all_maps}</option>`;

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        createMapSelect.appendChild(opt);

        const filterOpt = document.createElement('option');
        filterOpt.value = map.id;
        filterOpt.innerText = map.label;
        filterMapSelect.appendChild(filterOpt);
    });

    // Setup Loadout Multi-Select
    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const item = document.createElement('div');
        item.className = 'loadout-checkbox-item';
        item.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}" id="ld-${key}">
            <label for="ld-${key}">${config.WeaponLoadouts[key].label}</label>
        `;
        loadoutGrid.appendChild(item);
    }
}

// Slider Value Sync
function setupSliderSync(inputId, valId) {
    const input = document.getElementById(inputId);
    const val = document.getElementById(valId);
    input.addEventListener('input', () => { val.innerText = input.value; });
}
setupSliderSync('input-round-time', 'val-round-time');
setupSliderSync('input-max-players', 'val-max-players');
setupSliderSync('input-respawn-time', 'val-respawn-time');
setupSliderSync('input-kill-limit', 'val-kill-limit');

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

        const item = document.createElement('div');
        item.className = 'lobby-item';

        const mapImg = lobby.image || `assets/map_${lobby.mapId}.png`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}" onerror="this.src='https://via.placeholder.com/120x70?text=MAP'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} | ${lobby.hostName}</div>
                <div class="map-name-row">${lobby.mapLabel}</div>
                <div class="status-badge">${lobby.status}</div>
            </div>
            <div class="player-count">
                ${lobby.playerCount}/${lobby.maxPlayers} <i class="fa-solid fa-users"></i>
            </div>
            <div class="action-area">
                ${renderActionButton(lobby)}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled data-locale="btn_full">${serverConfig.Locales[serverConfig.Locale].btn_full}</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}')" data-locale="btn_spectate">${serverConfig.Locales[serverConfig.Locale].btn_spectate}</button>`;
    }
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')" data-locale="btn_join">${serverConfig.Locales[serverConfig.Locale].btn_join}</button>`;
}

function joinLobby(lobbyId) {
    playSound('click');
    const lobby = lobbiesCache.find(l => l.id === lobbyId);
    if (lobby && lobby.isPersistent) {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: lobby.mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId })
        });
    }
}

// Create Lobby Submission
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('input[name="loadout"]:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
        roundTime: parseInt(document.getElementById('input-round-time').value),
        maxPlayers: parseInt(document.getElementById('input-max-players').value),
        respawnTime: parseInt(document.getElementById('input-respawn-time').value),
        killLimit: parseInt(document.getElementById('input-kill-limit').value),
        vehiclesAllowed: document.getElementById('input-vehicles').checked,
        friendlyFire: document.getElementById('input-friendly-fire').checked
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

    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-display-name').innerText = lobby.name.toUpperCase();
    document.getElementById('btn-start').style.display = asHost ? 'block' : 'none';

    const summary = document.getElementById('lobby-settings-summary');
    summary.innerHTML = `
        <span>MAP: ${lobby.mapLabel}</span>
        <span>MODE: ${lobby.mode.toUpperCase()}</span>
        <span>TIME: ${lobby.roundTime}m</span>
        <span>LIMIT: ${lobby.killLimit}</span>
        <span>VEHICLES: ${lobby.vehiclesAllowed ? 'ON' : 'OFF'}</span>
        <span>FF: ${lobby.friendlyFire ? 'ON' : 'OFF'}</span>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-x"></i></button>` : ''}
        `;
        list.appendChild(item);
    });
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Team Selection
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
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value.trim();
        if (msg) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

function addChatMessage(name, msg) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${msg}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// Actions
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
    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-fill').style.width = `${data.health}%`;
    document.getElementById('hud-armor-fill').style.width = `${data.armor}%`;
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    if (seconds > 0) {
        el.style.display = 'block';
        el.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerText = data.winnerName;

    const statsCont = document.getElementById('match-stats-container');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsCont.innerHTML = html;

    // Map Voting
    const voteGrid = document.getElementById('map-vote-grid');
    voteGrid.innerHTML = '';
    // Take first 3 maps for voting
    serverConfig.Maps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'map-vote-item';
        div.innerHTML = `<img src="${map.image}" style="width:100%; height:60px; object-fit:cover;"><p>${map.label}</p>`;
        div.onclick = () => {
            document.querySelectorAll('.map-vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteGrid.appendChild(div);
    });
}

document.getElementById('btn-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

// Close UI on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('main-menu').style.display !== 'none') {
        fetchLobbies();
    }
}, 5000);
