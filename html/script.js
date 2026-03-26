let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let currentLocales = {};

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

// Localization
function setLocales(locales) {
    currentLocales = locales;
    for (const [key, value] of Object.entries(locales)) {
        // ID-based localization
        const elId = document.getElementById('l-' + key);
        if (elId) elId.innerText = value.toUpperCase();

        // Class-based localization
        document.querySelectorAll('.l-' + key).forEach(el => {
            el.innerText = value.toUpperCase();
        });
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

        // Reset views
        document.getElementById('tab-browser').style.display = (tab === 'ffa' || tab === 'list') ? 'flex' : 'none';
        document.getElementById('tab-create').style.display = (tab === 'create') ? 'flex' : 'none';
        document.getElementById('lobby-waiting-area').style.display = 'none';

        if (tab === 'ffa' || tab === 'list') {
            fetchLobbies();
        }
    });
});

// Slider Value Sync
const setupSlider = (id, targetId) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(targetId);
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
setupSlider('create-round-time', 'round-time-val');
setupSlider('create-max-players', 'max-players-val');
setupSlider('create-respawn-time', 'respawn-time-val');
setupSlider('create-kill-limit', 'kill-limit-val');

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
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-scores').style.display = data.isPersistent ? 'none' : (currentLobby?.mode === 'tdm' ? 'flex' : 'none');
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
            showCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    setLocales(config.Locales[config.Locale]);

    // Setup Map Dropdowns
    const filterMaps = document.getElementById('filter-maps');
    const createMaps = document.getElementById('create-map-select');
    filterMaps.innerHTML = `<option value="all">ALL MAPS</option>`;
    createMaps.innerHTML = '';

    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        filterMaps.innerHTML += opt;
        createMaps.innerHTML += opt;
    });

    // Setup Loadout Checkboxes
    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (const [key, loadout] of Object.entries(config.WeaponLoadouts)) {
        const item = document.createElement('label');
        item.className = 'loadout-item';
        item.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}">
            <span>${loadout.label.toUpperCase()}</span>
        `;
        loadoutGrid.appendChild(item);
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

    if (lobbies.length === 0) {
        container.innerHTML = `<div class="no-lobbies">${currentLocales.no_lobbies || 'NO LOBBIES FOUND'}</div>`;
        return;
    }

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
            </div>
            <div class="player-count-badge">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="action-btn ${lobby.playerCount >= lobby.maxPlayers ? 'btn-disabled' : 'btn-join'}"
                onclick="joinLobby('${lobby.id}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                ${lobby.playerCount >= lobby.maxPlayers ? 'FULL' : (currentLocales.btn_join || 'JOIN')}
            </button>
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

// Lobby Creation Submission
document.getElementById('btn-create-lobby-submit').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(el => el.value);

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
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

document.getElementById('btn-create-cancel').addEventListener('click', () => {
    playSound('click');
    document.querySelectorAll('.tab-btn')[0].click(); // Back to FFA
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    // Hide other tabs
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('lobby-title-display').innerText = lobby.name.toUpperCase();
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    updateLobbyInfoSummary(lobby);
}

function updateLobbyInfoSummary(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="summary-grid">
            <p><span>MAP:</span> ${lobby.mapLabel}</p>
            <p><span>MODE:</span> ${lobby.mode.toUpperCase()}</p>
            <p><span>TIME:</span> ${lobby.roundTime} MIN</p>
            <p><span>KILL LIMIT:</span> ${lobby.killLimit > 0 ? lobby.killLimit : 'OFF'}</p>
        </div>
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
            <div class="player-meta">
                <span>${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="icon-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

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
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.querySelectorAll('.tab-btn')[0].click();
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
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

// Chat Logic
const chatInput = document.getElementById('chat-input');
const sendChat = () => {
    const msg = chatInput.value.trim();
    if (msg.length > 0) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: msg })
        });
        chatInput.value = '';
    }
};

document.getElementById('btn-send-chat').addEventListener('click', sendChat);
chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<strong>${name.toUpperCase()}:</strong> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-time').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('bar-health').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('bar-armor').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo-clip').innerText = data.ammo;
    if (data.ammoTotal !== undefined) document.getElementById('hud-ammo-total').innerText = '/ ' + data.ammoTotal;
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

// Winner Screen & Voting
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName.toUpperCase() + ' ' + (currentLocales.winner_suffix || 'GEWINNT!');

    // Render Stats Table
    const statsContainer = document.getElementById('match-stats-container');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsContainer.innerHTML = html;

    // Render Map Voting
    renderMapVoting();
}

function renderMapVoting() {
    const grid = document.getElementById('map-voting-grid');
    grid.innerHTML = '';
    // Select 3 random maps for voting
    const shuffled = [...serverMaps].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 3);

    selected.forEach(map => {
        const item = document.createElement('div');
        item.className = 'vote-item';
        item.innerHTML = `
            <span>${map.label.toUpperCase()}</span>
            <div class="vote-count" id="vote-count-${map.id}">0</div>
        `;
        item.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('voted'));
            item.classList.add('voted');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        grid.appendChild(item);
    });
}

document.getElementById('btn-winner-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// ESC to Close
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape' && document.getElementById('app').style.display === 'flex') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && (currentTab === 'ffa' || currentTab === 'list')) {
        fetchLobbies();
    }
}, 5000);
