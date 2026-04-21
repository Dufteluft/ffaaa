let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let mapVotes = {};

// UI Elements
const app = document.getElementById('app');
const lobbyBrowser = document.getElementById('tab-browser');
const createLobbyPanel = document.getElementById('tab-create');
const lobbyWaitingArea = document.getElementById('lobby-waiting-area');
const winnerScreen = document.getElementById('winner-screen');
const gameHUD = document.getElementById('game-hud');

// Tab Buttons
const tabs = {
    'ffa': document.getElementById('tab-ffa-btn'),
    'create': document.getElementById('tab-create-btn'),
    'list': document.getElementById('tab-list-btn')
};

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

// Tab Switching Logic
Object.keys(tabs).forEach(tabKey => {
    tabs[tabKey].addEventListener('click', () => {
        if (currentTab === tabKey) return;
        playSound('click');

        // Update UI
        Object.values(tabs).forEach(btn => btn.classList.remove('active'));
        tabs[tabKey].classList.add('active');

        if (tabKey === 'create') {
            lobbyBrowser.style.display = 'none';
            createLobbyPanel.style.display = 'block';
        } else {
            createLobbyPanel.style.display = 'none';
            lobbyBrowser.style.display = 'block';
            currentTab = tabKey;
            fetchLobbies();
        }
    });
});

// Slider Sync
function setupSlider(id) {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
}
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            app.style.display = 'flex';
            setupInitialData(data.config, data.maps);
            if (!data.isInGame) fetchLobbies();
            break;
        case 'close':
            app.style.display = 'none';
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
        case 'gameStarting':
            app.style.display = 'none';
            lobbyWaitingArea.style.display = 'none';
            playSound('start');
            break;
        case 'showHUD':
            gameHUD.style.display = 'block';
            document.getElementById('hud-team-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            gameHUD.style.display = 'none';
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
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Setup Maps Dropdown
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    // Setup Loadout Checkboxes (Multi-Select)
    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const label = config.WeaponLoadouts[key].label || key.toUpperCase();
        const div = document.createElement('div');
        div.className = 'loadout-option';
        div.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}" id="ld-${key}">
            <label for="ld-${key}">${label}</label>
        `;
        loadoutGrid.appendChild(div);
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

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';

        const modeLabel = lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL';
        const statusClass = lobby.status === 'ACTIVE' ? 'status-active' : 'status-waiting';

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${modeLabel}</div>
                <div class="map-name-row">${lobby.mapLabel.toUpperCase()}</div>
                <div class="lobby-details">HOST: ${lobby.hostName} | SPIELER: ${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <div class="status-badge ${statusClass}">${lobby.status}</div>
            <div class="action-area">
                ${renderActionButton(lobby)}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>VOLL</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn" onclick="joinLobby('${lobby.id}')">ZUSCHAUEN</button>`;
    }
    if (lobby.isPersistent) {
        return `<button class="action-btn" onclick="quickJoin('${lobby.mapId}')">BEITRETEN</button>`;
    }
    return `<button class="action-btn" onclick="joinLobby('${lobby.id}')">BEITRETEN</button>`;
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

function quickJoin(mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/quickJoin`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

// Lobby Creation
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');

    const selectedLoadouts = [];
    document.querySelectorAll('input[name="loadout"]:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    if (selectedLoadouts.length === 0) {
        // Optionale Fehlermeldung: Wähle mindestens ein Loadout
        return;
    }

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts, // Jetzt ein Array
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

document.getElementById('btn-reset-form').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-name').value = '';
    document.querySelectorAll('input[name="loadout"]').forEach(cb => cb.checked = false);
});

// Lobby Area
function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    lobbyBrowser.style.display = 'none';
    createLobbyPanel.style.display = 'none';
    lobbyWaitingArea.style.display = 'flex';

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-item">MAP: <span>${lobby.mapLabel.toUpperCase()}</span></div>
        <div class="info-item">MODUS: <span>${lobby.mode.toUpperCase()}</span></div>
        <div class="info-item">ZEIT: <span>${lobby.roundTime} MIN</span></div>
        <div class="info-item">LIMIT: <span>${lobby.killLimit > 0 ? lobby.killLimit : 'AUS'}</span></div>
    `;

    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    const headerCount = document.getElementById('player-count-header');

    list.innerHTML = '';
    headerCount.innerText = `(${players.length}/${currentLobby.maxPlayers})`;

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;

        let teamLabel = 'KEIN TEAM';
        if (p.team === 'blue') teamLabel = 'BLAU';
        else if (p.team === 'red') teamLabel = 'ROT';
        else if (p.team === 'spectator') teamLabel = 'ZUSCHAUER';

        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 11px; opacity: 0.7;">${teamLabel}</span>
                ${isHost && !p.isHost ? `<i class="fa-solid fa-circle-xmark" style="color: var(--danger); cursor: pointer;" onclick="kickPlayer('${p.id}')"></i>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
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
    playSound('click');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    playSound('click');
    lobbyWaitingArea.style.display = 'none';
    app.style.display = 'none';
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

// Chat
function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="name">${name.toUpperCase()}:</span> <span class="text">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value.trim();
        if (msg) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-time').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-player-kills').innerText = data.kills;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health-bar').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    if (data.ammo !== undefined) {
        document.getElementById('hud-ammo-clip').innerText = data.ammo;
        document.getElementById('hud-ammo-total').innerText = data.totalAmmo || '---';
    }
}

function showCountdown(seconds) {
    const display = document.getElementById('countdown-display');
    const number = document.getElementById('countdown-number');

    if (seconds > 0) {
        display.style.display = 'flex';
        number.innerText = seconds;
    } else {
        display.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    winnerScreen.style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Render Map Voting
    const voteGrid = document.getElementById('map-vote-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'map-vote-item';
        div.id = `vote-${map.id}`;
        div.innerHTML = `
            <div class="name">${map.label.toUpperCase()}</div>
            <div class="votes" id="votes-${map.id}">0 VOTES</div>
        `;
        div.onclick = () => voteMap(map.id);
        voteGrid.appendChild(div);
    });
}

function voteMap(mapId) {
    playSound('click');
    document.querySelectorAll('.map-vote-item').forEach(el => el.classList.remove('selected'));
    document.getElementById(`vote-${mapId}`).classList.add('selected');
    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    winnerScreen.style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    winnerScreen.style.display = 'none';
    lobbyWaitingArea.style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

// Close UI on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if (app.style.display === 'flex' && lobbyBrowser.style.display === 'block') {
        fetchLobbies();
    }
}, 5000);
