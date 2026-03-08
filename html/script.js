let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let L = {}; // Localization

// Audio (Standard FiveM NUI setup)
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
function _T(key, ...args) {
    let str = L[key] || key;
    args.forEach((arg, i) => {
        str = str.replace('%s', arg);
    });
    return str;
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = btn.dataset.tab;

        // Tab Content Visibility
        if (currentTab === 'create') {
            document.getElementById('tab-content-browser').style.display = 'none';
            document.getElementById('tab-content-create').style.display = 'flex';
        } else {
            document.getElementById('tab-content-browser').style.display = 'flex';
            document.getElementById('tab-content-create').style.display = 'none';
            fetchLobbies();
        }
    });
});

// Slider Value Sync
const setupSlider = (id) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(id + '-val');
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// NUI Message Handling
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
            document.getElementById('lobby-waiting-area').style.display = 'none';
            document.getElementById('winner-screen').style.display = 'none';
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
            document.getElementById('game-hud').style.display = 'block';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-time').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health-fill').style.width = `${data.health}%`;
            document.getElementById('hud-armor-fill').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo-val').innerText = data.ammo || 0;
            break;
        case 'countdown':
            const overlay = document.getElementById('countdown-overlay');
            if (data.seconds > 0) {
                overlay.style.display = 'flex';
                document.getElementById('countdown-text').innerText = data.seconds;
            } else {
                overlay.style.display = 'none';
            }
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
    L = config.Locales[config.Locale];

    // Localize UI Static Elements
    for (let key in L) {
        const el = document.getElementById('l-' + key.replace(/_/g, '-'));
        if (el) el.innerText = L[key].toUpperCase();
    }

    // Special IDs for duplicated labels
    ['map-select-2', 'loadout-select-2', 'max-players-2'].forEach(id => {
        const base = id.replace('-2', '');
        const el = document.getElementById('l-' + id);
        if (el && L[base]) el.innerText = L[base].toUpperCase();
    });

    // Populate Selects
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';
    maps.forEach(map => {
        const opt = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
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

    const filterMap = document.getElementById('filter-maps').value;
    const filterWeapon = document.getElementById('filter-weapons').value;
    const filterPlayer = document.getElementById('filter-players').value;

    const filtered = lobbies.filter(lobby => {
        if (filterMap !== 'all' && lobby.mapId !== filterMap) return false;
        if (filterWeapon !== 'all' && lobby.loadout !== filterWeapon) return false;
        if (filterPlayer === 'not-full' && lobby.playerCount >= lobby.maxPlayers) return false;
        return true;
    });

    filtered.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;
        let strokeColor = '#00ff88';
        if (percent > 80) strokeColor = '#ff9500';

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        const mapImg = `https://via.placeholder.com/120x70/0f1419/ffffff?text=${lobby.mapLabel}`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL'}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel.toUpperCase()}</div>
                <div class="host-name" style="font-size: 11px; color: #666;">HOST: ${lobby.hostName.toUpperCase()}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="30" cy="30" r="${radius}"></circle>
                    <circle class="circle-progress" cx="30" cy="30" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${playerCount}/${maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <div class="action-area">
                ${renderActionButton(lobby)}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) return `<button class="action-btn btn-disabled" disabled>FULL</button>`;
    if (currentTab === 'ffa') {
        return `<button class="action-btn btn-join" onclick="quickJoin('${lobby.mapId}')">JOIN</button>`;
    }
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">JOIN</button>`;
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

document.getElementById('btn-create-lobby-final').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: document.getElementById('loadout-select').value,
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

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.getElementById('l-tab-ffa').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 13px; font-weight: 700; color: #a0a0a0;">
            <div>MAP: <span style="color: #fff;">${lobby.mapLabel.toUpperCase()}</span></div>
            <div>MODE: <span style="color: #fff;">${lobby.mode.toUpperCase()}</span></div>
            <div>TIME: <span style="color: #fff;">${lobby.roundTime} MIN</span></div>
            <div>KILL LIMIT: <span style="color: #fff;">${lobby.killLimit}</span></div>
        </div>
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
            <div style="display: flex; flex-direction: column;">
                <span style="font-weight: 900; font-size: 14px;">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
                <span style="font-size: 10px; color: #666;">${p.team.toUpperCase()}</span>
            </div>
            ${isHost && !p.isHost ? `<button onclick="kickPlayer('${p.id}')" style="background: none; border: none; color: #ff4444; cursor: pointer;"><i class="fa-solid fa-user-xmark"></i></button>` : ''}
            ${p.ready ? '<i class="fa-solid fa-check" style="color: #00ff88;"></i>' : '<i class="fa-solid fa-clock" style="color: #666;"></i>'}
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

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="name">${name.toUpperCase()}:</span><span class="text">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " WINS!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Render Map Voting Grid
    const voteContainer = document.getElementById('map-voting-container');
    voteContainer.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `
            <img src="https://via.placeholder.com/150x80/0f1419/ffffff?text=${map.label}">
            <div class="vote-label">${map.label.toUpperCase()}</div>
        `;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteContainer.appendChild(div);
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
    if (!currentLobby.isPersistent) {
        document.getElementById('lobby-waiting-area').style.display = 'flex';
    }
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

// Filter Listeners
document.getElementById('filter-maps').addEventListener('change', fetchLobbies);
document.getElementById('filter-weapons').addEventListener('change', fetchLobbies);
document.getElementById('filter-players').addEventListener('change', fetchLobbies);

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
