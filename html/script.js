let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';

// Maps and Config from Server
let serverMaps = [];
let serverConfig = {};

// Audio setup
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

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            switchTab(currentTab);
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
            updateGameplayHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDBars(data);
            break;
        case 'countdown':
            showBigCountdown(data.seconds);
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

    // Set UI Titles
    document.getElementById('ui-menu-title').innerText = config.Locales[config.Locale]['menu_title'];
    document.getElementById('tab-ffa-label').innerText = config.Locales[config.Locale]['tab_ffa'];
    document.getElementById('tab-create-label').innerText = config.Locales[config.Locale]['tab_create'];
    document.getElementById('tab-list-label').innerText = config.Locales[config.Locale]['tab_list'];

    // Fill Map Selects
    const mapSelect = document.getElementById('map-select');
    const filterMapSelect = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMapSelect.innerHTML = '<option value="all">ALL MAPS</option>';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt.cloneNode(true));
        filterMapSelect.appendChild(opt);
    });

    // Fill Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }
}

// Tab Management
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    document.getElementById('tab-browser').style.display = (tab === 'ffa' || tab === 'list') ? 'flex' : 'none';
    document.getElementById('tab-create').style.display = (tab === 'create') ? 'flex' : 'none';

    document.getElementById('filter-free-slots-container').style.display = (tab === 'list') ? 'block' : 'none';

    if (tab === 'ffa' || tab === 'list') {
        fetchLobbies();
    }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        switchTab(btn.dataset.tab);
    });
});

// Form and Sliders
const sliders = ['round-time', 'max-players', 'respawn-time', 'kill-limit'];
sliders.forEach(id => {
    const slider = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    slider.addEventListener('input', () => {
        val.innerText = slider.value;
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

    const freeSlotsOnly = document.getElementById('filter-free-slots').checked;
    const selectedMap = document.getElementById('filter-maps').value;

    lobbies.forEach((lobby, index) => {
        // Filters
        if (selectedMap !== 'all' && lobby.mapId !== selectedMap) return;
        if (freeSlotsOnly && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel.toUpperCase()} | HOST: ${lobby.hostName.toUpperCase()}
                </div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">
                    ${lobby.status === 'ACTIVE' ? 'ZUSCHAUEN' : 'BEITRETEN'}
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId, mapId) {
    playSound('click');
    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId })
        });
    }
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
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

// Lobby Area
function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('display-lobby-id').innerText = lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    document.getElementById('team-selection-area').style.display = lobby.mode === 'tdm' ? 'flex' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="summary-item"><span>MAP:</span> ${lobby.mapLabel.toUpperCase()}</div>
        <div class="summary-item"><span>MODUS:</span> ${lobby.mode.toUpperCase()}</div>
        <div class="summary-item"><span>ZEIT:</span> ${lobby.roundTime > 0 ? lobby.roundTime + ' MIN' : '∞'}</div>
        <div class="summary-item"><span>LOADOUT:</span> ${lobby.loadout.toUpperCase()}</div>
        <div class="summary-item"><span>KILL-LIMIT:</span> ${lobby.killLimit > 0 ? lobby.killLimit : 'AUS'}</div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span class="player-team-label">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
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

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
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

// HUD & Game Logic
function updateGameplayHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDBars(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = `${data.health}%`;
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = `${data.armor}%`;
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function showBigCountdown(seconds) {
    const el = document.getElementById('big-countdown');
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
    document.getElementById('game-hud').style.display = 'none';

    let winnerText = data.winnerName;
    if (data.winnerName === 'none') {
        winnerText = serverConfig.Locales[serverConfig.Locale]['draw'];
    }
    document.getElementById('winner-name-text').innerText = winnerText.toUpperCase() + " GEWINNT!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Render Map Voting
    const voteGrid = document.getElementById('map-vote-options');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `<span>${map.label.toUpperCase()}</span>`;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
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
    if (currentLobby && !currentLobby.isPersistent) {
        document.getElementById('lobby-waiting-area').style.display = 'flex';
    }
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

// Utility
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
