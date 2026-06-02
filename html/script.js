let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let mapVotes = {};

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
function applyLocalization() {
    if (!serverConfig.Locales || !serverConfig.Locale) return;
    const lang = serverConfig.Locales[serverConfig.Locale];
    if (!lang) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (lang[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = lang[key];
            } else {
                el.innerText = lang[key];
            }
        }
    });
}

// Tab Management
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = tab;

        // UI State Visibility
        document.getElementById('sidebar-filters').style.display = (tab === 'ffa' || tab === 'list') ? 'flex' : 'none';
        document.getElementById('lobby-list-container').style.display = (tab === 'ffa' || tab === 'list') ? 'flex' : 'none';
        document.getElementById('create-lobby-form').style.display = (tab === 'create') ? 'block' : 'none';

        if (tab !== 'create') fetchLobbies();
    });
});

// Sidebar Buttons
document.getElementById('sidebar-btn-create').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="create"]').click();
});

// Range Sliders Value Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    el.addEventListener('input', () => {
        val.innerText = el.value == 0 ? '∞' : el.value;
    });
});

// NUI Communication
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            serverConfig = data.config;
            serverMaps = data.maps;
            setupInitialData();
            applyLocalization();
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

        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;

        case 'countdown':
            handleCountdown(data.seconds);
            break;

        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-timer').innerText = data.isPersistent ? '∞' : '00:00';
            break;

        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;

        case 'updateHUD':
            updateHUD(data);
            break;

        case 'updateHUDDetails':
            document.getElementById('hud-health').style.width = `${data.health}%`;
            document.getElementById('hud-armor').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;

        case 'showWinner':
            showWinnerScreen(data);
            break;

        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData() {
    // Populate Map Dropdowns
    const selects = [document.getElementById('map-select'), document.getElementById('filter-maps')];
    selects.forEach(s => {
        s.innerHTML = s.id === 'filter-maps' ? '<option value="all">ALL MAPS</option>' : '';
        serverMaps.forEach(map => {
            const opt = document.createElement('option');
            opt.value = map.id;
            opt.innerText = map.label.toUpperCase();
            s.appendChild(opt);
        });
    });

    // Populate Loadouts
    const loadout = document.getElementById('loadout-select');
    loadout.innerHTML = '';
    for (const key in serverConfig.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadout.appendChild(opt);
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
    const freeOnly = document.getElementById('filter-free-slots').checked;
    const mapFilter = document.getElementById('filter-maps').value;

    container.innerHTML = '';

    lobbies.forEach((lobby, index) => {
        if (freeOnly && lobby.playerCount >= lobby.maxPlayers) return;
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="assets/maps/${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/120x70/1a1f2e/ffffff?text=${lobby.mapLabel}'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="25" cy="25" r="${radius}"></circle>
                    <circle class="circle-progress" cx="25" cy="25" r="${radius}"
                        style="stroke: var(--primary); stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')" data-locale="btn_join">JOIN</button>
        `;
        container.appendChild(item);
    });
    applyLocalization();
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
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
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

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-item"><span>MAP:</span> ${lobby.mapLabel}</div>
        <div class="info-item"><span>MODE:</span> ${lobby.mode.toUpperCase()}</div>
        <div class="info-item"><span>TIME:</span> ${lobby.roundTime === 0 ? '∞' : lobby.roundTime + ' MIN'}</div>
        <div class="info-item"><span>VEHICLES:</span> ${lobby.vehiclesAllowed ? 'YES' : 'NO'}</div>
        <div class="info-item"><span>FF:</span> ${lobby.friendlyFire ? 'ON' : 'OFF'}</div>
        <div class="info-item"><span>LIMIT:</span> ${lobby.killLimit === 0 ? 'OFF' : lobby.killLimit}</div>
    `;

    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="badge team-${p.team}">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (isHost) {
        const nonReady = players.filter(p => !p.ready).length;
        document.getElementById('btn-start-game').disabled = (nonReady > 0 || players.length < 2) && !currentLobby.isPersistent;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-author">${name}:</span> <span class="chat-text">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    const num = el.querySelector('.countdown-number');

    if (seconds > 0) {
        el.style.display = 'flex';
        num.innerText = seconds;
        playSound('click');
    } else {
        el.style.display = 'none';
        playSound('start');
    }
}

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

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const table = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    table.innerHTML = html;

    // Render Map Voting
    const voteList = document.getElementById('map-vote-list');
    voteList.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `
            <div class="vote-label">${map.label}</div>
            <div class="vote-count" id="vote-${map.id}">0</div>
        `;
        div.onclick = () => voteMap(map.id);
        voteList.appendChild(div);
    });
}

function voteMap(mapId) {
    playSound('click');
    document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const countEl = document.getElementById(`vote-${mapId}`);
    countEl.innerText = parseInt(countEl.innerText) + 1;

    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

// Global UI Listeners
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
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg.trim().length > 0) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
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
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="ffa"]').click();
});

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    playSound('click');
    document.querySelector('.tab-btn[data-tab="create"]').click();
    // Fill form with current lobby settings
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
    document.getElementById('loadout-select').value = currentLobby.loadout;
    document.getElementById('round-time').value = currentLobby.roundTime;
    document.getElementById('max-players').value = currentLobby.maxPlayers;
    document.getElementById('vehicles-allowed').checked = currentLobby.vehiclesAllowed;
    document.getElementById('friendly-fire').checked = currentLobby.friendlyFire;
    document.getElementById('respawn-time').value = currentLobby.respawnTime;
    document.getElementById('kill-limit').value = currentLobby.killLimit;

    // Trigger input events to update labels
    sliders.forEach(id => document.getElementById(id).dispatchEvent(new Event('input')));
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && (currentTab === 'ffa' || currentTab === 'list')) {
        fetchLobbies();
    }
}, 5000);
