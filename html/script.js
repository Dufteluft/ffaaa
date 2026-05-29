let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';

// Maps and Config from Server
let serverMaps = [];
let serverConfig = {};
let mapVotes = {};

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

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = btn.dataset.tab;

        // Toggle Views
        if (currentTab === 'create') {
            document.getElementById('lobby-list-view').style.display = 'none';
            document.getElementById('create-lobby-view').style.display = 'block';
        } else {
            document.getElementById('lobby-list-view').style.display = 'block';
            document.getElementById('create-lobby-view').style.display = 'none';
            fetchLobbies();
        }
    });
});

// Slider Sync
const setupSlider = (id) => {
    const slider = document.getElementById(id + '-input');
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
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
            document.getElementById('app').style.display = 'flex';
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'lobbyUpdated':
            showLobbyArea(data.lobby, isHost);
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
            if (data.isPersistent) {
                document.getElementById('hud-timer').innerText = "∞";
            }
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health').style.width = data.health + '%';
            document.getElementById('hud-armor').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'countdown':
            // Optional: Implement visual countdown overlay
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function applyLocalization() {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (serverConfig.Locales[serverConfig.Locale][key]) {
            el.innerText = serverConfig.Locales[serverConfig.Locale][key].toUpperCase();
        }
    });
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization();

    const mapSelect = document.getElementById('map-select-input');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        if (key === 'all') continue;
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}">
            <span>${key.toUpperCase()}</span>
        `;
        loadoutGrid.appendChild(label);
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

    const filterFree = document.getElementById('filter-free-slots').checked;

    lobbies.forEach((lobby, index) => {
        if (filterFree && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;

        let status = lobby.status || 'waiting';
        let strokeColor = '#00ff88';
        if (status === 'ACTIVE') strokeColor = '#ff9500';

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        const mapImg = `https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}
                </div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="30" cy="30" r="${radius}"></circle>
                    <circle class="circle-progress" cx="30" cy="30" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${playerCount}/${maxPlayers}</div>
            </div>
            <div class="status-badge status-${status.toLowerCase()}">${status}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">JOIN</button>
            </div>
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

let isEditing = false;
document.getElementById('btn-create-lobby-final').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);

    const settings = {
        name: document.getElementById('lobby-name-input').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select-input').value,
        mode: document.getElementById('mode-select-input').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'pistol',
        roundTime: parseInt(document.getElementById('round-time-input').value),
        maxPlayers: parseInt(document.getElementById('max-players-input').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed-input').checked,
        friendlyFire: document.getElementById('friendly-fire-input').checked,
        respawnTime: parseInt(document.getElementById('respawn-time-input').value),
        killLimit: parseInt(document.getElementById('kill-limit-input').value)
    };

    if (isEditing) {
        fetch(`https://${GetParentResourceName()}/updateSettings`, {
            method: 'POST',
            body: JSON.stringify(settings)
        });
        document.getElementById('create-lobby-view').style.display = 'none';
        document.getElementById('lobby-waiting-area').style.display = 'flex';
        isEditing = false;
    } else {
        fetch(`https://${GetParentResourceName()}/createLobby`, {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.querySelector('[data-tab="ffa"]').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime > 0 ? lobby.roundTime + ' MIN' : '∞'}</p>
        <p>LOADOUT: ${Array.isArray(lobby.loadout) ? lobby.loadout.join(', ').toUpperCase() : lobby.loadout.toUpperCase()}</p>
    `;
}

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    playSound('click');
    isEditing = true;

    // Fill Form
    document.getElementById('lobby-name-input').value = currentLobby.name;
    document.getElementById('map-select-input').value = currentLobby.mapId;
    document.getElementById('mode-select-input').value = currentLobby.mode;
    document.getElementById('round-time-input').value = currentLobby.roundTime;
    document.getElementById('max-players-input').value = currentLobby.maxPlayers;
    document.getElementById('vehicles-allowed-input').checked = currentLobby.vehiclesAllowed;
    document.getElementById('friendly-fire-input').checked = currentLobby.friendlyFire;
    document.getElementById('respawn-time-input').value = currentLobby.respawnTime;
    document.getElementById('kill-limit-input').value = currentLobby.killLimit;

    // Update Slider Spans
    ['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(id => {
        document.getElementById(id + '-val').innerText = document.getElementById(id + '-input').value;
    });

    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.getElementById('create-lobby-view').style.display = 'block';
});

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'block';
        if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " WINS!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th data-locale="col_name">NAME</th><th data-locale="kills">KILLS</th><th data-locale="deaths">DEATHS</th><th data-locale="kd_ratio">K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;
    applyLocalization();

    // Map Voting
    const voteGrid = document.getElementById('map-votes');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.id = `vote-${map.id}`;
        div.onclick = () => voteMap(map.id);
        div.innerHTML = `
            <span class="vote-label">${map.label.toUpperCase()}</span>
            <span class="vote-count" id="count-${map.id}">0</span>
        `;
        voteGrid.appendChild(div);
    });
}

function voteMap(mapId) {
    playSound('click');
    document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`vote-${mapId}`).classList.add('active');

    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('filter-free-slots').addEventListener('change', fetchLobbies);

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
