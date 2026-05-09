let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
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
function _U(key) {
    const locale = serverConfig.Locale || 'de';
    if (serverConfig.Locales && serverConfig.Locales[locale] && serverConfig.Locales[locale][key]) {
        return serverConfig.Locales[locale][key];
    }
    return key;
}

function applyLocalization() {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        el.innerText = _U(key);
    });
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        currentTab = btn.dataset.tab;

        if (currentTab === 'create') {
            document.getElementById('tab-create').classList.add('active');
        } else {
            document.getElementById('tab-browser').classList.add('active');
            fetchLobbies();
        }
    });
});

// Slider Value Sync
const syncSlider = (id) => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (el && val) {
        el.addEventListener('input', () => { val.innerText = el.value; });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(syncSlider);

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            if (data.config) {
                serverConfig = data.config;
                setupInitialData(data.config, data.maps);
                applyLocalization();
            }
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
            showLobbyArea(data.lobby, data.action === 'lobbyCreated');
            break;

        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;

        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;

        case 'countdown':
            handleCountdown(data.seconds);
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
            if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
            break;

        case 'updateHUDDetails':
            document.getElementById('hud-health-fill').style.width = `${data.health}%`;
            document.getElementById('hud-armor-fill').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo').innerText = data.ammo !== undefined ? data.ammo : '--';
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
    // Map Selector
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt.cloneNode(true));
        filterMaps.appendChild(opt);
    });

    // Loadout Checkboxes
    const container = document.getElementById('loadout-checkboxes');
    container.innerHTML = '';
    for (const [key, weapons] of Object.entries(config.WeaponLoadouts)) {
        const label = document.createElement('label');
        label.className = 'check-item';
        label.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}">
            <div class="check-box"></div>
            <span>${key.toUpperCase()}</span>
        `;
        container.appendChild(label);
    }

    // Map Voting Grid
    const voteGrid = document.getElementById('map-voting-grid');
    voteGrid.innerHTML = '';
    maps.slice(0, 4).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        div.innerHTML = `<h5>${map.label}</h5>`;
        voteGrid.appendChild(div);
    });
}

function fetchLobbies() {
    // Don't fetch if not on a lobby tab
    if (currentTab === 'create') return;

    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
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

        const isFull = lobby.playerCount >= lobby.maxPlayers;

        div.innerHTML = `
            <div class="match-type-icon">
                <i class="fa-solid ${lobby.mode === 'tdm' ? 'fa-people-group' : 'fa-user-ninja'}"></i>
            </div>
            <div class="lobby-info">
                <h4>${lobby.name}</h4>
                <p>${lobby.mapLabel} • ${lobby.mode.toUpperCase()} • ${lobby.hostName}</p>
            </div>
            <div class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <button class="action-btn ${isFull ? 'btn-full' : 'btn-join'}"
                ${isFull ? 'disabled' : ''}
                onclick="joinLobby('${lobby.id}')">
                ${isFull ? 'FULL' : 'JOIN'}
            </button>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    // Check if it's a persistent lobby (Tab 1)
    const lobby = lobbiesCache.find(l => l.id === lobbyId);
    if (lobby && lobby.isPersistent) {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: lobby.mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobbyId })
        });
    }
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('input[name="loadout"]:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA MATCH',
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

    fetch(`https://${GetParentResourceName()}/createLobby`, {
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

    // TDM check
    document.getElementById('team-selector-box').style.display = lobby.mode === 'tdm' ? 'flex' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>LIMIT: ${lobby.killLimit > 0 ? lobby.killLimit : '∞'}</p>
    `;
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()}</span>
            <div style="display: flex; gap: 10px; align-items: center;">
                <span style="font-size: 10px; opacity: 0.6;">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')" style="background:none;border:none;color:var(--danger);cursor:pointer;"><i class="fa-solid fa-x"></i></button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
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

function handleCountdown(seconds) {
    const el = document.getElementById('countdown-display');
    const txt = document.getElementById('countdown-text');

    if (seconds > 0) {
        el.style.display = 'block';
        txt.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<span style="color:var(--primary);font-weight:900;">${name}:</span> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;
}

document.getElementById('btn-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(fetchLobbies, 5000);
