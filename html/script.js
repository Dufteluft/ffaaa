let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

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

// Tab-Steuerung
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        currentTab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Ansichten umschalten
        if (currentTab === 'create') {
            document.getElementById('lobby-list-container').style.display = 'none';
            document.getElementById('ffa-lobby-view').style.display = 'none';
            document.getElementById('create-lobby-view').style.display = 'block';
            document.getElementById('sidebar-filters').style.visibility = 'hidden';
        } else if (currentTab === 'ffa') {
            document.getElementById('lobby-list-container').style.display = 'none';
            document.getElementById('ffa-lobby-view').style.display = 'flex';
            document.getElementById('create-lobby-view').style.display = 'none';
            document.getElementById('sidebar-filters').style.visibility = 'hidden';
            fetchLobbies();
        } else {
            document.getElementById('lobby-list-container').style.display = 'flex';
            document.getElementById('ffa-lobby-view').style.display = 'none';
            document.getElementById('create-lobby-view').style.display = 'none';
            document.getElementById('sidebar-filters').style.visibility = 'visible';
            fetchLobbies();
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
            document.getElementById('create-lobby-view').style.display = 'none';
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
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Map Select
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);

        const filterOpt = document.createElement('option');
        filterOpt.value = map.id;
        filterOpt.innerText = map.label.toUpperCase();
        filterMaps.appendChild(filterOpt);
    });

    // Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    const container = (currentTab === 'ffa') ? document.getElementById('ffa-lobby-view') : document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        let strokeColor = '#00ff88';
        if (percent > 80) strokeColor = '#ff9500';
        if (lobby.status === 'ACTIVE') strokeColor = '#00d4ff';

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name.toUpperCase()}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} |
                    <i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()} |
                    <i class="fa-solid fa-user-tie"></i> HOST: ${lobby.hostName}
                </div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="25" cy="25" r="${radius}"></circle>
                    <circle class="circle-progress" cx="25" cy="25" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <div class="action-area">
                <button class="action-btn" onclick="joinLobby('${lobby.id}')">${lobby.status === 'ACTIVE' ? 'ZUSCHAUEN' : 'BEITRETEN'}</button>
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

// Lobby erstellen Button
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA MATCH',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: document.getElementById('loadout-select').value,
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked
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

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-item"><span>MAP:</span> ${lobby.mapLabel}</div>
        <div class="info-item"><span>MODUS:</span> ${lobby.mode.toUpperCase()}</div>
        <div class="info-item"><span>ZEIT:</span> ${lobby.roundTime} MIN</div>
        <div class="info-item"><span>LIMIT:</span> ${lobby.killLimit > 0 ? lobby.killLimit : 'AUS'}</div>
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
            <span style="font-size: 10px; opacity: 0.6;">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-time').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-scores').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-scores').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-bar').style.width = data.health + '%';
    document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function handleCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    const num = document.getElementById('countdown-number');
    if (seconds > 0) {
        el.style.display = 'block';
        num.innerText = seconds;
    } else {
        el.style.display = 'none';
        playSound('start');
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const tbody = document.getElementById('stats-body');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(row);
    });
}

// Event Listeners for Lobby Actions
document.getElementById('btn-ready-toggle').addEventListener('click', () => { playSound('click'); fetch(`https://${GetParentResourceName()}/toggleReady`, {method:'POST'}); });
document.getElementById('btn-start-game').addEventListener('click', () => { fetch(`https://${GetParentResourceName()}/startGame`, {method:'POST'}); });
document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, {method:'POST'});
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

// Chat handling
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

// Slider values sync
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(id => {
    const slider = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    slider.addEventListener('input', () => { val.innerText = slider.value; });
});

// Close UI on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, {method:'POST'});
});

// Auto refresh lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
