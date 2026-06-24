let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let selectedLoadouts = [];

// Maps and Config from Server
let serverMaps = [];
let serverConfig = {};

// Audio setup (optional, if assets exist)
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

        if (currentTab === 'create') {
            document.getElementById('lobby-browser-container').style.display = 'none';
            document.getElementById('create-lobby-tab').style.display = 'flex';
        } else {
            document.getElementById('lobby-browser-container').style.display = 'block';
            document.getElementById('create-lobby-tab').style.display = 'none';
            fetchLobbies();
        }
    });
});

// Slider Sync
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

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            document.getElementById('main-menu').style.display = 'flex';
            myPlayerId = data.myId;
            setupInitialData(data.config, data.maps);
            updateLocalization(data.config.Locales[data.config.Locale]);
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            document.querySelectorAll('.overlay').forEach(el => el.style.display = 'none');
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            document.getElementById('main-menu').style.display = 'none';
            showLobbyArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            syncLobbySettings(data.settings);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.querySelectorAll('.ffa-only, .tdm-only').forEach(el => el.style.display = 'none');
            document.querySelectorAll(data.mode === 'tdm' ? '.tdm-only' : '.ffa-only').forEach(el => el.style.display = 'flex');
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.querySelectorAll('.overlay').forEach(el => el.style.display = 'none');
            break;
    }
});

function updateLocalization(loc) {
    if (!loc) return;
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (loc[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = loc[key];
            } else {
                el.innerText = loc[key].toUpperCase();
            }
        }
    });
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const multiSelect = document.getElementById('loadout-multi-select');
    multiSelect.innerHTML = '';
    selectedLoadouts = ['all'];

    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('div');
        opt.className = `multi-option ${key === 'all' ? 'selected' : ''}`;
        opt.innerText = key.toUpperCase();
        opt.onclick = () => {
            playSound('click');
            if (key === 'all') {
                selectedLoadouts = ['all'];
            } else {
                const allIdx = selectedLoadouts.indexOf('all');
                if (allIdx > -1) selectedLoadouts.splice(allIdx, 1);

                const idx = selectedLoadouts.indexOf(key);
                if (idx > -1) selectedLoadouts.splice(idx, 1);
                else selectedLoadouts.push(key);

                if (selectedLoadouts.length === 0) selectedLoadouts = ['all'];
            }
            document.querySelectorAll('.multi-option').forEach(el => {
                el.classList.toggle('selected', selectedLoadouts.includes(el.innerText.toLowerCase()));
            });
        };
        multiSelect.appendChild(opt);
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
        const item = document.createElement('div');
        item.className = 'lobby-item';

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | ${lobby.hostName}
                </div>
            </div>
            <div class="player-counter">
                <span class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</span>
                <label data-locale="tab_players">Players</label>
            </div>
            <div class="action-area">
                <button class="action-btn" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">${lobby.status === 'ACTIVE' ? 'SPECTATE' : 'JOIN'}</button>
            </div>
        `;
        container.appendChild(item);
    });
    // Re-apply localization for newly created elements
    updateLocalization(serverConfig.Locales[serverConfig.Locale]);
}

function joinLobby(lobbyId, mapId) {
    playSound('click');
    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId })
        });
    }
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts,
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        vehiclesAllowed: document.getElementById('vehicles-toggle').checked,
        friendlyFire: document.getElementById('ff-toggle').checked,
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value)
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
    document.getElementById('lobby-id-display').innerText = lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = isHost ? 'block' : 'none';

    updateLobbySummary(lobby);
}

function updateLobbySummary(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="summary-item">
            <div class="summary-label" data-locale="map_select">Map</div>
            <div class="summary-value">${lobby.mapLabel}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label" data-locale="mode_select">Mode</div>
            <div class="summary-value">${lobby.mode.toUpperCase()}</div>
        </div>
        <div class="summary-item">
            <div class="summary-label" data-locale="round_time">Time</div>
            <div class="summary-value">${lobby.roundTime} MIN</div>
        </div>
    `;
    updateLocalization(serverConfig.Locales[serverConfig.Locale]);
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''} ${p.team ? 'team-'+p.team : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
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
    div.className = 'chat-msg';
    div.innerHTML = `<span class="name">${name}:</span><span class="text">${message}</span>`;
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

function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    if (seconds > 0) {
        el.style.display = 'block';
        document.getElementById('countdown-number').innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-fill').style.width = data.health + '%';
    document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName.toUpperCase() + " " + (serverConfig.Locales[serverConfig.Locale]['wins_suffix'] || 'GEWINNT!');

    const tbody = document.querySelector('#match-stats-table tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });

    // Render map voting options
    const voteContainer = document.getElementById('vote-map-options');
    voteContainer.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = map.label;
        btn.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteContainer.appendChild(btn);
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
