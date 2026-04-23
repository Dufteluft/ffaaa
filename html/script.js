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
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Hide all tab contents
        document.querySelectorAll('.content-wrapper').forEach(el => el.style.display = 'none');

        currentTab = btn.dataset.tab;

        // Show specific tab content
        const content = document.getElementById(`tab-content-${currentTab}`);
        if (content) {
            content.style.display = 'flex';
            if (currentTab === 'ffa' || currentTab === 'list') {
                fetchLobbies();
            }
        }
    });
});

// Slider Sync
const setupSlider = (id, spanId) => {
    const slider = document.getElementById(id);
    const span = document.getElementById(spanId);
    if (slider && span) {
        slider.addEventListener('input', () => {
            span.innerText = slider.value;
        });
    }
};
setupSlider('create-round-time', 'create-round-time-val');
setupSlider('create-max-players', 'create-max-players-val');
setupSlider('create-respawn', 'create-respawn-val');
setupSlider('create-killlimit', 'create-killlimit-val');

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
            playSound('join');
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
            document.getElementById('hud-tdm-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health-bar').style.width = data.health + '%';
            document.getElementById('hud-armor-bar').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-time-val').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
            break;
        case 'countdown':
            const cdDisplay = document.getElementById('countdown-display');
            if (data.seconds > 0) {
                cdDisplay.style.display = 'flex';
                document.getElementById('countdown-number').innerText = data.seconds;
            } else {
                cdDisplay.style.display = 'none';
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            const chatBox = document.getElementById('chat-messages');
            if (chatBox) {
                const msgEl = document.createElement('div');
                msgEl.className = 'chat-msg';

                const strong = document.createElement('strong');
                strong.textContent = data.name.toUpperCase() + ':';

                const text = document.createTextNode(' ' + data.message);

                msgEl.appendChild(strong);
                msgEl.appendChild(text);
                chatBox.appendChild(msgEl);
                chatBox.scrollTop = chatBox.scrollHeight;
            }
            break;
    }
});

function applyLocalization(config) {
    const locale = config.Locales[config.Locale];
    if (!locale) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locale[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locale[key];
            } else {
                el.innerText = locale[key];
            }
        }
    });
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    applyLocalization(config);

    // Setup Map Dropdowns
    const mapDropdowns = ['create-map-select', 'filter-maps', 'list-filter-maps'];
    mapDropdowns.forEach(id => {
        const select = document.getElementById(id);
        if (!select) return;

        // Keep "ALL MAPS" if it's a filter
        const originalFirst = select.options.length > 0 ? select.options[0] : null;
        select.innerHTML = '';
        if (id.includes('filter')) {
            select.appendChild(originalFirst);
        }

        maps.forEach(map => {
            const opt = document.createElement('option');
            opt.value = map.id;
            opt.innerText = map.label.toUpperCase();
            select.appendChild(opt);
        });
    });

    // Setup Loadout Checkboxes
    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="checkbox" id="loadout-${key}" value="${key}" class="loadout-checkbox">
            <label for="loadout-${key}">${key.toUpperCase()}</label>
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
    const containerFFA = document.getElementById('lobby-list-container-ffa');
    const containerList = document.getElementById('lobby-list-container-list');

    containerFFA.innerHTML = '';
    containerList.innerHTML = '';

    const mapFilter = document.getElementById(currentTab === 'ffa' ? 'filter-maps' : 'list-filter-maps').value;
    const playerFilter = currentTab === 'ffa' ? document.getElementById('filter-players').value : 'all';

    lobbies.forEach((lobby, index) => {
        // Apply Filters
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;
        if (playerFilter === 'not-full' && lobby.playerCount >= lobby.maxPlayers) return;

        const container = lobby.isPersistent ? containerFFA : containerList;
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

        // Create structure using DOM methods to prevent XSS
        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> <span class="map-label-text"></span>
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
        item.querySelector('.map-label-text').textContent = lobby.mapLabel;
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

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');

    // Collect selected loadouts
    const selectedLoadouts = [];
    document.querySelectorAll('.loadout-checkbox:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('create-lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('create-map-select').value,
        mode: document.getElementById('create-mode-select').value,
        loadout: selectedLoadouts,
        roundTime: parseInt(document.getElementById('create-round-time').value),
        maxPlayers: parseInt(document.getElementById('create-max-players').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-friendlyfire').checked,
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-killlimit').value)
    };

    if (selectedLoadouts.length === 0) {
        // Fallback if no weapons selected
        settings.loadout = ['pistol'];
    }

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;

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

        const nameSpan = document.createElement('span');
        nameSpan.textContent = `${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}`;

        const teamSpan = document.createElement('span');
        teamSpan.textContent = p.team.toUpperCase();

        div.appendChild(nameSpan);
        div.appendChild(teamSpan);

        if (isHost && !p.isHost) {
            const kickBtn = document.createElement('button');
            kickBtn.className = 'kick-btn';
            kickBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
            kickBtn.onclick = () => {
                playSound('click');
                fetch(`https://${GetParentResourceName()}/kickPlayer`, {
                    method: 'POST',
                    body: JSON.stringify({ id: p.id })
                });
            };
            div.appendChild(kickBtn);
        }

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

    // Render Map Voting
    const votingGrid = document.getElementById('winner-map-voting');
    votingGrid.innerHTML = '';

    // Show first 4 maps for voting
    serverMaps.slice(0, 4).forEach(map => {
        const item = document.createElement('div');
        item.className = 'vote-item';
        item.innerHTML = `
            <img src="https://via.placeholder.com/100x60/0f1419/ffffff?text=${map.label}" class="vote-map-img">
            <span class="vote-map-label">${map.label.toUpperCase()}</span>
        `;
        item.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        votingGrid.appendChild(item);
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

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Filter Listeners
document.getElementById('filter-maps').addEventListener('change', fetchLobbies);
document.getElementById('filter-players').addEventListener('change', fetchLobbies);
document.getElementById('list-filter-maps').addEventListener('change', fetchLobbies);

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
