let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// Audio elements
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
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = tab;

        if (tab === 'create') {
            document.getElementById('sidebar').style.display = 'none';
            document.getElementById('lobby-browser').style.display = 'none';
            document.getElementById('create-lobby-view').style.display = 'block';
        } else {
            document.getElementById('sidebar').style.display = 'flex';
            document.getElementById('lobby-browser').style.display = 'block';
            document.getElementById('create-lobby-view').style.display = 'none';
            fetchLobbies();
        }
    });
});

// Slider Value Display
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const slider = document.getElementById(`create-${id}`);
    const valSpan = document.getElementById(`val-${id}`);
    if (slider && valSpan) {
        slider.oninput = () => { valSpan.innerText = slider.value; };
    }
});

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            setLocales(data.config.Locales[data.config.Locale]);
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyWaitingArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayers(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            document.getElementById('main-container').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            document.getElementById('game-hud').style.display = 'block';
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
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            document.getElementById('main-container').style.display = 'flex';
            break;
    }
});

function setLocales(locales) {
    if (!locales) return;
    for (const [key, value] of Object.entries(locales)) {
        const elements = document.querySelectorAll(`.l-${key}, #l-${key}`);
        elements.forEach(el => {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = value;
            } else {
                el.innerText = value.toUpperCase();
            }
        });
    }
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Fill Sidebar Filters
    const mapFilter = document.getElementById('filter-maps');
    mapFilter.innerHTML = '<option value="all">ALL MAPS</option>';
    maps.forEach(m => {
        mapFilter.innerHTML += `<option value="${m.id}">${m.label.toUpperCase()}</option>`;
    });

    const weaponFilter = document.getElementById('filter-weapons');
    weaponFilter.innerHTML = '<option value="all">ALL WEAPONS</option>';
    for (const key in config.WeaponLoadouts) {
        weaponFilter.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
    }

    // Fill Create Tab
    const createMapSelect = document.getElementById('create-map-select');
    createMapSelect.innerHTML = '';
    maps.forEach(m => {
        createMapSelect.innerHTML += `<option value="${m.id}">${m.label.toUpperCase()}</option>`;
    });

    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (const key in config.WeaponLoadouts) {
        loadoutGrid.innerHTML += `
            <label class="check-container">
                <input type="checkbox" class="loadout-check" value="${key}">
                <span class="checkmark"></span> ${key.toUpperCase()}
            </label>
        `;
    }
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbies(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    if (lobbies.length === 0) {
        container.innerHTML = '<div class="no-lobbies">NO ACTIVE LOBBIES FOUND</div>';
        return;
    }

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name.toUpperCase()}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | <i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}
                </div>
                ${lobby.hostName ? `<div class="map-name-row"><i class="fa-solid fa-crown"></i> HOST: ${lobby.hostName}</div>` : ''}
            </div>
            <div class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">BEITRETEN</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

document.getElementById('sidebar-quick-join').addEventListener('click', () => {
    const mapId = document.getElementById('filter-maps').value;
    if (mapId === 'all') {
        // Just join first available
        const first = document.querySelector('.btn-join');
        if (first) first.click();
    } else {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId })
        });
    }
});

// Create Lobby Submit
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('.loadout-check:checked')).map(el => el.value);

    const settings = {
        name: document.getElementById('create-lobby-name').value || "MATCH",
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt(document.getElementById('create-round-time').value),
        maxPlayers: parseInt(document.getElementById('create-max-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn-time').value),
        killLimit: parseInt(document.getElementById('create-kill-limit').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    document.getElementById('l-tab_ffa').click();
});

// Waiting Area Functions
function showLobbyWaitingArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('waiting-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-settings-summary').innerHTML = `
        <span>MAP: ${lobby.mapLabel}</span>
        <span>MODUS: ${lobby.mode.toUpperCase()}</span>
        <span>ZEIT: ${lobby.roundTime}m</span>
        <span>LIMIT: ${lobby.killLimit} Kills</span>
        <span>RESPAWN: ${lobby.respawnTime}s</span>
        <span>VEHICLES: ${lobby.vehiclesAllowed ? 'AN' : 'AUS'}</span>
    `;

    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayers(players) {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '👑' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        container.appendChild(div);
    });
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Lobby Actions
document.getElementById('btn-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

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

// Chat logic
function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color:var(--primary)">${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-send').onclick = () => {
    const input = document.getElementById('chat-input');
    if (input.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: input.value })
        });
        input.value = '';
    }
};

document.getElementById('chat-input').onkeypress = (e) => {
    if (e.key === 'Enter') document.getElementById('chat-send').click();
};

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) {
        const oldKills = parseInt(document.getElementById('hud-kills').innerText);
        if (data.kills > oldKills) playSound('kill');
        document.getElementById('hud-kills').innerText = data.kills;
    }
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'block';
        if (data.scoreBlue !== undefined) document.querySelector('#hud-tdm-score .blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.querySelector('#hud-tdm-score .red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    document.getElementById('bar-health').style.width = data.health + '%';
    document.getElementById('bar-armor').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function handleCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    if (seconds > 0) {
        el.style.display = 'block';
        el.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'flex'; // Sicherstellen dass NUI sichtbar

    document.getElementById('winner-announcement').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const tbody = document.querySelector('#winner-stats-table tbody');
    tbody.innerHTML = '';
    if (data.stats) {
        data.stats.forEach(s => {
            tbody.innerHTML += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
        });
    }

    // Map Voting
    const grid = document.getElementById('vote-grid');
    grid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(m => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = m.label.toUpperCase();
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: m.id })
            });
        };
        grid.appendChild(div);
    });
}

document.getElementById('btn-winner-lobby').onclick = () => {
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
};

document.getElementById('btn-winner-menu').onclick = () => {
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('l-tab_ffa').click();
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
};

// Global Esc to close
window.onkeyup = (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
};

// Auto Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('main-container').style.display === 'flex' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
