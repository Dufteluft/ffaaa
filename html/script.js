let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let selectedTeam = 'random';

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

// Tab Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.dataset.tab;
        fetchLobbies();
    });
});

// View Navigation
document.getElementById('open-create-btn').addEventListener('click', () => {
    playSound('click');
    document.getElementById('main-container').style.display = 'none';
    document.getElementById('create-lobby-view').style.display = 'flex';
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.getElementById('create-lobby-view').style.display = 'none';
    document.getElementById('main-container').style.display = 'flex';
});

// Slider Sync
const syncSlider = (id, spanId) => {
    const input = document.getElementById(id);
    const span = document.getElementById(spanId);
    input.addEventListener('input', () => { span.innerText = input.value; });
};
syncSlider('round-time-input', 'round-time-val');
syncSlider('max-players-input', 'max-players-val');

// Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;
    switch (data.action) {
        case 'open':
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
            document.getElementById('main-container').style.display = 'none';
            document.getElementById('create-lobby-view').style.display = 'none';
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
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Fill selects
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';
    maps.forEach(m => {
        const opt = `<option value="${m.id}">${m.label.toUpperCase()}</option>`;
        mapSelect.innerHTML += opt;
        filterMaps.innerHTML += opt;
    });

    const loadoutSelect = document.getElementById('loadout-select');
    const filterWeapons = document.getElementById('filter-weapons');
    loadoutSelect.innerHTML = '';
    filterWeapons.innerHTML = '<option value="all">ALL WEAPONS</option>';
    for (let key in config.WeaponLoadouts) {
        const opt = `<option value="${key}">${key.toUpperCase()}</option>`;
        loadoutSelect.innerHTML += opt;
        filterWeapons.innerHTML += opt;
    }

    // Apply Locales
    if (config.Locales && config.Locale) {
        const loc = config.Locales[config.Locale];
        for (let key in loc) {
            const elements = document.querySelectorAll(`#l-${key}, .l-${key}`);
            elements.forEach(el => {
                if (el.tagName === 'INPUT' && el.type === 'button') el.value = loc[key];
                else el.innerText = loc[key];
            });
        }
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
    lobbies.forEach((l, i) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${i * 0.05}s`;

        const percent = (l.playerCount / l.maxPlayers) * 100;
        const color = percent > 80 ? '#ff9500' : (l.status === 'ACTIVE' ? '#00d4ff' : '#00ff88');
        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        item.innerHTML = `
            <div class="lobby-map-preview"></div>
            <div class="lobby-info-main">
                <div class="match-type">${l.name.toUpperCase()}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${l.mapLabel.toUpperCase()} • ${l.mode.toUpperCase()}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg"><circle class="circle-bg" cx="25" cy="25" r="${radius}"></circle>
                <circle class="circle-progress" cx="25" cy="25" r="${radius}" style="stroke: ${color}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};"></circle></svg>
                <div class="player-count-text">${l.playerCount}/${l.maxPlayers}</div>
            </div>
            <div class="action-area">
                <button class="action-btn ${l.playerCount >= l.maxPlayers ? 'btn-disabled' : 'btn-join'}"
                onclick="${l.playerCount < l.maxPlayers ? (l.isPersistent ? `quickJoin('${l.mapId}')` : `joinLobby('${l.id}')`) : ''}">${l.playerCount >= l.maxPlayers ? 'FULL' : 'JOIN'}</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId) { playSound('click'); fetch(`https://${GetParentResourceName()}/joinLobby`, { method: 'POST', body: JSON.stringify({ lobbyId }) }); }
function quickJoin(mapId) { playSound('click'); fetch(`https://${GetParentResourceName()}/quickJoin`, { method: 'POST', body: JSON.stringify({ mapId }) }); }

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const data = {
        name: document.getElementById('lobby-name-input').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: document.getElementById('loadout-select').value,
        roundTime: parseInt(document.getElementById('round-time-input').value),
        maxPlayers: parseInt(document.getElementById('max-players-input').value),
        vehiclesAllowed: document.getElementById('vehicles-toggle').checked,
        friendlyFire: document.getElementById('ff-toggle').checked,
        respawnTime: parseInt(document.getElementById('respawn-time-input').value),
        killLimit: parseInt(document.getElementById('kill-limit-input').value)
    };
    fetch(`https://${GetParentResourceName()}/createLobby`, { method: 'POST', body: JSON.stringify(data) });
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby; isHost = asHost; playSound('join');
    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('lobby-info-summary').innerHTML = `<p>MAP: ${lobby.mapLabel}</p><p>MODE: ${lobby.mode.toUpperCase()}</p><p>TIME: ${lobby.roundTime} MIN</p><p>LIMIT: ${lobby.killLimit}</p>`;
    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `<span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span><div style="display:flex;gap:10px;align-items:center;"><span style="font-size:10px;color:var(--text-muted)">${p.team.toUpperCase()}</span>
        ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}</div>`;
        list.appendChild(item);
    });
    if (isHost) document.getElementById('btn-start-game').disabled = players.length < 2;
}

function kickPlayer(id) { fetch(`https://${GetParentResourceName()}/kickPlayer`, { method: 'POST', body: JSON.stringify({ id }) }); }

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedTeam = btn.dataset.team;
        fetch(`https://${GetParentResourceName()}/setTeam`, { method: 'POST', body: JSON.stringify({ team: selectedTeam }) });
    });
});

document.getElementById('btn-ready-toggle').addEventListener('click', () => { playSound('click'); fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' }); });
document.getElementById('btn-start-game').addEventListener('click', () => { playSound('start'); fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' }); });
document.getElementById('btn-leave-lobby').addEventListener('click', () => { playSound('click'); document.getElementById('lobby-waiting-area').style.display = 'none'; document.getElementById('main-container').style.display = 'flex'; fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' }); });

function addChatMessage(name, msg) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color:var(--primary)">${name.toUpperCase()}:</strong> ${msg}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg.trim().length > 0) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, { method: 'POST', body: JSON.stringify({ message: msg }) });
            e.target.value = '';
        }
    }
});

// HUD Logic
function showHUD(data) {
    document.getElementById('game-hud').style.display = 'flex';
    document.querySelector('.ffa-only').style.display = data.mode === 'tdm' ? 'none' : 'flex';
    document.querySelector('.tdm-only').style.display = data.mode === 'tdm' ? 'flex' : 'none';
    if (data.isPersistent) document.getElementById('hud-timer').innerText = '--:--';
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('health-progress').style.width = data.health + '%';
    document.getElementById('armor-progress').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
    document.getElementById('hud-total-ammo').innerText = data.totalAmmo;
}

function showCountdown(seconds) {
    const el = document.getElementById('countdown-display');
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
    document.getElementById('winner-announcement').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const container = document.getElementById('match-stats-container');
    let html = `<table><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

    // Map Voting
    const voteGrid = document.getElementById('map-voting-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(m => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = m.label.toUpperCase();
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: m.id }) });
        };
        voteGrid.appendChild(div);
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => { playSound('click'); document.getElementById('winner-screen').style.display = 'none'; fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' }); });
document.getElementById('btn-back-to-lobby').addEventListener('click', () => { playSound('click'); document.getElementById('winner-screen').style.display = 'none'; document.getElementById('lobby-waiting-area').style.display = 'flex'; fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' }); });

window.addEventListener('keyup', (e) => { if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' }); });

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('create-lobby-view').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
