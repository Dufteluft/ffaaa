let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let activeTab = 'ffa';
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

// Localization Helper
function _T(key) {
    if (serverConfig.Locales && serverConfig.Locales[serverConfig.Locale] && serverConfig.Locales[serverConfig.Locale][key]) {
        return serverConfig.Locales[serverConfig.Locale][key];
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
        const targetTab = btn.getAttribute('data-tab');
        if (targetTab === activeTab) return;

        playSound('click');

        // Update Buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Update Content
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${targetTab}`).classList.add('active');

        activeTab = targetTab;

        if (activeTab === 'ffa' || activeTab === 'lobby') {
            fetchLobbies();
        }
    });
});

// Create Form Logic
function initCreateForm() {
    const mapSelect = document.getElementById('select-map');
    mapSelect.innerHTML = '';
    serverMaps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    const loadoutContainer = document.getElementById('loadout-checkboxes');
    loadoutContainer.innerHTML = '';
    for (const key in serverConfig.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'loadout-option';
        div.innerHTML = `
            <input type="checkbox" id="ld-${key}" value="${key}" name="loadouts">
            <label for="ld-${key}">${key.toUpperCase()}</label>
        `;
        loadoutContainer.appendChild(div);
    }

    // Range synchronization
    const ranges = ['time', 'players', 'respawn', 'kills'];
    ranges.forEach(r => {
        const input = document.getElementById(`range-${r}`);
        const span = document.getElementById(`val-${r}`);
        input.addEventListener('input', () => {
            span.innerText = input.value;
        });
    });
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const name = document.getElementById('input-lobby-name').value;
    const mapId = document.getElementById('select-map').value;
    const mode = document.getElementById('select-mode').value;
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadouts"]:checked')).map(cb => cb.value);

    if (!name || selectedLoadouts.length === 0) return;

    const settings = {
        name: name,
        mapId: mapId,
        mode: mode,
        loadout: selectedLoadouts, // Support array
        roundTime: parseInt(document.getElementById('range-time').value),
        maxPlayers: parseInt(document.getElementById('range-players').value),
        vehiclesAllowed: document.getElementById('check-vehicles').checked,
        friendlyFire: document.getElementById('check-fire').checked,
        respawnTime: parseInt(document.getElementById('range-respawn').value),
        killLimit: parseInt(document.getElementById('range-kills').value)
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

// Lobby Browsing
function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: activeTab })
    });
}

function renderLobbies(lobbies) {
    const listId = activeTab === 'ffa' ? 'ffa-list' : 'open-list';
    const container = document.getElementById(listId);
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-card-item';
        div.innerHTML = `
            <div class="lobby-card-info">
                <h3>${lobby.name}</h3>
                <div class="lobby-card-details">
                    <span><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                    <span><i class="fa-solid fa-user"></i> ${lobby.hostName}</span>
                </div>
            </div>
            <div class="lobby-card-footer">
                <span class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</span>
                <button class="btn-join-lobby" onclick="joinLobby('${lobby.id}')">${_T('btn_join')}</button>
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

// Waiting Area Logic
function updateWaitingArea(lobby, players) {
    currentLobby = lobby;
    document.getElementById('wait-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('wait-map').innerText = `MAP: ${lobby.mapLabel.toUpperCase()}`;
    document.getElementById('wait-mode').innerText = `MODE: ${lobby.mode.toUpperCase()}`;

    const playerList = document.getElementById('wait-player-list');
    playerList.innerHTML = '';

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown"></i>' : ''}</span>
            <div class="player-meta">
                <span class="p-team">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
        playerList.appendChild(item);
    });

    document.getElementById('btn-start').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = (isHost && !lobby.isPersistent) ? 'block' : 'none';

    if (isHost) {
        document.getElementById('btn-start').disabled = players.length < 1; // Allow 1 for persistent test
    }
}

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';

    // Switch to create tab and pre-fill
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="create"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-create').classList.add('active');
    activeTab = 'create';

    if (currentLobby) {
        document.getElementById('input-lobby-name').value = currentLobby.name;
        document.getElementById('select-map').value = currentLobby.mapId;
        document.getElementById('select-mode').value = currentLobby.mode;
        document.getElementById('range-time').value = currentLobby.roundTime;
        document.getElementById('val-time').innerText = currentLobby.roundTime;
        document.getElementById('range-players').value = currentLobby.maxPlayers;
        document.getElementById('val-players').innerText = currentLobby.maxPlayers;
        document.getElementById('check-vehicles').checked = currentLobby.vehiclesAllowed;
        document.getElementById('check-fire').checked = currentLobby.friendlyFire;
        document.getElementById('range-respawn').value = currentLobby.respawnTime;
        document.getElementById('val-respawn').innerText = currentLobby.respawnTime;
        document.getElementById('range-kills').value = currentLobby.killLimit;
        document.getElementById('val-kills').innerText = currentLobby.killLimit;

        // Select loadouts
        document.querySelectorAll('input[name="loadouts"]').forEach(cb => {
            cb.checked = Array.isArray(currentLobby.loadout) ? currentLobby.loadout.includes(cb.value) : currentLobby.loadout === cb.value;
        });
    }
});

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

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

// NUI Messages
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            serverConfig = data.config;
            serverMaps = data.maps;
            applyLocalization();
            initCreateForm();
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
            isHost = true;
            document.getElementById('lobby-waiting-area').style.display = 'flex';
            break;
        case 'lobbyJoined':
            isHost = false;
            document.getElementById('lobby-waiting-area').style.display = 'flex';
            break;
        case 'updateLobbyPlayers':
            updateWaitingArea(currentLobby || {}, data.players);
            break;
        case 'addChatMessage':
            const msgBox = document.getElementById('chat-messages');
            const msg = document.createElement('div');
            msg.innerHTML = `<strong>${data.name}:</strong> ${data.message}`;
            msgBox.appendChild(msg);
            msgBox.scrollTop = msgBox.scrollHeight;
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
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health').style.width = `${data.health}%`;
            document.getElementById('hud-armor').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'countdown':
            // Logic for visual countdown if needed
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-text').innerText = `GEWINNER: ${data.winnerName.toUpperCase()}`;

    const scoreboard = document.getElementById('end-scoreboard');
    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    scoreboard.innerHTML = html;

    // Map Voting
    const voteGrid = document.getElementById('map-votes');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = map.label;
        btn.onclick = () => {
            playSound('click');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
            btn.classList.add('voted');
        };
        voteGrid.appendChild(btn);
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
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// Chat Input
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

// Close UI on Escape
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
