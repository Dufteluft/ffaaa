let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let config = {};
let lobbiesCache = [];

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

// Localization Helper
function applyLocalization(loc) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (loc[key]) el.textContent = loc[key];
    });
    document.querySelectorAll('[data-locale-placeholder]').forEach(el => {
        const key = el.getAttribute('data-locale-placeholder');
        if (loc[key]) el.placeholder = loc[key];
    });
}

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            config = data.config;
            document.getElementById('app').style.display = 'flex';
            applyLocalization(config.Locales[config.Locale]);
            setupCreateForm();
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            lobbiesCache = data.lobbies;
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            currentLobby = data.lobby;
            isHost = (data.action === 'lobbyCreated');
            showLobbyWaitingArea();
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
            document.getElementById('hud').style.display = 'block';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            document.getElementById('health-fill').style.width = data.health + '%';
            document.getElementById('armor-fill').style.width = data.armor + '%';
            document.getElementById('hud-ammo').textContent = data.ammo;
            break;
        case 'countdown':
            const cd = document.getElementById('hud-countdown');
            if (data.seconds > 0) {
                cd.textContent = data.seconds;
                cd.style.display = 'block';
            } else {
                cd.style.display = 'none';
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'hideHUD':
            document.getElementById('hud').style.display = 'none';
            break;
    }
});

// Tab Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = tab;
        if (tab === 'create') {
            document.getElementById('lobby-browser').style.display = 'none';
            document.getElementById('create-lobby-area').style.display = 'block';
        } else {
            document.getElementById('lobby-browser').style.display = 'block';
            document.getElementById('create-lobby-area').style.display = 'none';
            fetchLobbies();
        }
    });
});

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
        container.innerHTML = `<div class="no-lobbies">${config.Locales[config.Locale].no_lobbies}</div>`;
        return;
    }

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';

        const loc = config.Locales[config.Locale];
        const btnText = lobby.status === 'ACTIVE' ? loc.btn_spectate : loc.btn_join;
        const btnAction = currentTab === 'ffa' ? `quickJoin('${lobby.mapId}')` : `joinLobby('${lobby.id}')`;

        item.innerHTML = `
            <div class="map-icon"><i class="fa-solid fa-map"></i></div>
            <div class="info">
                <h4>${lobby.name}</h4>
                <p>${loc.host}: ${lobby.hostName} | Map: ${lobby.mapLabel}</p>
            </div>
            <div class="stats">
                <span class="players">${lobby.playerCount} / ${lobby.maxPlayers}</span>
                <span class="mode">${lobby.mode}</span>
            </div>
            <button class="action-btn btn-join" onclick="${btnAction}">${btnText}</button>
        `;
        container.appendChild(item);
    });
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

// Create Lobby Logic
function setupCreateForm() {
    const mapSelect = document.getElementById('create-map-select');
    mapSelect.innerHTML = '';
    config.Maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.textContent = map.label;
        mapSelect.appendChild(opt);
    });

    const loadoutGrid = document.getElementById('create-loadout-grid');
    loadoutGrid.innerHTML = '';
    for (const [key, value] of Object.entries(config.WeaponLoadouts)) {
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}" id="loadout-${key}">
            <label for="loadout-${key}">${value.label}</label>
        `;
        loadoutGrid.appendChild(div);
    }
}

document.getElementById('create-round-time').addEventListener('input', (e) => {
    document.getElementById('round-time-val').textContent = e.target.value;
});

document.getElementById('create-max-players').addEventListener('input', (e) => {
    document.getElementById('max-players-val').textContent = e.target.value;
});

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
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
    playSound('click');
    document.querySelector('[data-tab="ffa"]').click();
});

// Waiting Area Logic
function showLobbyWaitingArea() {
    playSound('join');
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-title').textContent = currentLobby.name.toUpperCase();

    const loc = config.Locales[config.Locale];
    document.getElementById('lobby-settings-summary').innerHTML = `
        <p><b>Map:</b> ${currentLobby.mapLabel}</p>
        <p><b>Mode:</b> ${currentLobby.mode === 'tdm' ? loc.mode_tdm : loc.mode_ffa}</p>
        <p><b>Time:</b> ${currentLobby.roundTime} Min</p>
        <p><b>Kill Limit:</b> ${currentLobby.killLimit}</p>
    `;

    document.getElementById('btn-start').style.display = isHost ? 'block' : 'none';
    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;

        let kickBtn = '';
        if (isHost && !p.isHost) {
            kickBtn = `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>`;
        }

        item.innerHTML = `
            <span>${p.name} ${p.isHost ? '<b>(HOST)</b>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${kickBtn}
        `;
        container.appendChild(item);
    });

    if (isHost) {
        document.getElementById('btn-start').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

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

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

function addChatMessage(name, msg) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<b>${name}:</b> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// HUD Logic
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').textContent = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').textContent = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').textContent = data.deaths;

    const scoreEl = document.getElementById('hud-team-score');
    if (data.mode === 'tdm') {
        scoreEl.style.display = 'block';
        if (data.scoreBlue !== undefined) scoreEl.querySelector('.score-blue').textContent = data.scoreBlue;
        if (data.scoreRed !== undefined) scoreEl.querySelector('.score-red').textContent = data.scoreRed;
    } else {
        scoreEl.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').textContent = data.winnerName;

    const table = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    table.innerHTML = html;

    const votingGrid = document.getElementById('map-voting-grid');
    votingGrid.innerHTML = '';
    config.Maps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'map-vote-item';
        div.innerHTML = `<span>${map.label}</span>`;
        div.onclick = () => {
            playSound('click');
            document.querySelectorAll('.map-vote-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        votingGrid.appendChild(div);
    });
}

document.getElementById('btn-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.querySelector('[data-tab="ffa"]').click();
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// ESC to close
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto refresh lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-browser').style.display !== 'none') {
        fetchLobbies();
    }
}, 5000);
