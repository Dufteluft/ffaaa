let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Localization Engine
function updateLocalization() {
    if (!serverConfig || !serverConfig.Locales || !serverConfig.Locale) return;
    const locale = serverConfig.Locales[serverConfig.Locale];
    if (!locale) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locale[key]) {
            el.innerText = locale[key];
        }
    });
}

// Audio
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

// Tab Management
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

// Slider Setup
function setupSlider(id) {
    const slider = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (slider && val) {
        slider.oninput = () => { val.innerText = slider.value; };
    }
}
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            serverConfig = data.config;
            serverMaps = data.maps;
            myPlayerId = data.myId;
            updateInitialData();
            updateLocalization();
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
            showCountdown(data.seconds);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            if (data.isPersistent) {
                document.getElementById('hud-tdm-scores').style.display = 'none';
            }
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
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'syncSettings':
            if (currentLobby && currentLobby.id === data.lobby.id) {
                currentLobby = data.lobby;
                showLobbyArea(currentLobby, isHost);
            }
            break;
    }
});

function updateInitialData() {
    // Map selections
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';

    serverMaps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        mapSelect.innerHTML += opt;
        filterMaps.innerHTML += opt;
    });

    // Loadout selection
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (const key in serverConfig.WeaponLoadouts) {
        loadoutSelect.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
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

    lobbies.forEach(lobby => {
        // Simple filter for "not full"
        if (document.getElementById('filter-players').value === 'not-full' && lobby.playerCount >= lobby.maxPlayers) return;
        if (document.getElementById('filter-maps').value !== 'all' && lobby.mapId !== document.getElementById('filter-maps').value) return;

        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | HOST: ${lobby.hostName}</div>
            </div>
            <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="status-badge">${lobby.status}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                    ${lobby.playerCount >= lobby.maxPlayers ? 'FULL' : 'JOIN'}
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId, mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId, mapId })
    });
}

// Create Lobby
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.getElementById('loadout-select').selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
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
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();

    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="stat-row"><span>MAP</span> <span>${lobby.mapLabel}</span></div>
        <div class="stat-row"><span>MODE</span> <span>${lobby.mode.toUpperCase()}</span></div>
        <div class="stat-row"><span>LIMIT</span> <span>${lobby.killLimit > 0 ? lobby.killLimit + ' KILLS' : 'NONE'}</span></div>
        <div class="stat-row"><span>TIME</span> <span>${lobby.roundTime} MIN</span></div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(H)' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2 && !currentLobby.isPersistent;
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Actions
document.getElementById('btn-ready-toggle').onclick = () => { playSound('click'); fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' }); };
document.getElementById('btn-start-game').onclick = () => { playSound('start'); fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' }); };
document.getElementById('btn-leave-lobby').onclick = () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
};
document.getElementById('btn-close-lobby').onclick = () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
};

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.onclick = () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    };
});

// Chat
function addChatMessage(name, msg) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${msg}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

document.getElementById('chat-input').onkeypress = (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
};

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
    document.getElementById('hud-health-bar').style.width = Math.max(0, data.health) + '%';
    document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo || '0';
}

function showCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';

    const winsSuffix = serverConfig.Locales[serverConfig.Locale]['wins_suffix'] || 'WINS!';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " " + winsSuffix;

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
        voteContainer.appendChild(btn);
    });
}

document.getElementById('btn-back-to-lobby').onclick = () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
};

document.getElementById('btn-back-to-menu').onclick = () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
};

window.onkeyup = (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
};

// Auto Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        (currentTab === 'ffa' || currentTab === 'list')) {
        fetchLobbies();
    }
}, 5000);
