let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';

// Maps and Config from Server
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
// Filter Event Listeners
document.getElementById('filter-maps').addEventListener('change', fetchLobbies);
document.getElementById('filter-weapons').addEventListener('change', fetchLobbies);
document.getElementById('filter-players').addEventListener('change', fetchLobbies);
document.getElementById('filter-time').addEventListener('change', fetchLobbies);

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        // UI Tabs
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // View Visibility
        currentTab = btn.dataset.tab;
        document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));

        if (currentTab === 'create') {
            document.getElementById('lobby-create-view').classList.add('active');
            document.getElementById('lobby-create-view').style.display = 'block';
            document.getElementById('lobby-list-view').style.display = 'none';
        } else {
            document.getElementById('lobby-list-view').classList.add('active');
            document.getElementById('lobby-list-view').style.display = 'block';
            document.getElementById('lobby-create-view').style.display = 'none';
            fetchLobbies();
        }
    });
});

// Stats Button (Formerly open-create-modal)
document.getElementById('open-create-modal').addEventListener('click', () => {
    playSound('click');
    // Implement stats display or notification
    fetch(`https://${GetParentResourceName()}/getStats`, { method: 'POST' });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.querySelector('button[data-tab="ffa"]').click();
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
            document.getElementById('create-lobby-modal').style.display = 'none';
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
            // HUD implementation handled separately as per instructions
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }
}

function fetchLobbies() {
    if (currentTab === 'create') return;

    // We send 'ffa' or 'custom' (for open lobbies tab)
    const filterType = currentTab === 'ffa' ? 'ffa' : 'custom';

    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: filterType })
    });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    // Filter Logic
    const filterMap = document.getElementById('filter-maps').value;
    const filterPlayer = document.getElementById('filter-players').value;

    const filtered = lobbies.filter(lobby => {
        if (filterMap !== 'all' && lobby.mapId !== filterMap) return false;
        if (filterPlayer === 'not-full' && lobby.playerCount >= lobby.maxPlayers) return false;
        return true;
    });

    if (filtered.length === 0) {
        container.innerHTML = '<div class="no-lobbies">KEINE PASSENDEN LOBBYS GEFUNDEN</div>';
        return;
    }

    filtered.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;

        let status = lobby.status || 'waiting';
        let strokeColor = '#00ff88'; // Success
        if (status === 'joining') strokeColor = '#00d4ff'; // Primary
        else if (percent > 80) strokeColor = '#ff9500'; // Warning

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        // Simplified Map Image URLs (using placeholders for now)
        const mapImg = lobby.mapImage || `https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}" alt="${lobby.mapLabel}">
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
                <i class="fa-solid fa-user"></i>
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
        return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}', true)">SPECTATE</button>`;
    }
    const pulsingClass = lobby.status === 'joining' ? 'pulsing' : '';
    return `<button class="action-btn btn-join ${pulsingClass}" onclick="joinLobby('${lobby.id}')">JOIN</button>`;
}

function joinLobby(lobbyId, isSpectator = false) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId, isSpectator })
    });
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
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

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < (currentLobby.minPlayers || 2);
    }
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

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh (only for 'list' tab aka Open Lobbies)
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        currentTab === 'list' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
