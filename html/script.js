let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let selectedMapVote = null;

// Maps and Config from Server
let serverMaps = [];
let serverConfig = {};

// Audio setup
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

// Localization Engine
function applyLocalization(localeData) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (localeData[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = localeData[key];
            } else {
                el.innerText = localeData[key];
            }
        }
    });
}

// Tab Switching
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
        } else {
            document.getElementById(tab === 'create' ? 'tab-create' : 'tab-browser').classList.add('active');
        }

        currentTab = tab;
        fetchLobbies();
    });
});

// Slider Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => {
            document.getElementById(id + '-val').innerText = el.value;
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
        case 'setMyId':
            myPlayerId = data.id;
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby);
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
            updateHUDVisibility(data.mode, data.isPersistent);
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

    // Populate Creation Form
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }

    // Filters
    const filterMaps = document.getElementById('filter-maps');
    while (filterMaps.options.length > 1) filterMaps.remove(1);
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        filterMaps.appendChild(opt);
    });
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

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';

        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;
        const strokeColor = lobby.status === 'ACTIVE' ? '#00ff88' : '#00d4ff';

        div.innerHTML = `
            <div class="lobby-map-preview">
                <img src="assets/maps/${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | ${lobby.mode.toUpperCase()}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="30" cy="30" r="${radius}"></circle>
                    <circle class="circle-progress" cx="30" cy="30" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')" data-locale="btn_join">JOIN</button>
        `;
        container.appendChild(div);
    });
    // Re-apply localization for newly added buttons
    applyLocalization(serverConfig.Locales[serverConfig.Locale]);
}

function joinLobby(lobbyId, mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId, mapId })
    });
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: Array.from(document.getElementById('loadout-select').selectedOptions).map(o => o.value),
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

function showLobbyArea(lobby) {
    currentLobby = lobby;
    isHost = (myPlayerId == lobby.host);
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-game').style.display = (isHost && !lobby.isPersistent) ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = (isHost && !lobby.isPersistent) ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="summary-item"><span>MAP:</span> <span>${lobby.mapLabel}</span></div>
        <div class="summary-item"><span>MODE:</span> <span>${lobby.mode.toUpperCase()}</span></div>
        <div class="summary-item"><span>TIME:</span> <span>${lobby.roundTime} MIN</span></div>
        <div class="summary-item"><span>KILL LIMIT:</span> <span>${lobby.killLimit || 'OFF'}</span></div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span class="player-team-label">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

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

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-line';
    div.innerHTML = `<span class="chat-name">${name}:</span> <span class="chat-msg">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

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

// HUD Logic
function updateHUDVisibility(mode, isPersistent) {
    document.getElementById('hud-tdm-score').style.display = mode === 'tdm' ? 'flex' : 'none';
    document.getElementById('hud-timer').parentElement.style.display = isPersistent ? 'none' : 'flex';
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

// Winner Screen
function showWinnerScreen(data) {
    const locale = serverConfig.Locales[serverConfig.Locale];
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';

    let displayName = (data.winnerName || "").toUpperCase();
    if (data.winnerName !== locale['draw']) {
        displayName += " " + (locale['wins_suffix'] || "").toUpperCase();
    }
    document.getElementById('winner-name').innerText = displayName;

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const voteContainer = document.getElementById('vote-maps-container');
    voteContainer.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.onclick = () => {
            playSound('click');
            selectedMapVote = map.id;
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        div.innerHTML = `
            <img src="assets/maps/${map.id}.png" onerror="this.src='https://via.placeholder.com/140x80/0f1419/ffffff?text=${map.label}'">
            <div class="map-name">${map.label.toUpperCase()}</div>
        `;
        voteContainer.appendChild(div);
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
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
