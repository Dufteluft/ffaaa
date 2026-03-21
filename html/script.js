let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let playerStats = {};

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

        // Toggle Sidebar visibility for Tab 3
        document.getElementById('sidebar-filters').style.display = (tab === 'list') ? 'flex' : 'none';

        // Toggle Views
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        if (tab === 'create') {
            document.getElementById('view-create-lobby').classList.add('active');
        } else {
            document.getElementById('view-lobby-list').classList.add('active');
            currentTab = tab;
            fetchLobbies();
        }
    });
});

document.getElementById('open-create-view').addEventListener('click', () => {
    document.querySelector('[data-tab="create"]').click();
});

// Slider Value Sync
const syncSlider = (id) => {
    const slider = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (slider && val) {
        slider.addEventListener('input', () => {
            val.innerText = slider.value + (id === 'respawn-time' ? 's' : '');
            if (isHost && currentLobby) updateHostSettings();
        });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(syncSlider);

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
            document.getElementById('game-hud').style.display = 'flex';
            document.getElementById('hud-team-score-container').style.display = (data.mode === 'tdm') ? 'flex' : 'none';
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
        case 'updateVotes':
            updateMapVotes(data.votes);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Fill Map Selects
    const fillMapSelect = (id) => {
        const select = document.getElementById(id);
        if (!select) return;
        select.innerHTML = '';
        maps.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.innerText = m.label.toUpperCase();
            select.appendChild(opt);
        });
    };
    fillMapSelect('map-select');
    fillMapSelect('wait-map-select');
    fillMapSelect('filter-maps');

    // Fill Loadout Checkboxes
    const loadoutGrid = document.getElementById('loadout-grid');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'weapon-check-item';
        div.innerHTML = `
            <input type="checkbox" id="loadout-${key}" value="${key}" checked>
            <label for="loadout-${key}">${key.toUpperCase()}</label>
        `;
        loadoutGrid.appendChild(div);
    }

    // Localization Injection
    for (let key in config.Locales[config.Locale]) {
        const elements = document.querySelectorAll(`#l-${key.replace(/_/g, '-')}, .l-${key.replace(/_/g, '-')}`);
        elements.forEach(el => {
            el.innerText = config.Locales[config.Locale][key];
        });
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

    // Apply Filters (Tab 3)
    let filtered = lobbies;
    if (currentTab === 'list') {
        const mapFilter = document.getElementById('filter-maps').value;
        const weaponFilter = document.getElementById('filter-weapons').value;
        const playerFilter = document.getElementById('filter-players').value;

        filtered = lobbies.filter(l => {
            if (mapFilter !== 'all' && l.mapId !== mapFilter) return false;
            if (playerFilter === 'not-full' && l.playerCount >= l.maxPlayers) return false;
            // Weapon filter logic would need more server-side info or shared loadout defs
            return true;
        });
    }

    filtered.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        let color = '#00ff88';
        if (percent > 80) color = '#ff9500';
        if (lobby.status === 'ACTIVE') color = '#00d4ff';

        const radius = 30;
        const circ = 2 * Math.PI * radius;
        const offset = circ - (percent / 100) * circ;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="assets/maps/${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/160x90/111/fff?text=${lobby.mapLabel}'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">${lobby.mapLabel}</div>
                <div style="font-size: 11px; color: #a0a0a0; margin-top: 5px;">HOST: ${lobby.hostName}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="35" cy="35" r="${radius}"></circle>
                    <circle class="circle-progress" cx="35" cy="35" r="${radius}"
                        style="stroke: ${color}; stroke-dasharray: ${circ}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <div class="action-area">
                <button class="action-btn ${lobby.playerCount >= lobby.maxPlayers ? 'btn-disabled' : 'btn-join'}"
                    onclick="joinLobby('${lobby.id}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                    ${lobby.status === 'ACTIVE' ? 'SPECTATE' : 'BEITRETEN'}
                </button>
            </div>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

document.getElementById('btn-create-lobby-action').addEventListener('click', () => {
    playSound('click');
    const loadout = [];
    document.querySelectorAll('#loadout-grid input:checked').forEach(i => loadout.push(i.value));

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: loadout,
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

    document.getElementById('lobby-title-display').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-id-display').innerText = '#' + lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    // Host Controls
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';
    document.getElementById('host-settings-area').style.display = asHost ? 'grid' : 'none';

    if (asHost) {
        document.getElementById('wait-map-select').value = lobby.mapId;
        document.getElementById('wait-mode-select').value = lobby.mode;
    }
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <div class="p-info">
                <span style="font-weight: 900;">${p.name.toUpperCase()}</span>
                <span style="font-size: 11px; color: #a0a0a0; margin-left: 10px;">${p.team.toUpperCase()}</span>
            </div>
            <div class="p-actions">
                ${p.isHost ? '<i class="fa-solid fa-crown" style="color: #ff9500;"></i>' : ''}
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function updateHostSettings() {
    if (!isHost) return;
    const settings = {
        mapId: document.getElementById('wait-map-select').value,
        mode: document.getElementById('wait-mode-select').value,
        // Host can technically update more if we add UI for it in wait area
    };
    fetch(`https://${GetParentResourceName()}/updateSettings`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
}

document.getElementById('wait-map-select').addEventListener('change', updateHostSettings);
document.getElementById('wait-mode-select').addEventListener('change', updateHostSettings);

document.getElementById('btn-ready-toggle').addEventListener('change', (e) => {
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

// Chat Logic
const addChatMessage = (name, msg) => {
    const box = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name">${name}:</span><span class="chat-text">${msg}</span>`;
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
};

document.getElementById('btn-send-chat').addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    if (input.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: input.value })
        });
        input.value = '';
    }
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-send-chat').click();
});

// HUD & In-game
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-pct').innerText = data.health + '%';
    document.getElementById('hud-health-fill').style.width = data.health + '%';
    document.getElementById('hud-armor-pct').innerText = data.armor + '%';
    document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    if (seconds <= 0) {
        overlay.style.display = 'none';
        return;
    }
    overlay.style.display = 'flex';
    document.getElementById('countdown-number').innerText = seconds;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName.toUpperCase();

    const body = document.getElementById('match-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        body.appendChild(tr);
    });

    // Map Voting
    const voteGrid = document.getElementById('map-vote-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(m => {
        const div = document.createElement('div');
        div.className = 'map-vote-item';
        div.onclick = () => {
            playSound('click');
            document.querySelectorAll('.map-vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: m.id }) });
        };
        div.innerHTML = `
            <img src="assets/maps/${m.id}.png" onerror="this.src='https://via.placeholder.com/160x90/111/fff?text=${m.label}'">
            <div class="map-vote-label">${m.label.toUpperCase()}</div>
            <div class="vote-count" id="vote-count-${m.id}">0</div>
        `;
        voteGrid.appendChild(div);
    });
}

function updateMapVotes(votes) {
    for (let id in votes) {
        const el = document.getElementById('vote-count-' + id);
        if (el) el.innerText = votes[id];
    }
}

document.getElementById('btn-winner-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-back-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
