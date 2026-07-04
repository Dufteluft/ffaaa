let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let currentLocales = {};

// Maps und Config vom Server
let serverMaps = [];
let serverConfig = {};

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

// Lokalisierungs-Helfer
function localizeUI(locales) {
    currentLocales = locales;
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = locales[key];
            } else if (el.classList.contains('wins-suffix')) {
                el.innerText = locales[key].toUpperCase();
            } else {
                el.innerText = locales[key];
            }
        }
    });
}

// Tab-Umschaltung (FFA, Create, List)
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        currentTab = btn.dataset.tab;

        if (currentTab === 'create') {
            document.getElementById('create-lobby-tab').classList.add('active');
        } else {
            document.getElementById('lobby-browser-tab').classList.add('active');
            fetchLobbies();
        }
    });
});

// Slider-Synchronisierung
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
            localizeUI(data.config.Locales[data.config.Locale]);
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
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Filter Maps Dropdown
    const filterMaps = document.getElementById('filter-maps');
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';

    // Create Map Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt.cloneNode(true));
        filterMaps.appendChild(opt);
    });

    // Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
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

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="lobby-name-row">${lobby.name.toUpperCase()}</div>
                <div class="lobby-details-row">
                    <span><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-crosshairs"></i> ${lobby.mode.toUpperCase()}</span>
                    <span><i class="fa-solid fa-user-shield"></i> ${lobby.hostName}</span>
                </div>
            </div>
            <div class="player-bubble">
                ${lobby.playerCount}/${lobby.maxPlayers}
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="action-btn join" onclick="joinLobby('${lobby.id}')">${currentLocales['btn_join'] || 'JOIN'}</button>
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

// Lobby Erstellen
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(option => option.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts[0] : 'pistol', // Vereinfacht für dieses Beispiel
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

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.querySelector('[data-tab="ffa"]').click();
});

// Lobby Wartebereich
function showLobbyArea(lobby) {
    currentLobby = lobby;
    isHost = (myPlayerId == lobby.host);
    playSound('join');

    document.getElementById('lobby-display-name').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-status-tag').innerText = lobby.status === 'playing' ? 'AKTIV' : 'WARTEN...';

    // Host Buttons
    document.getElementById('btn-lobby-start').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-lobby-close').style.display = isHost ? 'block' : 'none';

    renderSettingsEditor(lobby);
}

function renderSettingsEditor(lobby) {
    const editor = document.getElementById('settings-editor');
    if (!isHost) {
        editor.innerHTML = `
            <div class="info-grid">
                <div class="info-item"><label>MAP</label><span>${lobby.mapLabel}</span></div>
                <div class="info-item"><label>MODUS</label><span>${lobby.mode.toUpperCase()}</span></div>
                <div class="info-item"><label>LIMIT</label><span>${lobby.killLimit} Kills / ${lobby.roundTime}m</span></div>
            </div>
        `;
        return;
    }

    // Host kann Einstellungen bearbeiten (vereinfachte Ansicht)
    editor.innerHTML = `
        <div class="editor-row">
            <div class="input-group"><label>MAP</label><select id="edit-map" onchange="syncSettings()"></select></div>
            <div class="input-group"><label>LIMIT</label><input type="number" id="edit-kill-limit" value="${lobby.killLimit}" onchange="syncSettings()"></div>
        </div>
    `;

    const mapSelect = document.getElementById('edit-map');
    serverMaps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        if (map.id === lobby.mapId) opt.selected = true;
        mapSelect.appendChild(opt);
    });
}

function syncSettings() {
    if (!isHost) return;
    const settings = {
        mapId: document.getElementById('edit-map').value,
        killLimit: parseInt(document.getElementById('edit-kill-limit').value)
    };
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-card ${p.ready ? 'ready' : ''} ${p.id == myPlayerId ? 'is-me' : ''}`;

        item.innerHTML = `
            <div class="p-name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</div>
            <div class="p-team" style="font-size: 10px; opacity: 0.7;">${p.team.toUpperCase()}</div>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
        `;
        container.appendChild(item);
    });

    if (isHost) {
        document.getElementById('btn-lobby-start').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Lobby Buttons
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

// Lobby Chat
const chatInput = document.getElementById('lobby-chat-input');
const sendChat = () => {
    const msg = chatInput.value;
    if (msg.trim().length > 0) {
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
    const container = document.getElementById('lobby-chat-messages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';
    const isSystem = (name === 'SYSTEM');

    msgEl.innerHTML = `
        <span class="${isSystem ? 'system' : 'name'}">${name}:</span>
        <span class="text">${message}</span>
    `;
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-time').innerText = data.time;
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

function updateHUDDetails(data) {
    if (data.health !== undefined) {
        document.getElementById('hud-health-bar').style.width = data.health + '%';
    }
    if (data.armor !== undefined) {
        document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    }
    if (data.ammo !== undefined) {
        document.getElementById('hud-ammo-clip').innerText = data.ammo;
    }
}

function showCountdown(seconds) {
    const overlay = document.getElementById('hud-countdown');
    const num = document.getElementById('countdown-number');

    if (seconds <= 0) {
        overlay.style.display = 'none';
        return;
    }

    overlay.style.display = 'flex';
    num.innerText = seconds;
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const body = document.getElementById('winner-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const row = document.createElement('div');
        row.className = 'stats-row';
        row.innerHTML = `
            <span>${s.name.toUpperCase()}</span>
            <span>${s.kills}</span>
            <span>${s.deaths}</span>
            <span>${s.kd}</span>
        `;
        body.appendChild(row);
    });

    renderMapVoting();
}

function renderMapVoting() {
    const container = document.getElementById('map-voting-container');
    container.innerHTML = '';

    // Zufällige 3 Maps zum Voten auswählen
    const votingMaps = serverMaps.slice(0, 3);
    votingMaps.forEach(map => {
        const item = document.createElement('div');
        item.className = 'map-vote-item';
        item.innerText = map.label.toUpperCase();
        item.onclick = () => {
            document.querySelectorAll('.map-vote-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        container.appendChild(item);
    });
}

document.getElementById('btn-win-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-win-main-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// Close UI on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh für Lobbyliste
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
