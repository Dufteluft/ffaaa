let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Localization logic
function updateLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            el.innerText = locales[key].toUpperCase();
        }
    });
}

// Audio assets
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

// Tab Management
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.lobby-browser').forEach(content => content.style.display = 'none');
        document.getElementById(`tab-content-${tab}`).style.display = 'block';

        currentTab = tab;
        if (tab === 'ffa' || tab === 'list') {
            fetchLobbies();
        }
    });
});

// Slider updates
function setupSliderSync(sliderId, valId, suffix = '') {
    const slider = document.getElementById(sliderId);
    const val = document.getElementById(valId);
    if (slider && val) {
        slider.addEventListener('input', () => {
            val.innerText = slider.value + suffix;
        });
    }
}
setupSliderSync('create-round-time', 'val-round-time');
setupSliderSync('create-max-players', 'val-max-players');
setupSliderSync('create-respawn-time', 'val-respawn-time');
setupSliderSync('create-kill-limit', 'val-kill-limit');

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            myPlayerId = data.myId;
            initializeData(data.config, data.maps);
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showWaitingArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayers(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-team-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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

function initializeData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    updateLocalization(config.Locales[config.Locale]);

    // Populate selects
    const mapSelect = document.getElementById('create-map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('create-loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbies(lobbies) {
    const containerId = currentTab === 'ffa' ? 'ffa-list-container' : 'open-list-container';
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const filterFree = document.getElementById('filter-free-slots').checked;

    lobbies.forEach(lobby => {
        if (filterFree && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info">
                <div class="lobby-name">${lobby.name.toUpperCase()}</div>
                <div class="lobby-meta">
                    <span><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                    <span><i class="fa-solid fa-user"></i> ${lobby.hostName}</span>
                </div>
            </div>
            <div class="lobby-players">
                <span class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</span>
                <div class="player-bar"><div class="player-bar-fill" style="width: ${(lobby.playerCount/lobby.maxPlayers)*100}%"></div></div>
            </div>
            <div class="lobby-status-badge ${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="join-btn" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">${serverConfig.Locales[serverConfig.Locale].btn_join}</button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId, mapId) {
    playSound('click');
    if (currentTab === 'ffa') {
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

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');

    const loadoutSelect = document.getElementById('create-loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(option => option.value);

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts,
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

function showWaitingArea(lobby) {
    currentLobby = lobby;
    isHost = (myPlayerId == lobby.host);

    document.getElementById('waiting-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('waiting-lobby-id').innerText = lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-lobby-start').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-lobby-close').style.display = isHost ? 'block' : 'none';

    renderWaitingSettings(lobby);
    playSound('join');
}

function renderWaitingSettings(lobby) {
    const hostBox = document.getElementById('host-settings-controls');
    const memberBox = document.getElementById('member-settings-info');

    if (isHost && !lobby.isPersistent) {
        memberBox.style.display = 'none';
        hostBox.style.display = 'grid';

        hostBox.innerHTML = `
            <div class="s-item">
                <label>MAP</label>
                <select onchange="updateLobbySetting('mapId', this.value)">
                    ${serverMaps.map(m => `<option value="${m.id}" ${m.id === lobby.mapId ? 'selected' : ''}>${m.label}</option>`).join('')}
                </select>
            </div>
            <div class="s-item">
                <label>MODUS</label>
                <select onchange="updateLobbySetting('mode', this.value)">
                    <option value="ffa" ${lobby.mode === 'ffa' ? 'selected' : ''}>FFA</option>
                    <option value="tdm" ${lobby.mode === 'tdm' ? 'selected' : ''}>TDM</option>
                </select>
            </div>
            <div class="s-item">
                <label>TIME: ${lobby.roundTime}m</label>
                <input type="range" min="5" max="30" step="5" value="${lobby.roundTime}" onchange="updateLobbySetting('roundTime', this.value)">
            </div>
            <div class="s-item">
                <label>LIMIT: ${lobby.killLimit}</label>
                <input type="range" min="0" max="50" step="5" value="${lobby.killLimit}" onchange="updateLobbySetting('killLimit', this.value)">
            </div>
        `;
    } else {
        hostBox.style.display = 'none';
        memberBox.style.display = 'block';
        memberBox.innerHTML = `
            <div class="info-summary">
                <span>${lobby.mapLabel}</span> | <span>${lobby.mode.toUpperCase()}</span> | <span>${lobby.roundTime} MIN</span>
            </div>
        `;
    }
}

function renderPlayers(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <div class="p-name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown"></i>' : ''}</div>
            <div class="p-team">${p.team.toUpperCase()}</div>
            <div class="p-actions">
                ${isHost && !p.isHost ? `<button onclick="kickPlayer(${p.id})"><i class="fa-solid fa-user-slash"></i></button>` : ''}
            </div>
        `;
        list.appendChild(item);
    });
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

document.getElementById('btn-lobby-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-lobby-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-lobby-close').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
});

function updateLobbySetting(key, value) {
    currentLobby[key] = value;
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
        method: 'POST',
        body: JSON.stringify(currentLobby)
    });
}

document.getElementById('btn-lobby-leave').addEventListener('click', () => {
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

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    msg.innerHTML = `<span class="c-name">${name}:</span> <span class="c-text">${message}</span>`;
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

document.getElementById('waiting-chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const val = e.target.value;
        if (val.trim()) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: val })
            });
            e.target.value = '';
        }
    }
});

function showCountdown(seconds) {
    const overlay = document.getElementById('big-countdown');
    if (seconds > 0) {
        overlay.style.display = 'flex';
        overlay.querySelector('.countdown-number').innerText = seconds;
    } else {
        overlay.style.display = 'none';
    }
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-fill').style.width = data.health + '%';
    document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';

    const winsSuffix = serverConfig.Locales[serverConfig.Locale].wins_suffix || "WINS!";
    document.getElementById('winner-display-name').innerText = data.winnerName.toUpperCase() + " " + winsSuffix.toUpperCase();

    const body = document.getElementById('winner-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        body.appendChild(tr);
    });

    const voting = document.getElementById('map-voting-grid');
    voting.innerHTML = '';
    serverMaps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('selected'));
            div.classList.add('selected');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voting.appendChild(div);
    });
}

document.getElementById('btn-win-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-win-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
