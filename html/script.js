let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Audio Setup
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

// Initialisierung bei Nachrichten vom Client
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            switchTab(currentTab);
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyWaitingArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-view').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('hud-container').style.display = 'flex';
            break;
        case 'hideHUD':
            document.getElementById('hud-container').style.display = 'none';
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
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Lokalisierung anwenden
    const locale = config.Locales[config.Locale];
    for (let key in locale) {
        const elements = document.querySelectorAll(`#l-${key.replace(/_/g, '-')}, .l-${key.replace(/_/g, '-')}`);
        elements.forEach(el => {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = locale[key];
            } else {
                el.innerText = locale[key].toUpperCase();
            }
        });
    }

    // Map-Dropdowns füllen
    const mapSelects = [document.getElementById('create-map-select'), document.getElementById('filter-maps')];
    mapSelects.forEach(select => {
        if (!select) return;
        // Behalte die erste Option ("ALLE MAPS") bei Filtern
        const firstOption = select.id.includes('filter') ? select.options[0] : null;
        select.innerHTML = '';
        if (firstOption) select.appendChild(firstOption);

        maps.forEach(map => {
            const opt = document.createElement('option');
            opt.value = map.id;
            opt.innerText = map.label.toUpperCase();
            select.appendChild(opt);
        });
    });

    // Waffen-Grid füllen (Multi-Select)
    const weaponGrid = document.getElementById('create-weapon-grid');
    weaponGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const label = document.createElement('label');
        label.className = 'weapon-checkbox';
        label.innerHTML = `
            <input type="checkbox" name="weapon-loadout" value="${key}">
            <span>${config.WeaponLoadouts[key][0].label.toUpperCase()}</span>
            <i class="fa-solid fa-circle-check"></i>
        `;
        label.addEventListener('click', () => {
            label.classList.toggle('active', label.querySelector('input').checked);
        });
        weaponGrid.appendChild(label);
    }
}

// Tab-Steuerung
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        switchTab(btn.dataset.tab);
    });
});

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));

    const sidebar = document.getElementById('sidebar-filters');
    sidebar.style.display = (tabId === 'create') ? 'none' : 'flex';

    if (tabId === 'create') {
        document.getElementById('create-lobby-view').classList.add('active');
    } else {
        document.getElementById('lobby-list-view').classList.add('active');
        fetchLobbies(tabId);
    }
}

function fetchLobbies(tab) {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: tab || currentTab })
    });
}

// Lobby Liste rendern
function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animation = `slideIn 0.3s forwards ${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;
        const radius = 28;
        const circ = 2 * Math.PI * radius;
        const offset = circ - (percent / 100) * circ;

        let strokeColor = '#00ff88';
        if (percent > 80) strokeColor = '#ff9500';
        if (lobby.status === 'ACTIVE') strokeColor = '#00d4ff';

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="https://via.placeholder.com/160x90/0f1419/ffffff?text=${lobby.mapLabel}" alt="Map">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | ${lobby.mode.toUpperCase()}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="32.5" cy="32.5" r="${radius}"></circle>
                    <circle class="circle-progress" cx="32.5" cy="32.5" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circ}; stroke-dashoffset: ${offset};"></circle>
                </svg>
                <div class="player-count-text">${playerCount}/${maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${lobby.status === 'ACTIVE' ? 'ZUSCHAUEN' : 'BEITRETEN'}</button>
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

// Lobby Erstellen Event
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedWeapons = Array.from(document.querySelectorAll('input[name="weapon-loadout"]:checked')).map(i => i.value);

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedWeapons.length > 0 ? selectedWeapons : ['all'],
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

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    switchTab('ffa');
});

// Slider Sync
const setupSliderSync = (sliderId, valId) => {
    const s = document.getElementById(sliderId);
    const v = document.getElementById(valId);
    s.addEventListener('input', () => v.innerText = s.value);
};
setupSliderSync('create-round-time', 'val-round-time');
setupSliderSync('create-max-players', 'val-max-players');
setupSliderSync('create-respawn-time', 'val-respawn-time');
setupSliderSync('create-kill-limit', 'val-kill-limit');

// Wartebereich Logik
function showLobbyWaitingArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('waiting-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('waiting-map-name').innerText = lobby.mapLabel.toUpperCase();
    document.getElementById('waiting-mode-name').innerText = lobby.mode.toUpperCase();
    document.getElementById('waiting-round-time').innerText = lobby.roundTime + " MIN";

    document.getElementById('lobby-waiting-view').style.display = 'flex';
    document.getElementById('btn-lobby-start').style.display = asHost ? 'block' : 'none';

    // Team-Selector nur bei TDM relevant (optional anzeigen)
    document.getElementById('team-selector').style.display = (lobby.mode === 'tdm') ? 'flex' : 'none';
}

function renderPlayerList(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    document.getElementById('waiting-player-count').innerText = players.length;

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <div class="player-name-box">
                <span class="player-name">${p.name.toUpperCase()}</span>
                ${p.isHost ? '<span class="player-host-tag">HOST</span>' : ''}
            </div>
            <div class="player-team-tag">${p.team.toUpperCase()}</div>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-circle-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-lobby-start').disabled = (players.length < 2);
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, { method: 'POST', body: JSON.stringify({ id }) });
}

document.getElementById('btn-lobby-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-lobby-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-lobby-leave').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-view').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, { method: 'POST', body: JSON.stringify({ team: btn.dataset.team }) });
    });
});

// Chat
const chatInput = document.getElementById('lobby-chat-input');
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, { method: 'POST', body: JSON.stringify({ message: chatInput.value }) });
        chatInput.value = '';
    }
});
document.getElementById('btn-send-chat').addEventListener('click', () => {
    if (chatInput.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, { method: 'POST', body: JSON.stringify({ message: chatInput.value }) });
        chatInput.value = '';
    }
});

function addChatMessage(name, message) {
    const container = document.getElementById('lobby-chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="name">${name.toUpperCase()}:</span><span class="text">${message}</span>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-scores').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-scores').style.display = 'none';
    }

    if (data.kills > parseInt(document.getElementById('hud-kills').innerText)) {
        playSound('kill');
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-fill').style.width = data.health + '%';
    document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('countdown-display');
    const num = document.getElementById('countdown-number');
    if (seconds > 0) {
        el.style.display = 'block';
        num.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-view').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const body = document.getElementById('winner-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        body.appendChild(row);
    });

    // Map Voting Grid
    const voteGrid = document.getElementById('vote-map-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `
            <div class="vote-img"><img src="https://via.placeholder.com/200x100/0f1419/ffffff?text=${map.label}" alt="Map"></div>
            <div class="vote-label">${map.label}</div>
        `;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: map.id }) });
        };
        voteGrid.appendChild(div);
    });
}

document.getElementById('btn-winner-back').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-view').style.display = 'none';
    document.getElementById('lobby-waiting-view').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-view').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// Close UI on ESC
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-view').style.display === 'none' &&
        document.getElementById('winner-view').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
