let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let config = {};
let maps = [];
let translations = {};

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
    translations = localeData;
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (translations[key]) {
            if (el.tagName === 'INPUT' && el.type === 'placeholder') {
                el.placeholder = translations[key];
            } else {
                el.innerText = translations[key];
            }
        }
    });
}

function getTranslation(key, ...args) {
    let str = translations[key] || key;
    args.forEach(arg => {
        str = str.replace('%s', arg);
    });
    return str;
}

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = tab;

        // UI visibility based on tab
        if (tab === 'create') {
            document.getElementById('tab-browser').style.display = 'none';
            document.getElementById('tab-create').style.display = 'block';
            document.getElementById('filter-bar').style.display = 'none';
        } else {
            document.getElementById('tab-browser').style.display = 'block';
            document.getElementById('tab-create').style.display = 'none';
            document.getElementById('filter-bar').style.display = tab === 'list' ? 'flex' : 'none';
            fetchLobbies();
        }
    });
});

// Slider Sync
function initSliders() {
    const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
    sliders.forEach(id => {
        const slider = document.getElementById(id);
        const display = document.getElementById(id + '-val');
        if (slider && display) {
            slider.addEventListener('input', () => {
                display.innerText = slider.value;
            });
        }
    });
}

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            config = data.config;
            maps = data.maps;
            myPlayerId = data.myId;
            applyLocalization(config.Locales[config.Locale]);
            initUI();
            document.getElementById('app').style.display = 'flex';
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
            currentLobby = data.lobby;
            isHost = (myPlayerId == currentLobby.host);
            showWaitingArea();
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

        case 'countdown':
            const cd = document.getElementById('big-countdown');
            if (data.seconds > 0) {
                cd.innerText = data.seconds;
                cd.style.display = 'block';
            } else {
                cd.style.display = 'none';
            }
            break;

        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-scores').style.display = data.isPersistent ? 'none' : 'none'; // Default hidden
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

        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function initUI() {
    // Fill Map Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    // Fill Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (const [key, val] of Object.entries(config.WeaponLoadouts)) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }

    initSliders();
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

    const freeSlotsOnly = document.getElementById('filter-free-slots').checked;

    lobbies.forEach(lobby => {
        if (freeSlotsOnly && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? getTranslation('tdm_mode') : getTranslation('ffa_mode')}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}</div>
            </div>
            <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <div class="action-area">
                <button class="action-btn" onclick="joinLobby('${lobby.id}', '${lobby.mapId}', ${lobby.isPersistent})">${getTranslation('btn_join')}</button>
            </div>
        `;
        container.appendChild(item);
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

// Create Lobby
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA Lobby',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts,
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
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.querySelector('[data-tab="ffa"]').click();
});

function showWaitingArea() {
    playSound('join');
    document.getElementById('lobby-display-name').innerText = currentLobby.name.toUpperCase();
    document.getElementById('lobby-display-id').innerText = currentLobby.id;
    document.getElementById('wait-map-label').innerText = currentLobby.mapLabel;
    document.getElementById('wait-mode-label').innerText = currentLobby.mode === 'tdm' ? getTranslation('tdm_mode') : getTranslation('ffa_mode');

    document.getElementById('lobby-waiting-area').style.display = 'flex';

    // Host controls
    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-save-settings').style.display = isHost ? 'block' : 'none';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item';
        if (p.ready) div.style.borderLeft = '4px solid var(--success)';

        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '(HOST)' : ''}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="status-badge">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });
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
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.getAttribute('data-team') })
        });
    });
});

// Chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg.trim()) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

function addChatMessage(name, msg) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color: var(--primary)">${name}:</strong> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// HUD
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
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-fill').style.width = data.health + '%';
    document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-display-name').innerHTML = `${data.winnerName.toUpperCase()} <span data-locale="wins_suffix">${getTranslation('wins_suffix')}</span>`;

    const tbody = document.getElementById('match-stats-body');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });

    // Fill Voting
    const voteGrid = document.getElementById('map-voting-grid');
    voteGrid.innerHTML = '';
    maps.slice(0, 3).forEach(map => {
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

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
    document.querySelector('[data-tab="ffa"]').click();
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
