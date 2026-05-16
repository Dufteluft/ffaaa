let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let mapVotes = {};

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
        const targetTab = btn.dataset.tab;
        if (targetTab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));

        if (targetTab === 'ffa' || targetTab === 'lobby') {
            document.getElementById('tab-browser').classList.add('active');
            currentTab = targetTab;
            fetchLobbies();
        } else if (targetTab === 'create') {
            document.getElementById('tab-create').classList.add('active');
            currentTab = targetTab;
        }
    });
});

// Slider Value Updates
const setupSlider = (id) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            if (data.config) setupInitialData(data.config, data.maps);
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
            document.getElementById('hud-team-scores').style.display = data.isTDM ? 'flex' : 'none';
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

    // Apply Localization
    applyLocalization();

    // Populate Maps
    const mapSelect = document.getElementById('map-select');
    const filterMap = document.getElementById('filter-map');
    mapSelect.innerHTML = '';
    filterMap.innerHTML = '<option value="all">Alle Maps</option>';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt.cloneNode(true));
        filterMap.appendChild(opt);
    });

    // Populate Loadouts (Checkboxes)
    const loadoutContainer = document.getElementById('loadout-options');
    loadoutContainer.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}" id="loadout-${key}">
            <label for="loadout-${key}">${key.toUpperCase()}</label>
        `;
        loadoutContainer.appendChild(div);
    }
}

function applyLocalization() {
    const locale = serverConfig.Locales[serverConfig.Locale];
    if (!locale) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locale[key]) {
            el.innerText = locale[key];
        }
    });
}

function fetchLobbies() {
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} |
                    <i class="fa-solid fa-user"></i> ${lobby.hostName}
                </div>
            </div>
            <div class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="action-area">
                <button class="btn-primary" onclick="joinLobby('${lobby.id}')">${serverConfig.Locales[serverConfig.Locale]['btn_join']}</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

// Create Lobby
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'Meine Lobby',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadouts: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked
    };

    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
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
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    updateLobbySummary(lobby);
}

function updateLobbySummary(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <p><strong>MAP:</strong> ${lobby.mapLabel}</p>
        <p><strong>MODE:</strong> ${lobby.mode.toUpperCase()}</p>
        <p><strong>TIME:</strong> ${lobby.roundTime} MIN</p>
        <p><strong>LIMIT:</strong> ${lobby.killLimit > 0 ? lobby.killLimit : '∞'}</p>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            <div class="player-actions">
                <span class="team-badge team-${p.team}">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="icon-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2 && !currentLobby.isPersistent;
    }
}

function kickPlayer(id) {
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    playSound('start');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/leaveLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
        fetch(`https://${resourceName}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name">${name}:</span><span class="chat-text">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('btn-send-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (msg.length > 0) {
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
        fetch(`https://${resourceName}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: msg })
        });
        input.value = '';
    }
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('game-countdown');
    if (seconds > 0) {
        el.style.display = 'block';
        el.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName;

    const tbody = document.getElementById('winner-stats-body');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });

    renderMapVoting();
}

function renderMapVoting() {
    const container = document.getElementById('map-vote-container');
    container.innerHTML = '';
    // Show 3 random maps for voting
    const shuffled = [...serverMaps].sort(() => 0.5 - Math.random());
    shuffled.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'map-vote-item';
        div.innerHTML = `
            <span class="map-label">${map.label}</span>
            <span class="vote-count" id="vote-count-${map.id}">0 Votes</span>
        `;
        div.onclick = () => voteMap(map.id);
        container.appendChild(div);
    });
}

function voteMap(mapId) {
    playSound('click');
    document.querySelectorAll('.map-vote-item').forEach(el => el.classList.remove('active'));
    event.currentTarget.classList.add('active');

    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

document.getElementById('btn-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
    fetch(`https://${resourceName}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa';
        fetch(`https://${resourceName}/closeUI`, { method: 'POST' });
    }
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
