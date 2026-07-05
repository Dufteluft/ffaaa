let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

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

// Initialisierung
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            myPlayerId = data.myId;
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
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
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
            handleCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'receiveStats':
            updateStatsSidebar(data);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Lokalisierung anwenden
    const locale = config.Locales[config.Locale];
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locale[key]) el.innerText = locale[key];
    });

    // Maps füllen
    const mapSelects = [document.getElementById('create-map-select'), document.getElementById('filter-maps')];
    mapSelects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = sel.id.includes('filter') ? '<option value="all">ALL MAPS</option>' : '';
        maps.forEach(map => {
            const opt = document.createElement('option');
            opt.value = map.id;
            opt.innerText = map.label.toUpperCase();
            sel.appendChild(opt);
        });
    });

    // Loadouts füllen
    const loadoutSelect = document.getElementById('create-loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');

        currentTab = btn.dataset.tab;
        if (currentTab !== 'create') fetchLobbies();
    });
});

// Slider Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const slider = document.getElementById(`create-${id}`);
    const valSpan = document.getElementById(`val-${id}`);
    slider.addEventListener('input', () => {
        valSpan.innerText = slider.value;
    });
});

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({
            tab: currentTab,
            filters: {
                map: document.getElementById('filter-maps').value,
                weapon: document.getElementById('filter-weapons').value,
                notFull: document.getElementById('filter-players').value === 'not-full'
            }
        })
    });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById(currentTab === 'ffa' ? 'ffa-list' : 'open-list');
    if (!container) return;
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info">
                <div class="lobby-name">${lobby.name.toUpperCase()}</div>
                <div class="lobby-meta">
                    <span><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                    <span><i class="fa-solid fa-user"></i> ${lobby.hostName}</span>
                </div>
            </div>
            <div class="player-bubble">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <button class="btn-primary" onclick="joinLobby('${lobby.id}')">${serverConfig.Locales[serverConfig.Locale].btn_join}</button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: id })
    });
}

// Create Lobby
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('create-loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(option => option.value);

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts,
        roundTime: parseInt(document.getElementById('create-round-time').value),
        maxPlayers: parseInt(document.getElementById('create-max-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn-time').value),
        killLimit: parseInt(document.getElementById('create-kill-limit').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-friendly-fire').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

// Lobby Area Logic
function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('waiting-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('waiting-lobby-id').innerText = lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-match').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    if (asHost) renderSettingsEditor(lobby);
    else document.getElementById('host-settings-editor').innerHTML = '<p>Warten auf Host...</p>';
}

function renderSettingsEditor(lobby) {
    const container = document.getElementById('host-settings-editor');
    container.innerHTML = `
        <div class="form-grid" style="font-size: 11px;">
            <div class="input-group">
                <label>MAP</label>
                <select id="edit-map-select" onchange="saveSettings()">${serverMaps.map(m => `<option value="${m.id}" ${m.id === lobby.mapId ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
            </div>
            <div class="input-group">
                <label>MODE</label>
                <select id="edit-mode-select" onchange="saveSettings()">
                    <option value="ffa" ${lobby.mode === 'ffa' ? 'selected' : ''}>FFA</option>
                    <option value="tdm" ${lobby.mode === 'tdm' ? 'selected' : ''}>TDM</option>
                </select>
            </div>
        </div>
    `;
}

function saveSettings() {
    const settings = {
        mapId: document.getElementById('edit-map-select').value,
        mode: document.getElementById('edit-mode-select').value
    };
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
}

function renderPlayerList(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            <div style="display: flex; gap: 10px; align-items: center;">
                <span class="player-bubble">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')" style="background: none; border: none; color: var(--danger); cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
        list.appendChild(item);
    });
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Gameplay HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.mode) {
        document.getElementById('hud-mode').innerText = data.mode.toUpperCase();
        document.querySelectorAll('.tdm-only').forEach(el => el.style.display = data.mode === 'tdm' ? 'block' : 'none');
    }
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = `${data.health}%`;
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = `${data.armor}%`;
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function handleCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
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
    document.getElementById('winner-display-name').innerHTML = `${data.winnerName.toUpperCase()} <span data-locale="wins_suffix">${serverConfig.Locales[serverConfig.Locale].wins_suffix}</span>`;

    const tbody = document.querySelector('#winner-stats-table tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(row);
    });

    const voteList = document.getElementById('map-vote-list');
    voteList.innerHTML = '';
    serverMaps.forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = map.label;
        btn.onclick = () => {
            playSound('click');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: map.id }) });
            btn.disabled = true;
            btn.style.opacity = '0.5';
        };
        voteList.appendChild(btn);
    });
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="name">${name}:</span> <span class="text">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// Events
document.getElementById('btn-toggle-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-match').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-match').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, { method: 'POST', body: JSON.stringify({ team: btn.dataset.team }) });
    });
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, { method: 'POST', body: JSON.stringify({ message: e.target.value }) });
        e.target.value = '';
    }
});

document.getElementById('btn-winner-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
});

document.getElementById('btn-winner-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
});

function updateStatsSidebar(stats) {
    document.getElementById('stat-kills').innerText = stats.kills || 0;
    document.getElementById('stat-deaths').innerText = stats.deaths || 0;
    const kd = stats.deaths > 0 ? (stats.kills / stats.deaths).toFixed(2) : (stats.kills || 0).toFixed(2);
    document.getElementById('stat-kd').innerText = kd;
}

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
