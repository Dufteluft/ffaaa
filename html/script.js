let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

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
        document.getElementById(`tab-${tab}-content`).classList.add('active');

        currentTab = tab;
        if (tab === 'lobby' || tab === 'ffa') {
            fetchLobbies();
        }
    });
});

// Slider Sync
const setupSlider = (id) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
setupSlider('create-round-time');
setupSlider('create-max-players');
setupSlider('create-respawn-time');
setupSlider('create-kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            applyLocalization(data.config.Locales[data.config.Locale]);
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            if (currentTab === 'ffa') {
                renderPredefinedLobbies(data.lobbies);
            } else if (currentTab === 'lobby') {
                renderOpenLobbies(data.lobbies);
            }
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby, data.action === 'lobbyCreated' || data.lobby.host == -1); // host -1 is system, but if we join we aren't host unless it's handled differently
            // Actually host logic should be server-driven
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
            document.getElementById('hud-team-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health-fill').style.width = `${data.health}%`;
            document.getElementById('hud-armor-fill').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo-val').innerText = data.ammo;
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'countdown':
            // Logic for countdown display if needed, otherwise handled in client
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locales[key]) {
            el.innerText = locales[key];
        }
    });
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Fill Map Select
    const mapSelect = document.getElementById('create-map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    // Fill Loadout List
    const loadoutList = document.getElementById('create-loadout-list');
    loadoutList.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="checkbox" id="loadout-${key}" value="${key}" ${key === 'all' ? 'checked' : ''}>
            <label for="loadout-${key}">${key.toUpperCase()}</label>
        `;
        loadoutList.appendChild(div);
    }
}

function fetchLobbies() {
    if (typeof GetParentResourceName === 'undefined') return;
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderPredefinedLobbies(lobbies) {
    const container = document.getElementById('ffa-predefined-list');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-card-mini';
        div.innerHTML = `
            <div class="lobby-card-image" style="background-image: url('assets/${lobby.mapId}.png'), url('https://via.placeholder.com/300x150/1a1f2e/ffffff?text=${lobby.mapLabel}')"></div>
            <div class="lobby-card-info">
                <h3>${lobby.mapLabel}</h3>
                <p>${lobby.playerCount} / ${lobby.maxPlayers} Players</p>
                <button class="btn-primary" onclick="quickJoin('${lobby.mapId}')">SOFORT BEITRETEN</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderOpenLobbies(lobbies) {
    const tbody = document.getElementById('open-lobbies-list');
    tbody.innerHTML = '';

    lobbies.forEach(lobby => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lobby.name}</td>
            <td>${lobby.hostName}</td>
            <td>${lobby.playerCount} / ${lobby.maxPlayers}</td>
            <td>${lobby.mapLabel}</td>
            <td>${lobby.mode.toUpperCase()}</td>
            <td><button class="btn-table-join" onclick="joinLobby('${lobby.id}')">BEITRETEN</button></td>
        `;
        tbody.appendChild(tr);
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

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('#create-loadout-list input:checked').forEach(i => selectedLoadouts.push(i.value));

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts[0] || 'all', // For now take first, or adjust server to handle array
        roundTime: parseInt(document.getElementById('create-round-time').value),
        maxPlayers: parseInt(document.getElementById('create-max-players').value),
        vehiclesAllowed: document.getElementById('create-vehicles-allowed').checked,
        friendlyFire: document.getElementById('create-friendly-fire').checked,
        respawnTime: parseInt(document.getElementById('create-respawn-time').value),
        killLimit: parseInt(document.getElementById('create-kill-limit').value)
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function showLobbyArea(lobby, hostFlag) {
    currentLobby = lobby;
    isHost = hostFlag;
    playSound('join');

    document.getElementById('lobby-title-display').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = isHost ? 'block' : 'none';

    updateLobbyInfoSummary(lobby);
}

function updateLobbyInfoSummary(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-item"><span>MAP:</span> <strong>${lobby.mapLabel}</strong></div>
        <div class="info-item"><span>MODE:</span> <strong>${lobby.mode.toUpperCase()}</strong></div>
        <div class="info-item"><span>LOADOUT:</span> <strong>${lobby.loadout.toUpperCase()}</strong></div>
        <div class="info-item"><span>TIME:</span> <strong>${lobby.roundTime} MIN</strong></div>
        <div class="info-item"><span>LIMIT:</span> <strong>${lobby.killLimit > 0 ? lobby.killLimit : '∞'} KILLS</strong></div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';

    // Check if I am host (search for me in players)
    // Actually the server should tell us if we are host, but we can infer

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <div class="p-info">
                <span class="p-name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown"></i>' : ''}</span>
                <span class="p-team team-${p.team}">${p.team.toUpperCase()}</span>
            </div>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        const readyCount = players.filter(p => p.ready).length;
        document.getElementById('btn-start-game').disabled = readyCount < 2 && !currentLobby.isPersistent;
    }
}

function kickPlayer(id) {
    playSound('click');
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

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
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

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName.toUpperCase();

    const container = document.getElementById('match-stats-table-container');
    let html = `<table class="stats-table"><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    container.innerHTML = html;

    // Render Map Voting
    const voteGrid = document.getElementById('map-vote-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.onclick = () => voteMap(map.id, div);
        div.innerHTML = `
            <div class="vote-img" style="background-image: url('assets/${map.id}.png'), url('https://via.placeholder.com/150x80/1a1f2e/ffffff?text=${map.label}')"></div>
            <span>${map.label}</span>
            <div class="vote-count" id="vote-count-${map.id}">0</div>
        `;
        voteGrid.appendChild(div);
    });
}

function voteMap(mapId, el) {
    playSound('click');
    document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('voted'));
    el.classList.add('voted');
    const countEl = document.getElementById(`vote-count-${mapId}`);
    countEl.innerText = parseInt(countEl.innerText) + 1;

    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
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

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    // Fill create form with current settings and switch tab
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.querySelector('[data-tab="create"]').click();

    // Pre-fill
    document.getElementById('create-lobby-name').value = currentLobby.name;
    document.getElementById('create-map-select').value = currentLobby.mapId;
    document.getElementById('create-mode-select').value = currentLobby.mode;
    document.getElementById('create-round-time').value = currentLobby.roundTime;
    document.getElementById('create-max-players').value = currentLobby.maxPlayers;
    document.getElementById('create-vehicles-allowed').checked = currentLobby.vehiclesAllowed;
    document.getElementById('create-friendly-fire').checked = currentLobby.friendlyFire;
    document.getElementById('create-respawn-time').value = currentLobby.respawnTime;
    document.getElementById('create-kill-limit').value = currentLobby.killLimit;

    // Trigger input events to update spans
    document.querySelectorAll('#tab-create-content input[type="range"]').forEach(i => i.dispatchEvent(new Event('input')));
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('app').style.display === 'flex') {
            fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
        }
    }
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
