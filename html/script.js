let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

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

// Tab Switching logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${tab}-content`).classList.add('active');

        currentTab = tab;
        if (tab === 'ffa' || tab === 'list') {
            fetchLobbies();
        }
    });
});

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            myPlayerId = data.myId;
            setupInitialData(data.config, data.maps);
            localizeUI(data.config.Locales[data.config.Locale]);
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
            showLobbyArea(data.lobby, data.action === 'lobbyCreated' || data.lobby.host == myPlayerId);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            updateLobbySettingsUI(data.settings);
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            document.getElementById('game-hud').style.display = 'flex';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'flex';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'receiveStats':
            updateStatsUI(data.stats);
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
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = config.WeaponLoadouts[key][0].label + '...'; // Show first weapon as preview
        loadoutSelect.appendChild(opt);
    }
}

function localizeUI(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locales[key];
            } else {
                el.innerText = locales[key];
            }
        }
    });
}

function fetchLobbies() {
    const tabFilter = currentTab === 'ffa' ? 'ffa' : 'custom';
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: tabFilter })
    });

    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/getStats`, { method: 'POST' });
    }
}

function updateStatsUI(stats) {
    // We could add a stats display in the FFA tab
    const container = document.getElementById('tab-ffa-content');
    let statsDiv = document.getElementById('player-stats-summary');
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.id = 'player-stats-summary';
        statsDiv.style = "margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 5px; display: flex; justify-content: space-around;";
        container.prepend(statsDiv);
    }

    const kd = (stats.deaths > 0) ? (stats.kills / stats.deaths).toFixed(2) : stats.kills.toFixed(2);
    statsDiv.innerHTML = `
        <div class="stat-v"><label>Kills</label><span>${stats.kills}</span></div>
        <div class="stat-v"><label>Deaths</label><span>${stats.deaths}</span></div>
        <div class="stat-v"><label>K/D</label><span>${kd}</span></div>
        <div class="stat-v"><label>Wins</label><span>${stats.wins}</span></div>
    `;
}

function renderLobbyList(lobbies) {
    const containerId = currentTab === 'ffa' ? 'ffa-lobby-list' : 'open-lobby-list';
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const filterNotFull = document.getElementById('filter-not-full').checked;

    lobbies.forEach(lobby => {
        if (currentTab === 'list' && filterNotFull && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
            </div>
            <div class="lobby-stats">
                <div class="stat-v"><label>Host</label><span>${lobby.hostName}</span></div>
                <div class="stat-v"><label>Spieler</label><span>${lobby.playerCount}/${lobby.maxPlayers}</span></div>
                <div class="stat-v"><label>Status</label><span>${lobby.status}</span></div>
            </div>
            <button class="action-btn" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">Beitreten</button>
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

// Slider updates
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

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(option => option.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA Match',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
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

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    updateLobbySettingsUI(lobby);
    renderSettingsEditor(lobby);
}

function updateLobbySettingsUI(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="summary-item"><span>Map:</span> ${lobby.mapLabel}</div>
        <div class="summary-item"><span>Modus:</span> ${lobby.mode.toUpperCase()}</div>
        <div class="summary-item"><span>Zeit:</span> ${lobby.roundTime} Min</div>
        <div class="summary-item"><span>Kill-Limit:</span> ${lobby.killLimit}</div>
    `;
}

function renderSettingsEditor(lobby) {
    const container = document.getElementById('host-settings-editor');
    if (!isHost) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    container.innerHTML = `
        <h3 data-locale="settings" style="margin-top: 20px;">Einstellungen</h3>
        <div class="form-group">
            <label data-locale="lobby_name">Lobby Name</label>
            <input type="text" id="edit-lobby-name" value="${lobby.name}">
        </div>
        <div class="form-row" style="display: flex; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="flex: 1;">
                <label data-locale="map_select">Map</label>
                <select id="edit-map-select" style="width: 100%;">${serverMaps.map(m => `<option value="${m.id}" ${m.id === lobby.mapId ? 'selected' : ''}>${m.label}</option>`).join('')}</select>
            </div>
            <div class="form-group" style="flex: 1;">
                <label data-locale="mode_select">Modus</label>
                <select id="edit-mode-select" style="width: 100%;">
                    <option value="ffa" ${lobby.mode === 'ffa' ? 'selected' : ''}>FFA</option>
                    <option value="tdm" ${lobby.mode === 'tdm' ? 'selected' : ''}>TDM</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label data-locale="loadout_select">Loadout</label>
            <select id="edit-loadout-select" multiple style="width: 100%; height: 60px;">
                ${Object.keys(serverConfig.WeaponLoadouts).map(k => `<option value="${k}" ${ (Array.isArray(lobby.loadout) ? lobby.loadout.includes(k) : lobby.loadout === k) ? 'selected' : ''}>${serverConfig.WeaponLoadouts[k][0].label}...</option>`).join('')}
            </select>
        </div>
        <div class="form-row" style="display: flex; gap: 10px; margin-bottom: 10px;">
            <div class="form-group" style="flex: 1;">
                <label>Zeit: <span id="edit-round-time-val">${lobby.roundTime}</span> Min</label>
                <input type="range" id="edit-round-time" min="5" max="60" step="5" value="${lobby.roundTime}" style="width: 100%;">
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Limit: <span id="edit-kill-limit-val">${lobby.killLimit}</span></label>
                <input type="range" id="edit-kill-limit" min="0" max="100" step="10" value="${lobby.killLimit}" style="width: 100%;">
            </div>
        </div>
        <button class="save-btn" id="btn-save-settings" style="width: 100%; padding: 10px; background: var(--primary); color: white; border: none; border-radius: 5px; cursor: pointer; font-weight: bold; margin-bottom: 20px;">EINSTELLUNGEN SPEICHERN</button>
    `;

    setupSlider('edit-round-time');
    setupSlider('edit-kill-limit');

    document.getElementById('btn-save-settings').addEventListener('click', () => {
        const selectedLoadouts = Array.from(document.getElementById('edit-loadout-select').selectedOptions).map(o => o.value);
        const data = {
            name: document.getElementById('edit-lobby-name').value,
            mapId: document.getElementById('edit-map-select').value,
            mode: document.getElementById('edit-mode-select').value,
            loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
            roundTime: parseInt(document.getElementById('edit-round-time').value),
            killLimit: parseInt(document.getElementById('edit-kill-limit').value),
            vehiclesAllowed: currentLobby.vehiclesAllowed, // Keep existing if not in editor
            friendlyFire: currentLobby.friendlyFire,
            respawnTime: currentLobby.respawnTime
        };
        fetch(`https://${GetParentResourceName()}/saveSettings`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        playSound('click');
    });

    // Re-localize the newly added elements
    localizeUI(serverConfig.Locales[serverConfig.Locale]);
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')">Kicken</button>` : ''}
        `;
        list.appendChild(div);
    });
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

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
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

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.scoreBlue !== undefined) document.querySelector('.team-blue-score').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.querySelector('.team-red-score').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('hud-health-bar').style.width = data.health + '%';
    document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    const num = document.getElementById('countdown-number');

    if (seconds > 0) {
        el.style.display = 'block';
        num.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    renderMapVoting();
}

function renderMapVoting() {
    const list = document.getElementById('map-vote-list');
    list.innerHTML = '';
    // Show 3 random maps to vote
    const shuffled = [...serverMaps].sort(() => 0.5 - Math.random());
    shuffled.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        list.appendChild(div);
    });
}

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<span style="color: var(--primary); font-weight: 800;">${name}:</span> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
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

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
