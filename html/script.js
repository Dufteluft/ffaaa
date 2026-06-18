let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let translations = {};

// Audio setup (Asset-Pfade aus Config/Shared erwartet)
const audioAssets = {
    click: 'assets/click.mp3',
    join: 'assets/join.mp3',
    start: 'assets/start.mp3',
    kill: 'assets/kill.mp3',
    win: 'assets/win.mp3'
};

function playSound(name) {
    // In FiveM NUI kann man Audio so abspielen:
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    const audio = new Audio(`https://cfx-nui-${resourceName}/html/${audioAssets[name]}`);
    audio.volume = 0.5;
    audio.play().catch(() => {});
}

// Lokalisierungs-Helper
function translate(key, ...args) {
    let str = translations[key] || key;
    args.forEach((val, i) => {
        str = str.replace(`%s`, val);
    });
    return str;
}

function applyLocalization(data) {
    translations = data;
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (translations[key]) {
            el.innerText = translations[key];
        }
    });
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

        // Tab Content Sichtbarkeit
        if (tab === 'ffa' || tab === 'list') {
            document.getElementById('tab-content-lobby').style.display = 'block';
            document.getElementById('tab-content-create').style.display = 'none';
            document.getElementById('browser-filters').style.display = (tab === 'list') ? 'flex' : 'none';
            fetchLobbies();
        } else if (tab === 'create') {
            document.getElementById('tab-content-lobby').style.display = 'none';
            document.getElementById('tab-content-create').style.display = 'block';
        }
    });
});

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
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            updateLobbySettingsUI(data.settings);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'flex';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data.health, data.armor, data.ammo);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization(config.Locales[config.Locale] || config.Locales['en']);

    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

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
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/fetchLobbies`, {
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

        const mapImg = `https://via.placeholder.com/120x70/1a1f2e/ffffff?text=${lobby.mapLabel}`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}
                </div>
                <div class="lobby-details">Host: ${lobby.hostName} | Map: ${lobby.mapLabel}</div>
            </div>
            <div class="player-count-badge">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <button class="confirm-btn" style="width: auto; padding: 10px 20px;" onclick="joinLobby('${lobby.id}')">${translate('btn_join')}</button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    if (currentTab === 'ffa') {
        fetch(`https://${resourceName}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: lobbyId }) // Bei FFA Tab ist ID die MapID
        });
    } else {
        fetch(`https://${resourceName}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId })
        });
    }
}

// Lobby Erstellen Event
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: Array.from(document.getElementById('loadout-select').selectedOptions).map(o => o.value),
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked,
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value)
    };

    fetch(`https://${resourceName}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    updateLobbySettingsUI(lobby);
}

function updateLobbySettingsUI(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div style="font-size: 14px; font-weight: 700; color: var(--text-muted); margin-bottom: 10px;">
            MAP: <span style="color: #fff">${lobby.mapLabel}</span> |
            MODE: <span style="color: #fff">${lobby.mode.toUpperCase()}</span> |
            TIME: <span style="color: #fff">${lobby.roundTime} MIN</span>
        </div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <div>
                <span style="font-weight: 800">${p.name.toUpperCase()}</span>
                <span style="font-size: 10px; color: var(--text-muted); margin-left: 5px;">${p.team.toUpperCase()}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
                ${p.isHost ? '<i class="fa-solid fa-crown" style="color: var(--warning)"></i>' : ''}
                ${isHost && p.id != myPlayerId ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-xmark"></i></button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Slider Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('input', () => {
            document.getElementById(id + '-val').innerText = el.value;
        });
    }
});

// Lobby Actions
document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    playSound('start');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${resourceName}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${resourceName}/closeLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${resourceName}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

// Chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
        if (msg.trim().length > 0) {
            fetch(`https://${resourceName}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name">${name}:</span> <span class="chat-text">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-time-val').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'block';
        document.getElementById('hud-ffa-kills').style.display = 'none';
        if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
        document.getElementById('hud-ffa-kills').style.display = 'block';
    }
}

function updateHUDDetails(health, armor, ammo) {
    document.getElementById('health-bar').style.width = `${health}%`;
    document.getElementById('armor-bar').style.width = `${armor}%`;
    document.getElementById('hud-ammo-val').innerText = ammo;
}

function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    const num = document.getElementById('countdown-number');
    if (seconds > 0) {
        el.style.display = 'flex';
        num.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerHTML = `${data.winnerName.toUpperCase()} <span>${translate('wins_suffix')}</span>`;

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const voteContainer = document.getElementById('voting-maps');
    voteContainer.innerHTML = '';
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label;
        div.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${resourceName}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: map.id }) });
        };
        voteContainer.appendChild(div);
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${resourceName}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${resourceName}/closeWinnerScreen`, { method: 'POST' });
});

// Close on ESC
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
        fetch(`https://${resourceName}/closeUI`, { method: 'POST' });
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
