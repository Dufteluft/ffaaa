let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa-presets';
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

// Localization Engine
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locales[key];
            } else if (el.querySelector('span[data-locale]')) {
                // If it has a nested span, don't overwrite the whole thing
            } else {
                el.innerText = locales[key];
            }
        }
    });
}

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps, data.myId);
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
            currentLobby = data.lobby;
            isHost = (data.lobby.host == myPlayerId);
            showWaitingArea();
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            currentLobby = data.lobby;
            updateWaitingInfo();
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
            document.getElementById('hud-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('bar-health-inner').style.width = data.health + '%';
            document.getElementById('bar-armor-inner').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'countdown':
            const cd = document.getElementById('game-countdown');
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
        case 'receiveStats':
            document.getElementById('stat-kills').innerText = data.kills;
            document.getElementById('stat-deaths').innerText = data.deaths;
            document.getElementById('stat-kd').innerText = (data.deaths > 0 ? (data.kills / data.deaths).toFixed(2) : data.kills.toFixed(2));
            break;
    }
});

function setupInitialData(config, maps, myId) {
    serverConfig = config;
    serverMaps = maps;
    myPlayerId = myId;

    applyLocalization(config.Locales[config.Locale]);

    // Setup Dropdowns
    const populateSelect = (id, options, isMap = false) => {
        const select = document.getElementById(id);
        select.innerHTML = '';
        if (isMap) {
            options.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.innerText = m.label;
                select.appendChild(opt);
            });
        } else {
            for (let key in options) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.innerText = key.toUpperCase();
                select.appendChild(opt);
            }
        }
    };

    populateSelect('create-map', maps, true);
    populateSelect('create-loadout', config.WeaponLoadouts);
    populateSelect('filter-maps', maps, true);
    populateSelect('filter-weapons', config.WeaponLoadouts);

    // Filter defaults
    const allOpt = document.createElement('option');
    allOpt.value = 'all'; allOpt.innerText = 'ALL';
    document.getElementById('filter-maps').prepend(allOpt.cloneNode(true));
    document.getElementById('filter-weapons').prepend(allOpt.cloneNode(true));

    // Fetch stats
    fetch(`https://${GetParentResourceName()}/getStats`, { method: 'POST' });
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const target = document.getElementById(`tab-${btn.dataset.tab}`);
        target.classList.add('active');
        currentTab = btn.dataset.tab;

        if (currentTab !== 'create-lobby') {
            fetchLobbies();
        }

        // Hide/Show sidebar filters
        document.getElementById('sidebar-filters').style.display = (currentTab === 'create-lobby') ? 'none' : 'flex';
    });
});

// Slider Sync
const setupSlider = (id, valId) => {
    const slider = document.getElementById(id);
    const label = document.getElementById(valId);
    slider.addEventListener('input', () => { label.innerText = slider.value; });
};
setupSlider('create-time', 'val-time');
setupSlider('create-players', 'val-players');
setupSlider('create-respawn', 'val-respawn');
setupSlider('create-kills', 'val-kills');

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({
            tab: currentTab,
            filters: {
                map: document.getElementById('filter-maps').value,
                weapon: document.getElementById('filter-weapons').value,
                notFull: document.getElementById('filter-players').value === 'not-full'
            }
        })
    });
}

function renderLobbyList(lobbies) {
    const listId = currentTab === 'ffa-presets' ? 'preset-list' : 'open-list';
    const container = document.getElementById(listId);
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info-main">
                <h3>${lobby.name}</h3>
                <div class="lobby-info-meta">
                    <span>${lobby.mapLabel}</span> • <span>${lobby.mode.toUpperCase()}</span> • <span>${lobby.loadout.toUpperCase()}</span>
                </div>
            </div>
            <div class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <button class="action-btn" onclick="joinLobby('${lobby.id}')">${serverConfig.Locales[serverConfig.Locale].btn_join}</button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: id })
    });
}

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const data = {
        name: document.getElementById('create-name').value || 'New Lobby',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: document.getElementById('create-loadout').value,
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-kills').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(data)
    });
});

// Waiting Area Logic
function showWaitingArea() {
    playSound('join');
    document.getElementById('waiting-lobby-name').innerText = currentLobby.name;
    document.getElementById('waiting-lobby-mode').innerText = currentLobby.mode.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    updateWaitingInfo();
    renderSettingsEditor();
}

function updateWaitingInfo() {
    isHost = (currentLobby.host == myPlayerId);
    document.getElementById('btn-start-match').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = isHost ? 'block' : 'none';
}

function renderPlayerList(players) {
    const container = document.getElementById('waiting-player-list');
    container.innerHTML = '';

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <div class="p-info">
                <strong>${p.name}</strong> ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}
                <div style="font-size: 10px; opacity: 0.7;">${p.team.toUpperCase()}</div>
            </div>
            ${isHost && p.id != myPlayerId ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-minus"></i></button>` : ''}
        `;
        container.appendChild(item);
    });

    if (isHost) {
        document.getElementById('btn-start-match').disabled = (players.length < 2 && !currentLobby.isPersistent);
    }
}

function renderSettingsEditor() {
    const container = document.getElementById('host-settings-editor');
    container.innerHTML = '';

    if (!isHost) {
        container.innerHTML = `
            <div class="static-settings">
                <div class="stat-row"><span>MAP</span><span>${currentLobby.mapLabel}</span></div>
                <div class="stat-row"><span>MODE</span><span>${currentLobby.mode.toUpperCase()}</span></div>
                <div class="stat-row"><span>LOADOUT</span><span>${currentLobby.loadout.toUpperCase()}</span></div>
                <div class="stat-row"><span>TIME</span><span>${currentLobby.roundTime}m</span></div>
            </div>
        `;
        return;
    }

    // Editable settings for host
    container.innerHTML = `
        <div class="edit-settings">
            <div class="input-group"><label>Lobby Name</label><input type="text" value="${currentLobby.name}" onchange="saveSettings('name', this.value)"></div>
            <div class="input-row">
                <div class="input-group"><label>Map</label><select onchange="saveSettings('mapId', this.value)">${serverMaps.map(m => `<option value="${m.id}" ${m.id == currentLobby.mapId ? 'selected' : ''}>${m.label}</option>`).join('')}</select></div>
                <div class="input-group"><label>Mode</label><select onchange="saveSettings('mode', this.value)"><option value="ffa" ${currentLobby.mode == 'ffa' ? 'selected' : ''}>FFA</option><option value="tdm" ${currentLobby.mode == 'tdm' ? 'selected' : ''}>TDM</option></select></div>
            </div>
        </div>
    `;
}

function saveSettings(key, val) {
    fetch(`https://${GetParentResourceName()}/saveSettings`, {
        method: 'POST',
        body: JSON.stringify({ key, value: val })
    });
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-match').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave').addEventListener('click', () => {
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

// Chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

function addChatMessage(name, msg) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-name">${name}:</span> <span class="chat-text">${msg}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerHTML = `${data.winnerName.toUpperCase()} <span data-locale="wins_suffix">${serverConfig.Locales[serverConfig.Locale].wins_suffix}</span>`;

    const tbody = document.querySelector('#winner-stats-table tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });

    const voteContainer = document.getElementById('vote-maps');
    voteContainer.innerHTML = '';
    serverMaps.slice(0, 4).forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = m.label;
        btn.onclick = () => {
            document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: m.id }) });
        };
        voteContainer.appendChild(btn);
    });
}

document.getElementById('btn-win-lobby').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-win-menu').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh Open Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && currentTab === 'open-lobbies') {
        fetchLobbies();
    }
}, 5000);
