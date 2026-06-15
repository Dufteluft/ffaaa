let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let currentStats = { kills: 0, deaths: 0 };

// Maps and Config from Server
let serverMaps = [];
let serverConfig = {};

// Audio Assets
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

// Localization Helper
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) el.innerText = locales[key];
    });
    document.querySelectorAll('[data-locale-placeholder]').forEach(el => {
        const key = el.getAttribute('data-locale-placeholder');
        if (locales[key]) el.setAttribute('placeholder', locales[key]);
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
            document.getElementById('tab-browser').classList.add('active');
            currentTab = tab;
            fetchLobbies();
        } else if (tab === 'create') {
            document.getElementById('tab-create').classList.add('active');
            currentTab = tab;
        }
    });
});

// Slider Value Sync
const setupSlider = (id) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            myPlayerId = data.myId;
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            fetchLobbies();
            fetchStats();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby, data.lobby.host == myPlayerId);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'syncSettings':
            updateLobbySummary(data.settings);
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'showHUD':
            toggleHUD(true, data.isPersistent);
            break;
        case 'hideHUD':
            toggleHUD(false);
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data.health, data.armor, data.ammo);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'receiveStats':
            updateGlobalStats(data.stats);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization(config.Locales[config.Locale]);

    // Populate Selects
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = `<option value="all">ALL MAPS</option>`;

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        mapSelect.innerHTML += opt;
        filterMaps.innerHTML += opt;
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    const locale = config.Locales[config.Locale];
    for (let key in config.WeaponLoadouts) {
        const label = locale[key] || key.toUpperCase();
        loadoutSelect.innerHTML += `<option value="${key}">${label}</option>`;
    }
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function fetchStats() {
    fetch(`https://${GetParentResourceName()}/getStats`, { method: 'POST' });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const mapFilter = document.getElementById('filter-maps').value;
    const freeSlotsFilter = document.getElementById('filter-free-slots').checked;

    lobbies.forEach(lobby => {
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;
        if (freeSlotsFilter && lobby.playerCount >= lobby.maxPlayers) return;

        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
            </div>
            <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <div class="action-area">
                ${renderActionButton(lobby)}
            </div>
        `;
        container.appendChild(div);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) return `<button class="action-btn btn-disabled" disabled>FULL</button>`;
    if (lobby.status === 'ACTIVE') return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}', true)">SPECTATE</button>`;

    const clickAction = lobby.isPersistent ? `quickJoin('${lobby.mapId}')` : `joinLobby('${lobby.id}')`;
    return `<button class="action-btn btn-join" onclick="${clickAction}">JOIN</button>`;
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, { method: 'POST', body: JSON.stringify({ lobbyId }) });
}

function quickJoin(mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/quickJoin`, { method: 'POST', body: JSON.stringify({ mapId }) });
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'all',
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, { method: 'POST', body: JSON.stringify(settings) });
});

function showLobbyArea(lobby, isHostUser) {
    currentLobby = lobby;
    isHost = isHostUser;
    playSound('join');

    document.getElementById('tab-create').classList.remove('active');
    document.getElementById('tab-browser').classList.remove('active');
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();

    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = isHost ? 'block' : 'none';

    updateLobbySummary(lobby);
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
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function updateLobbySummary(s) {
    const summary = document.getElementById('lobby-info-summary');
    summary.innerHTML = `
        <div class="summary-item"><span>MAP:</span> <span>${s.mapLabel}</span></div>
        <div class="summary-item"><span>MODE:</span> <span>${s.mode.toUpperCase()}</span></div>
        <div class="summary-item"><span>TIME:</span> <span>${s.roundTime} MIN</span></div>
        <div class="summary-item"><span>VEHICLES:</span> <span>${s.vehiclesAllowed ? 'YES' : 'NO'}</span></div>
    `;
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.innerHTML = `<span style="color: var(--primary); font-weight: 900;">${name.toUpperCase()}:</span> ${message}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

function toggleHUD(show, isPersistent = false) {
    document.getElementById('game-hud').style.display = show ? 'block' : 'none';
    document.getElementById('hud-timer').style.display = isPersistent ? 'none' : 'block';
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        const tdm = document.getElementById('hud-tdm-score');
        tdm.style.display = 'flex';
        tdm.querySelector('.score-blue').innerText = data.scoreBlue || 0;
        tdm.querySelector('.score-red').innerText = data.scoreRed || 0;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDDetails(health, armor, ammo) {
    document.getElementById('hud-health').style.width = `${health}%`;
    document.getElementById('hud-armor').style.width = `${armor}%`;
    document.getElementById('hud-ammo').innerText = ammo || '0 / 0';
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Render Map Voting
    const voteContainer = document.getElementById('map-voting-container');
    voteContainer.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = map.label.toUpperCase();
        btn.onclick = () => {
            document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: map.id }) });
        };
        voteContainer.appendChild(btn);
    });
}

function updateGlobalStats(stats) {
    document.getElementById('stat-kills').innerText = stats.kills;
    document.getElementById('stat-deaths').innerText = stats.deaths;
    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
    document.getElementById('stat-kd').innerText = kd;
}

// Global Event Listeners
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

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, { method: 'POST', body: JSON.stringify({ team: btn.dataset.team }) });
    });
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim().length > 0) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, { method: 'POST', body: JSON.stringify({ message: e.target.value }) });
        e.target.value = '';
    }
});

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

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, { method: 'POST', body: JSON.stringify({ id }) });
}

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
