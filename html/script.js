let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

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
function applyLocalization(config) {
    if (!config || !config.Locales || !config.Locale) return;
    const lang = config.Locales[config.Locale];
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (lang[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = lang[key];
            } else {
                el.innerText = lang[key].toUpperCase();
            }
        }
    });
}

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;

        // Show/Hide relevant containers
        document.getElementById('lobby-list-container').style.display = (currentTab === 'ffa' || currentTab === 'list') ? 'flex' : 'none';
        document.getElementById('create-lobby-form').style.display = (currentTab === 'create') ? 'block' : 'none';
        document.getElementById('sidebar').style.display = (currentTab === 'create') ? 'none' : 'flex';

        if (currentTab !== 'create') {
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
            myPlayerId = data.myId;
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
            showLobbyArea(data.lobby, (data.action === 'lobbyCreated' || data.lobby.host == myPlayerId));
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            showHUD(data);
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
        case 'updateStats':
            updateStatsDisplay(data.stats);
            break;
        case 'syncSettings':
            currentLobby = data.lobby;
            updateLobbySummary(data.lobby);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization(config);

    const mapSelect = document.getElementById('map-select');
    const filterMapSelect = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMapSelect.innerHTML = '<option value="all">ALL MAPS</option>';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt.cloneNode(true));
        filterMapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('loadout-select');
    const filterWeaponSelect = document.getElementById('filter-weapons');
    loadoutSelect.innerHTML = '';
    filterWeaponSelect.innerHTML = '<option value="all">ALL WEAPONS</option>';

    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt.cloneNode(true));
        filterWeaponSelect.appendChild(opt);
    }
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({
            tab: currentTab,
            map: document.getElementById('filter-maps').value,
            weapon: document.getElementById('filter-weapons').value,
            notFull: document.getElementById('filter-players').value === 'not-full'
        })
    });
}

// Re-fetch on filter change
document.querySelectorAll('.sidebar select').forEach(s => {
    s.addEventListener('change', fetchLobbies);
});

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-item-main">
                <div class="lobby-item-name">${lobby.name}</div>
                <div class="lobby-item-sub">${lobby.mapLabel} | ${lobby.mode.toUpperCase()} | HOST: ${lobby.hostName}</div>
            </div>
            <div class="player-count-badge">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <button class="btn-join" onclick="joinLobby('${lobby.id}', ${lobby.isPersistent})">
                ${lobby.status === 'ACTIVE' ? 'JOIN' : 'JOIN'}
            </button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId, isPersistent) {
    playSound('click');
    if (isPersistent) {
        const lobby = serverMaps.find(m => "FFA " + m.label === lobbyId || m.id === lobbyId); // Simple check
        // Actually the ID passed is the lobby object ID from server
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: lobbyId }) // Server handles persistent by mapId or ID
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobbyId })
        });
    }
}

// Also handle the quickJoin for the FFA tab specifically if needed, but renderLobbyList should cover it.
// Fixed joinLobby to use lobbyId correctly.

document.getElementById('btn-create-submit').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
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

document.getElementById('btn-create-cancel').addEventListener('click', () => {
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
    document.getElementById('team-selection-area').style.display = lobby.mode === 'tdm' ? 'block' : 'none';

    updateLobbySummary(lobby);
}

function updateLobbySummary(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="stat-row"><span>MAP</span> <span>${lobby.mapLabel}</span></div>
        <div class="stat-row"><span>MODE</span> <span>${lobby.mode.toUpperCase()}</span></div>
        <div class="stat-row"><span>LOADOUT</span> <span>${lobby.loadout.toUpperCase()}</span></div>
        <div class="stat-row"><span>LIMIT</span> <span>${lobby.killLimit > 0 ? lobby.killLimit : 'NONE'}</span></div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color:gold;margin-left:5px;"></i>' : ''}</span>
            <span style="color:var(--text-muted)">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        // Simple validation: need at least 1 other player or 1 for tests
        document.getElementById('btn-start-game').disabled = players.length < 1;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
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
    div.className = 'chat-entry';
    div.innerHTML = `<span class="chat-name">${name}:</span> <span class="chat-msg">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

// HUD Logic
function showHUD(data) {
    document.getElementById('game-hud').style.display = 'block';
    document.getElementById('hud-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
    document.getElementById('hud-timer').innerText = data.isPersistent ? 'PERSISTENT' : '00:00';
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('health-fill').style.width = data.health + '%';
    document.getElementById('armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('game-countdown');
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
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const tbody = document.querySelector('#winner-stats-table tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });

    // Map Voting
    const voteList = document.getElementById('vote-map-list');
    voteList.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label.toUpperCase();
        div.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteList.appendChild(div);
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    // Logic to stay in lobby or restart handled by server
});

function updateStatsDisplay(stats) {
    if (!stats) return;
    document.getElementById('stat-kills').innerText = stats.kills || 0;
    document.getElementById('stat-deaths').innerText = stats.deaths || 0;
    const kd = (stats.deaths > 0) ? (stats.kills / stats.deaths).toFixed(2) : (stats.kills).toFixed(2);
    document.getElementById('stat-kd').innerText = kd;
}

// Close UI on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
