let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let L = {}; // Locales

// Maps und Konfiguration vom Server
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

// Tab-Umschaltung
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // View umschalten
        const tab = btn.dataset.tab;
        currentTab = tab;

        if (tab === 'create') {
            document.getElementById('lobby-browser-view').classList.remove('active');
            document.getElementById('lobby-create-view').classList.add('active');
        } else {
            document.getElementById('lobby-create-view').classList.remove('active');
            document.getElementById('lobby-browser-view').classList.add('active');
            fetchLobbies();
        }
    });
});

// Slider Synchronisation
const setupSlider = (id) => {
    const slider = document.getElementById('create-' + id);
    const span = document.getElementById('val-' + id);
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
setupSlider('time');
setupSlider('players');
setupSlider('respawn');
setupSlider('kills');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            L = data.locales;
            document.getElementById('app').style.display = 'flex';
            document.getElementById('main-menu').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            applyLocales();
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
            document.getElementById('main-menu').style.display = 'none';
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
            if (data.isPersistent) {
                document.getElementById('hud-tdm-score').style.display = 'none';
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
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function applyLocales() {
    document.querySelector('.header-title').innerText = L['menu_title'];
    document.querySelector('.tab-btn[data-tab="ffa"]').innerText = L['tab_ffa'];
    document.querySelector('.tab-btn[data-tab="create"]').innerText = L['tab_create'];
    document.querySelector('.tab-btn[data-tab="list"]').innerText = L['tab_list'];

    // Create Form Labels
    document.querySelector('#lobby-create-view label:nth-of-type(1)').innerText = L['lobby_name'];
    // ... weite labels können hier gesetzt werden oder via data-attributes im HTML
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Filter Maps füllen
    const filterMaps = document.getElementById('filter-maps');
    filterMaps.innerHTML = `<option value="all">${L['all_maps'] || 'ALLE MAPS'}</option>`;
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        filterMaps.appendChild(opt);
    });

    // Create Map Select füllen
    const createMap = document.getElementById('create-map');
    createMap.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        createMap.appendChild(opt);
    });

    // Loadout Optionen füllen
    const loadoutGrid = document.getElementById('loadout-options');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="radio" name="loadout" id="loadout-${key}" value="${key}" ${key === 'pistol' ? 'checked' : ''}>
            <label for="loadout-${key}">${key.toUpperCase()}</label>
        `;
        loadoutGrid.appendChild(div);
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
        container.innerHTML = `<div class="no-lobbies">${L['no_lobbies']}</div>`;
        return;
    }

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;

        let status = lobby.status || 'waiting';
        let strokeColor = '#00ff88'; // Success
        if (status === 'AKTIV') strokeColor = '#00d4ff'; // Primary
        else if (percent > 80) strokeColor = '#ff9500'; // Warning

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE FOR ALL'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}
                </div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="30" cy="30" r="${radius}"></circle>
                    <circle class="circle-progress" cx="30" cy="30" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${playerCount}/${maxPlayers}</div>
            </div>
            <div class="status-badge">${status}</div>
            <div class="action-area">
                ${renderActionButton(lobby)}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>${L['lobby_full_btn'] || 'VOLL'}</button>`;
    }
    if (currentTab === 'ffa') {
        return `<button class="action-btn btn-join" onclick="quickJoin('${lobby.mapId}')">${L['quick_join_btn'] || 'SOFORT-START'}</button>`;
    }
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${L['btn_join']}</button>`;
}

function quickJoin(mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/quickJoin`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const loadout = document.querySelector('input[name="loadout"]:checked').value;
    const settings = {
        name: document.getElementById('create-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: loadout,
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-kills').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-display-name').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-display-map').innerText = 'MAP: ' + lobby.mapLabel.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-start-game').innerText = L['btn_start'];
    document.getElementById('btn-ready-toggle').innerText = L['btn_ready'];
    document.getElementById('btn-leave-lobby').innerText = L['btn_leave'];

    document.getElementById('lobby-display-settings').innerHTML = `
        <div class="setting-pill">${L['mode_select']}: ${lobby.mode.toUpperCase()}</div>
        <div class="setting-pill">${L['round_time']}: ${lobby.roundTime} MIN</div>
        <div class="setting-pill">${L['kill_limit']}: ${lobby.killLimit > 0 ? lobby.killLimit : 'AUS'}</div>
        <div class="setting-pill">${L['loadout_select']}: ${lobby.loadout.toUpperCase()}</div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    document.getElementById('player-count-nav').innerText = `${players.length}/${currentLobby.maxPlayers}`;

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span style="color: var(--text-muted); font-size: 11px;">TEAM: ${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
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
    document.getElementById('main-menu').style.display = 'flex';
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

// Chat
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

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color: var(--primary)">${name}:</strong> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-time').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'flex';
        document.querySelector('.blue .score-label').innerText = L['team_blue'];
        document.querySelector('.red .score-label').innerText = L['team_red'];
        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }

    document.querySelector('.stat-item:nth-of-type(1) .stat-label').innerText = L['kills'];
    document.querySelector('.stat-item:nth-of-type(2) .stat-label').innerText = L['deaths'];
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health-fill').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function handleCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    if (seconds > 0) {
        el.style.display = 'block';
        document.getElementById('countdown-number').innerText = seconds;
        document.querySelector('.countdown-text').innerText = L['countdown_prepare'] || 'BEREITMACHEN!';
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();
    document.getElementById('winner-title').innerText = L['game_ended'];

    document.getElementById('btn-back-to-lobby').innerText = L['btn_back_to_lobby'] || 'ZURÜCK ZUR LOBBY';
    document.getElementById('btn-back-to-menu').innerText = L['btn_back_to_menu'] || 'HAUPTMENÜ';

    const body = document.getElementById('match-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name.toUpperCase()}</td>
            <td>${s.kills}</td>
            <td>${s.deaths}</td>
            <td>${s.kd}</td>
        `;
        body.appendChild(tr);
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

// Close UI on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('main-menu').style.display === 'flex' && currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
