let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Localization handling
let locales = {};

// Audio Assets
const audioAssets = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3'),
    countdown: new Audio('assets/countdown.mp3')
};

function playSound(name) {
    if (audioAssets[name]) {
        audioAssets[name].currentTime = 0;
        audioAssets[name].play().catch(() => {});
    }
}

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            myPlayerId = data.myId;
            serverConfig = data.config;
            serverMaps = data.maps;
            locales = serverConfig.Locales[serverConfig.Locale];
            applyLocalization();
            setupCreateForm();
            document.getElementById('app').style.display = 'flex';
            switchTab('ffa');
            break;

        case 'close':
            document.getElementById('app').style.display = 'none';
            break;

        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;

        case 'lobbyCreated':
        case 'lobbyJoined':
            currentLobby = data.lobby;
            isHost = (myPlayerId == currentLobby.host);
            showLobbyWaitingArea();
            break;

        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;

        case 'syncSettings':
            currentLobby = data.lobby;
            updateLobbySummary();
            break;

        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;

        case 'countdown':
            handleCountdown(data.seconds);
            break;

        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;

        case 'showHUD':
            document.getElementById('game-hud').style.display = 'flex';
            document.getElementById('hud-score-tdm').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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

        case 'updateStats':
            updateMainMenuStats(data.stats);
            break;
    }
});

function updateMainMenuStats(stats) {
    document.getElementById('stat-kills').innerText = stats.kills;
    document.getElementById('stat-deaths').innerText = stats.deaths;
    document.getElementById('stat-wins').innerText = stats.wins;
    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
    document.getElementById('stat-kd').innerText = kd;
}

function applyLocalization() {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            el.innerText = locales[key].toUpperCase();
        }
    });
}

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    if (tab === 'create') {
        document.getElementById('browser-view').style.display = 'none';
        document.getElementById('create-view').style.display = 'flex';
    } else {
        document.getElementById('browser-view').style.display = 'block';
        document.getElementById('create-view').style.display = 'none';
        fetchLobbies();
    }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        switchTab(btn.dataset.tab);
    });
});

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
        div.innerHTML = `
            <div class="lobby-item-info">
                <div class="lobby-item-name">${lobby.name}</div>
                <div class="lobby-item-details">
                    <span><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-users"></i> ${lobby.playerCount}/${lobby.maxPlayers}</span>
                    <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                </div>
            </div>
            <button class="btn-join" onclick="joinLobby('${lobby.id}', '${lobby.mapId}', ${lobby.isPersistent})">
                ${locales['btn_join'].toUpperCase()}
            </button>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId, mapId, isPersistent) {
    playSound('click');
    if (isPersistent) {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobbyId })
        });
    }
}

function setupCreateForm() {
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    serverMaps.forEach(map => {
        mapSelect.innerHTML += `<option value="${map.id}">${map.label}</option>`;
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (const [key, value] of Object.entries(serverConfig.WeaponLoadouts)) {
        loadoutSelect.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
    }

    // Slider Listeners
    ['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(id => {
        const slider = document.getElementById(id);
        const val = document.getElementById(id + '-val');
        slider.oninput = () => { val.innerText = slider.value; };
    });
}

// Host saving settings
document.getElementById('btn-save-settings').onclick = () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value,
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
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
};

document.getElementById('btn-create-lobby').onclick = () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA Lobby',
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
};

function showLobbyWaitingArea() {
    playSound('join');
    document.getElementById('lobby-title-display').innerText = currentLobby.name.toUpperCase();
    document.getElementById('lobby-id-display').innerText = currentLobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-match').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = isHost ? 'block' : 'none';
    document.getElementById('host-controls').style.display = isHost ? 'block' : 'none';

    updateLobbySummary();
}

function updateLobbySummary() {
    const summary = document.getElementById('lobby-info-summary');
    summary.innerHTML = `
        <div><strong>MAP:</strong> ${currentLobby.mapLabel}</div>
        <div><strong>MODE:</strong> ${currentLobby.mode.toUpperCase()}</div>
        <div><strong>TIME:</strong> ${currentLobby.roundTime} MIN</div>
        <div><strong>LOADOUT:</strong> ${currentLobby.loadout.toUpperCase()}</div>
        <div><strong>VEHICLES:</strong> ${currentLobby.vehiclesAllowed ? 'ON' : 'OFF'}</div>
        <div><strong>KILLS TO WIN:</strong> ${currentLobby.killLimit}</div>
    `;
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-card ${p.ready ? 'ready' : ''} ${p.team}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 10px; opacity: 0.6;">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer(${p.id})"><i class="fa-solid fa-user-slash"></i></button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

document.getElementById('btn-ready-toggle').onclick = () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
};

document.getElementById('btn-start-match').onclick = () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
};

document.getElementById('btn-leave-match').onclick = () => {
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

// Chat handling
document.getElementById('btn-send-chat').onclick = sendChatMessage;
document.getElementById('lobby-chat-input').onkeypress = (e) => { if (e.key === 'Enter') sendChatMessage(); };

function sendChatMessage() {
    const input = document.getElementById('lobby-chat-input');
    const msg = input.value.trim();
    if (msg) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: msg })
        });
        input.value = '';
    }
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages-container');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color: var(--primary)">${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// Gameplay HUD & Countdown
function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    if (seconds > 0) {
        playSound('countdown');
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kill-count').innerText = data.kills;
    if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('health-fill').style.width = data.health + '%';
    document.getElementById('armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

// Winner Screen
function showWinnerScreen(data) {
    document.getElementById('app').style.display = 'flex';
    playSound('win');
    document.getElementById('winner-name-text').innerText = data.winnerName.toUpperCase();
    const statsBody = document.getElementById('winner-stats-body');
    statsBody.innerHTML = '';
    data.stats.forEach(s => {
        statsBody.innerHTML += `
            <tr>
                <td>${s.name}</td>
                <td>${s.kills}</td>
                <td>${s.deaths}</td>
                <td>${s.kd}</td>
            </tr>
        `;
    });

    // Map Voting
    const voteGrid = document.getElementById('vote-map-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteGrid.appendChild(div);
    });

    document.getElementById('winner-screen').style.display = 'flex';
}

document.getElementById('btn-winner-back-lobby').onclick = () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
};

document.getElementById('btn-winner-back-menu').onclick = () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
};

// Global Keys
window.onkeyup = (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
};

// Auto Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
