let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// Audio
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
function _T(key) {
    if (serverConfig.Locales && serverConfig.Locales[serverConfig.Locale]) {
        return serverConfig.Locales[serverConfig.Locale][key] || key;
    }
    return key;
}

function applyLocalization() {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        el.innerText = _T(key);
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

        document.getElementById('browser-tab').style.display = (tab === 'ffa' || tab === 'lobby') ? 'block' : 'none';
        document.getElementById('create-tab').style.display = (tab === 'create') ? 'flex' : 'none';

        currentTab = tab;
        if (tab !== 'create') {
            fetchLobbies();
        }
    });
});

// Slider Value Sync
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const el = document.getElementById(`create-${id}`);
    const val = document.getElementById(`${id}-val`);
    if (el && val) {
        el.addEventListener('input', () => {
            val.innerText = el.value;
        });
    }
});

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            applyLocalization();
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
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const mapSelect = document.getElementById('create-map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}" id="ld-${key}">
            <label for="ld-${key}">${key.toUpperCase()}</label>
        `;
        loadoutGrid.appendChild(div);
    }
}

function fetchLobbies() {
    // Check if GetParentResourceName is available (only in FiveM environment)
    if (typeof GetParentResourceName === 'function') {
        fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
            method: 'POST',
            body: JSON.stringify({ tab: currentTab })
        });
    }
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()}</div>
                <div class="map-name-row">${lobby.mapLabel}</div>
                <div class="lobby-host">${_T('col_name')}: ${lobby.hostName}</div>
            </div>
            <div class="player-count-box">
                <span class="count-val">${lobby.playerCount}/${lobby.maxPlayers}</span>
                <span class="count-label">PLAYERS</span>
            </div>
            <div class="lobby-actions">
                <button class="action-btn" onclick="joinLobby('${lobby.id}')">${_T('btn_join')}</button>
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

document.getElementById('btn-create-lobby-final').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('input[name="loadout"]:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts[0] || 'all', // Fallback to first selected or 'all'
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
    document.querySelector('[data-tab="ffa"]').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime === 0 ? '∞' : lobby.roundTime + ' MIN'}</p>
    `;

    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <span>${_T('team_' + p.team) || p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(playerId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: playerId })
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
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<b>${name}:</b> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

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

function updateHUD(data) {
    if (data.time) document.getElementById('hud-time').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health-fill').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo-val').innerText = data.ammo;
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

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " WINS!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>${_T('col_name')}</th><th>${_T('col_kills')}</th><th>${_T('col_deaths')}</th><th>${_T('col_kd')}</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Render Map Voting
    const voteGrid = document.getElementById('vote-grid-container');
    voteGrid.innerHTML = '';
    serverMaps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.onclick = () => {
            playSound('click');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
        };
        div.innerHTML = `
            <span>${map.label.toUpperCase()}</span>
        `;
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

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        (currentTab === 'ffa' || currentTab === 'lobby')) {
        fetchLobbies();
    }
}, 5000);
