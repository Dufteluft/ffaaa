let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let selectedLoadouts = [];

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

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        if (targetTab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        if (targetTab === 'ffa' || targetTab === 'lobby') {
            document.getElementById('browser-view').classList.add('active');
            currentTab = targetTab;
            fetchLobbies();
        } else if (targetTab === 'create') {
            document.getElementById('create-view').classList.add('active');
            resetCreationForm();
            currentTab = targetTab;
        }
    });
});

function resetCreationForm() {
    document.getElementById('lobby-name').value = '';
    document.getElementById('btn-create-lobby').style.display = 'block';
    document.getElementById('btn-edit-settings').style.display = 'none';
    selectedLoadouts = ['all'];
    updateLoadoutCheckboxes();
}

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
            if (data.config && data.maps) {
                setupInitialData(data.config, data.maps);
            }
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
            showLobbyArea(data.lobby, data.action === 'lobbyCreated' || data.lobby.host === data.myId);
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
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-timer').style.display = data.isPersistent ? 'none' : 'block';
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
            const cd = document.getElementById('hud-countdown');
            if (data.seconds > 0) {
                cd.innerText = data.seconds;
                cd.style.display = 'block';
            } else {
                cd.style.display = 'none';
            }
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

    applyLocalization();

    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);

        const fOpt = opt.cloneNode(true);
        filterMaps.appendChild(fOpt);
    });

    const filterWeapons = document.getElementById('filter-weapons');
    filterWeapons.innerHTML = '<option value="all">ALL WEAPONS</option>';

    const checkboxGrid = document.getElementById('loadout-checkboxes');
    checkboxGrid.innerHTML = '';

    for (let key in config.WeaponLoadouts) {
        const label = key.toUpperCase();

        // Filter dropdown
        const fOpt = document.createElement('option');
        fOpt.value = key;
        fOpt.innerText = label;
        filterWeapons.appendChild(fOpt);

        // Multi-select checkboxes
        const div = document.createElement('div');
        div.className = 'checkbox-item';
        div.innerHTML = `<i class="fa-regular fa-square"></i> ${label}`;
        div.onclick = () => toggleLoadout(key, div);
        div.dataset.key = key;
        checkboxGrid.appendChild(div);
    }
}

function applyLocalization() {
    if (!serverConfig.Locales || !serverConfig.Locale) return;
    const lang = serverConfig.Locales[serverConfig.Locale];
    if (!lang) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (lang[key]) {
            if (el.tagName === 'INPUT' && el.type === 'placeholder') {
                el.placeholder = lang[key];
            } else {
                el.innerText = lang[key];
            }
        }
    });
}

function toggleLoadout(key, el) {
    const index = selectedLoadouts.indexOf(key);
    if (index > -1) {
        selectedLoadouts.splice(index, 1);
    } else {
        selectedLoadouts.push(key);
    }
    updateLoadoutCheckboxes();
}

function updateLoadoutCheckboxes() {
    document.querySelectorAll('.checkbox-item').forEach(el => {
        const key = el.dataset.key;
        const icon = el.querySelector('i');
        if (selectedLoadouts.includes(key)) {
            el.classList.add('active');
            icon.className = 'fa-solid fa-square-check';
        } else {
            el.classList.remove('active');
            icon.className = 'fa-regular fa-square';
        }
    });
}

function fetchLobbies() {
    if (typeof GetParentResourceName === 'undefined') return;
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const percent = (lobby.playerCount / lobby.maxPlayers) * 100;
        const radius = 20;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="https://via.placeholder.com/120x70/0f1419/ffffff?text=${lobby.mapLabel}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} • ${lobby.mode.toUpperCase()}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="25" cy="25" r="${radius}"></circle>
                    <circle class="circle-progress" cx="25" cy="25" r="${radius}"
                        style="stroke: var(--primary); stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            </div>
            <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${lobby.status === 'ACTIVE' ? 'SPECTATE' : 'JOIN'}</button>
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

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    const settings = getFormSettings();
    playSound('click');
    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function getFormSettings() {
    return {
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
}

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-id-val').innerText = lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-open-settings').style.display = asHost ? 'block' : 'none';

    updateLobbyInfoSummary(lobby);
}

function updateLobbyInfoSummary(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div>MAP: ${lobby.mapLabel}</div>
        <div>MODE: ${lobby.mode.toUpperCase()}</div>
        <div>TIME: ${lobby.roundTime} MIN</div>
        <div>KILL LIMIT: ${lobby.killLimit || 'OFF'}</div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span class="team-badge" style="color: ${p.team === 'blue' ? '#2196f3' : (p.team === 'red' ? '#f44336' : '#888')}">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="icon-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.getElementById('btn-open-settings').addEventListener('click', () => {
    playSound('click');
    // Pre-fill form
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
    selectedLoadouts = Array.isArray(currentLobby.loadout) ? currentLobby.loadout : [currentLobby.loadout];
    updateLoadoutCheckboxes();

    document.getElementById('round-time').value = currentLobby.roundTime;
    document.getElementById('round-time-val').innerText = currentLobby.roundTime;
    document.getElementById('max-players').value = currentLobby.maxPlayers;
    document.getElementById('max-players-val').innerText = currentLobby.maxPlayers;

    document.getElementById('vehicles-allowed').checked = currentLobby.vehiclesAllowed;
    document.getElementById('friendly-fire').checked = currentLobby.friendlyFire;
    document.getElementById('respawn-time').value = currentLobby.respawnTime;
    document.getElementById('respawn-time-val').innerText = currentLobby.respawnTime;
    document.getElementById('kill-limit').value = currentLobby.killLimit;
    document.getElementById('kill-limit-val').innerText = currentLobby.killLimit;

    document.getElementById('btn-create-lobby').style.display = 'none';
    document.getElementById('btn-edit-settings').style.display = 'block';

    // Switch to create tab
    document.querySelector('[data-tab="create"]').click();
});

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    const settings = getFormSettings();
    playSound('click');
    fetch(`https://${GetParentResourceName()}/updateSettings`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
    // Switch back to lobby tab? No, it's better to show it's saved.
    document.querySelector('[data-tab="lobby"]').click();
});

document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
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

function addChatMessage(name, msg) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

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

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    const scoreEl = document.getElementById('hud-scores');
    if (data.mode === 'tdm') {
        scoreEl.style.display = 'flex';
        if (data.scoreBlue !== undefined) scoreEl.querySelector('.blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) scoreEl.querySelector('.red').innerText = data.scoreRed;
    } else {
        scoreEl.style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " WINS!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    const votingList = document.getElementById('map-voting-list');
    votingList.innerHTML = '';
    // Select 4 random maps for voting
    const maps = [...serverMaps].sort(() => 0.5 - Math.random()).slice(0, 4);
    maps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `<span>${map.label}</span><span class="vote-count">0</span>`;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            const countEl = div.querySelector('.vote-count');
            countEl.innerText = parseInt(countEl.innerText) + 1;
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        votingList.appendChild(div);
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
    fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

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
