let currentLobby = null;
let isHost = false;
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

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        if (tab === 'create') {
            document.getElementById('create-lobby-tab').classList.add('active');
        } else {
            document.getElementById('lobby-browser-tab').classList.add('active');
            currentTab = tab;
            fetchLobbies();
        }
        currentTab = tab;
    });
});

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            applyLocalization(data.config.Locale);
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
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.textContent = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });
}

function applyLocalization(locale) {
    const lang = serverConfig.Locales[locale] || serverConfig.Locales['en'];
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (lang[key]) {
            el.textContent = lang[key];
        }
    });
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

        const isFull = lobby.playerCount >= lobby.maxPlayers;
        const btnLabel = isFull ? 'FULL' : (lobby.status === 'ACTIVE' ? 'SPECTATE' : 'JOIN');
        const btnClass = isFull ? 'btn-disabled' : 'btn-join';

        item.innerHTML = `
            <div class="lobby-info-header">
                <div class="lobby-name-box">
                    <h3>${lobby.name.toUpperCase()}</h3>
                    <div class="lobby-host">${lobby.hostName}</div>
                </div>
                <div class="player-count-badge">${lobby.playerCount} / ${lobby.maxPlayers}</div>
            </div>
            <div class="lobby-details">
                <span class="detail-tag"><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                <span class="detail-tag"><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                <span class="detail-tag"><i class="fa-solid fa-clock"></i> ${lobby.roundTime} MIN</span>
            </div>
            <button class="${btnClass}" ${isFull ? 'disabled' : ''} onclick="joinLobby('${lobby.id}', ${lobby.status === 'ACTIVE'})">
                ${btnLabel}
            </button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId, isSpectator) {
    playSound('click');
    const endpoint = currentTab === 'ffa' ? 'quickJoin' : 'joinLobby';
    fetch(`https://${GetParentResourceName()}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId, mapId: lobbyId, isSpectator }) // lobbyId is mapId for quickJoin
    });
}

// Create Lobby
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('#loadout-multi-select input:checked').forEach(i => selectedLoadouts.push(i.value));

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts[0] : 'all', // Fallback
        loadouts: selectedLoadouts,
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

// Lobby Area
function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').textContent = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="detail-tag">MAP: ${lobby.mapLabel}</div>
        <div class="detail-tag">MODE: ${lobby.mode.toUpperCase()}</div>
        <div class="detail-tag">TIME: ${lobby.roundTime} MIN</div>
        <div class="detail-tag">KILL LIMIT: ${lobby.killLimit}</div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<i class="fa-solid fa-xmark" style="color: var(--danger); cursor: pointer;" onclick="kickPlayer('${p.id}')"></i>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        const startBtn = document.getElementById('btn-start-game');
        if (players.length >= 2) {
            startBtn.disabled = false;
            startBtn.classList.remove('btn-disabled');
        } else {
            startBtn.disabled = true;
            startBtn.classList.add('btn-disabled');
        }
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.innerHTML = `<strong>${name}:</strong> ${message}`;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

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

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').textContent = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').textContent = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').textContent = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('score-blue').textContent = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('score-red').textContent = data.scoreRed;
    } else if (data.mode === 'ffa') {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('health-bar').style.width = `${data.health}%`;
    if (data.armor !== undefined) document.getElementById('armor-bar').style.width = `${data.armor}%`;
    if (data.ammo !== undefined) document.getElementById('weapon-ammo').textContent = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('countdown-display');
    if (seconds > 0) {
        el.style.display = 'block';
        el.querySelector('.countdown-number').textContent = seconds;
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').textContent = data.winnerName.toUpperCase() + " GEWINNT!";

    const table = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    table.innerHTML = html;

    // Render Voting
    document.getElementById('match-results-title').textContent = (data.winnerName + " " + (serverConfig.Locales[serverConfig.Locale].winner_suffix || "GEWINNT!")).toUpperCase();
    const voteGrid = document.getElementById('vote-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.textContent = map.label.toUpperCase();
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('voted'));
            div.classList.add('voted');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteGrid.appendChild(div);
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

// Slider Sync
const setupSlider = (id) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.textContent = slider.value;
        });
    }
};
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
