let currentLobby = null;
let isHost = false;
let myPlayerId = null;
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

// Localization Helper
function applyLocalization(localeData) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (localeData[key]) {
            if (el.tagName === 'INPUT' && el.getAttribute('placeholder')) {
                el.setAttribute('placeholder', localeData[key]);
            } else {
                el.innerText = localeData[key];
            }
        }
    });
}

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = btn.dataset.tab;

        if (currentTab === 'create') {
            document.getElementById('browser-view').classList.remove('active');
            document.getElementById('create-view').classList.add('active');
        } else {
            document.getElementById('create-view').classList.remove('active');
            document.getElementById('browser-view').classList.add('active');
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
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            myPlayerId = data.myId;
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            applyLocalization(data.config.Locales[data.config.Locale]);
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
            document.getElementById('game-hud').style.display = 'block';
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
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Fill Map Selects
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';

    // Clear filter but keep "All Maps"
    const allOption = filterMaps.querySelector('option[value="all"]');
    filterMaps.innerHTML = '';
    filterMaps.appendChild(allOption);

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);

        const filterOpt = document.createElement('option');
        filterOpt.value = map.id;
        filterOpt.innerText = map.label.toUpperCase();
        filterMaps.appendChild(filterOpt);
    });

    // Fill Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    const filterWeapons = document.getElementById('filter-weapons');
    loadoutSelect.innerHTML = '';

    const allWeapOption = filterWeapons.querySelector('option[value="all"]');
    filterWeapons.innerHTML = '';
    filterWeapons.appendChild(allWeapOption);

    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);

        const filterOpt = document.createElement('option');
        filterOpt.value = key;
        filterOpt.innerText = key.toUpperCase();
        filterWeapons.appendChild(filterOpt);
    }
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({
            tab: currentTab,
            map: document.getElementById('filter-maps').value,
            weapon: document.getElementById('filter-weapons').value,
            players: document.getElementById('filter-players').value
        })
    });
}

// Add event listeners for filters
['filter-maps', 'filter-weapons', 'filter-players'].forEach(id => {
    document.getElementById(id).addEventListener('change', fetchLobbies);
});

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;

        let status = lobby.status || 'waiting';
        let strokeColor = '#00ff88';
        if (status === 'ACTIVE') strokeColor = '#00d4ff';
        else if (percent > 80) strokeColor = '#ff9500';

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        const mapImg = `assets/${lobby.mapId}.png`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}" onerror="this.src='https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}
                </div>
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
            <div class="mode-icon">
                <i class="fa-solid fa-user-group"></i>
            </div>
            <div class="status-badge status-${status.toLowerCase()}">${status}</div>
            <div class="action-area">
                ${renderActionButton(lobby)}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>FULL</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">JOIN</button>`;
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

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'all',
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

document.getElementById('btn-reset-form').addEventListener('click', () => {
    playSound('click');
    // Reset to defaults or just switch back
    document.querySelector('[data-tab="ffa"]').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
        <p>LOADOUT: ${Array.isArray(lobby.loadout) ? lobby.loadout.join(', ').toUpperCase() : lobby.loadout.toUpperCase()}</p>
    `;

    // Clear chat
    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;

        let teamLabel = p.team.toUpperCase();
        if (p.team === 'none') teamLabel = '---';

        div.innerHTML = `
            <div class="player-info">
                <span class="player-name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown host-icon"></i>' : ''}</span>
                <span class="player-team team-${p.team}">${teamLabel}</span>
            </div>
            <div class="player-actions">
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
                ${p.ready ? '<i class="fa-solid fa-check ready-icon"></i>' : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (isHost) {
        const allReady = players.every(p => p.ready);
        document.getElementById('btn-start-game').disabled = players.length < 2 || !allReady;
    }
}

function kickPlayer(playerId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: playerId })
    });
}

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
    document.getElementById('lobby-waiting-area').style.display = 'none';
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
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    const isSystem = name === 'SYSTEM';
    div.innerHTML = `<span class="chat-name ${isSystem ? 'system' : ''}">${name}:</span> <span class="chat-body">${message}</span>`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// HUD Functions
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;

    if (data.mode === 'tdm') {
        document.getElementById('tdm-score-box').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('tdm-score-box').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) {
        document.getElementById('hud-health-fill').style.width = data.health + '%';
    }
    if (data.armor !== undefined) {
        document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    }
    if (data.ammo !== undefined) {
        document.getElementById('hud-ammo').innerText = data.ammo;
    }
}

function showCountdown(seconds) {
    const el = document.getElementById('countdown-display');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'flex';
    } else {
        el.style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('app').style.display = 'flex'; // Ensure app container is visible
    document.getElementById('winner-screen').style.display = 'flex';

    // Hide other views to avoid overlap
    document.getElementById('browser-view').classList.remove('active');
    document.getElementById('create-view').classList.remove('active');
    document.getElementById('lobby-waiting-area').style.display = 'none';

    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('browser-view').classList.add('active');
    document.querySelector('[data-tab="ffa"]').click();
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
        document.getElementById('winner-screen').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
