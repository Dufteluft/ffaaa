let Config = {};
let Maps = [];
let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let lobbiesCache = [];

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

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            Config = data.config;
            Maps = data.maps;
            setupUI();
            applyLocalization();
            document.getElementById('app').style.display = 'flex';
            if (data.isInGame) {
                document.getElementById('app').style.display = 'none';
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
            currentLobby = data.lobby;
            isHost = (data.action === 'lobbyCreated');
            showWaitingRoom(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('waiting-room').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('hud').style.display = 'block';
            break;
        case 'hideHUD':
            document.getElementById('hud').style.display = 'none';
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
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupUI() {
    // Map Select
    const mapSelect = document.getElementById('create-map');
    mapSelect.innerHTML = '';
    Maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.textContent = map.label;
        mapSelect.appendChild(opt);
    });

    // Loadout Multi-Select
    const loadoutContainer = document.getElementById('create-loadout');
    loadoutContainer.innerHTML = '';
    for (const [key, data] of Object.entries(Config.WeaponLoadouts)) {
        const div = document.createElement('div');
        div.className = 'loadout-option';
        div.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}" id="loadout-${key}">
            <label for="loadout-${key}">${data.label}</label>
        `;
        loadoutContainer.appendChild(div);
    }
}

function applyLocalization() {
    const locale = Config.Locales[Config.Locale];
    if (!locale) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locale[key]) {
            el.textContent = locale[key];
        }
    });
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${tab}`).classList.add('active');

        currentTab = tab;
        fetchLobbies();
    });
});

// Slider Values
const bindSlider = (inputId, valId) => {
    const input = document.getElementById(inputId);
    const val = document.getElementById(valId);
    input.addEventListener('input', () => {
        val.textContent = input.value;
    });
};
bindSlider('create-time', 'val-time');
bindSlider('create-players', 'val-players');
bindSlider('create-respawn', 'val-respawn');
bindSlider('create-killlimit', 'val-killlimit');

// Fetch Lobbies
function fetchLobbies() {
    if (typeof GetParentResourceName === 'undefined') return;
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    if (currentTab === 'ffa') {
        const container = document.getElementById('ffa-presets-container');
        container.innerHTML = '';
        lobbies.forEach(lobby => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.innerHTML = `
                <div class="preset-img">
                    <span class="preset-label">${lobby.mapLabel}</span>
                </div>
                <div class="preset-info">
                    <span>${lobby.playerCount} / ${lobby.maxPlayers}</span>
                    <button class="btn-join" onclick="quickJoin('${lobby.mapId}')">${Config.Locales[Config.Locale].btn_join}</button>
                </div>
            `;
            container.appendChild(card);
        });
    } else if (currentTab === 'lobby') {
        const container = document.getElementById('custom-lobbies-container');
        container.innerHTML = '';

        const searchTerm = document.getElementById('lobby-search').value.toLowerCase();
        const hideFull = document.getElementById('filter-not-full').checked;

        lobbies.forEach(lobby => {
            if (searchTerm && !lobby.name.toLowerCase().includes(searchTerm)) return;
            if (hideFull && lobby.playerCount >= lobby.maxPlayers) return;

            const item = document.createElement('div');
            item.className = 'lobby-item';
            item.innerHTML = `
                <div class="lobby-info">
                    <strong>${lobby.name}</strong><br>
                    <small>${lobby.hostName} | ${lobby.mapLabel} | ${lobby.mode.toUpperCase()}</small>
                </div>
                <div class="lobby-meta">
                    <span>${lobby.playerCount} / ${lobby.maxPlayers}</span>
                    <button class="btn-join" onclick="joinLobby('${lobby.id}')">${Config.Locales[Config.Locale].btn_join}</button>
                </div>
            `;
            container.appendChild(item);
        });
    }
}

function quickJoin(mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/quickJoin`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId })
    });
}

// Create Lobby
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);

    const settings = {
        name: document.getElementById('create-name').value || 'FFA Lobby',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked,
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-killlimit').value)
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.querySelector('[data-tab="ffa"]').click();
});

// Waiting Room
function showWaitingRoom(lobby) {
    currentLobby = lobby;
    document.getElementById('wait-lobby-name').textContent = lobby.name;
    document.getElementById('wait-map-label').textContent = lobby.mapLabel;
    document.getElementById('wait-mode-label').textContent = lobby.mode.toUpperCase();

    document.getElementById('waiting-room').style.display = 'flex';
    document.getElementById('btn-wait-start').style.display = isHost ? 'block' : 'none';
    document.getElementById('host-settings-btn-container').style.display = (isHost && !lobby.isPersistent) ? 'block' : 'none';

    document.getElementById('wait-chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const container = document.getElementById('wait-player-list');
    container.innerHTML = '';

    players.forEach(p => {
        const card = document.createElement('div');
        card.className = `player-card ${p.ready ? 'ready' : ''}`;

        let teamLabel = '';
        if (p.team === 'blue') teamLabel = `<span style="color: #2196f3;">BLUE</span>`;
        else if (p.team === 'red') teamLabel = `<span style="color: #f44336;">RED</span>`;
        else if (p.team === 'spectator') teamLabel = `<span>SPEC</span>`;

        card.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fas fa-crown"></i>' : ''}</span>
            <div class="player-meta">
                ${teamLabel}
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fas fa-times"></i></button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });

    if (isHost) {
        document.getElementById('btn-wait-start').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.querySelectorAll('#wait-team-selector .team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('#wait-team-selector .team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.getAttribute('data-team') })
        });
    });
});

document.getElementById('btn-wait-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-wait-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-wait-leave').addEventListener('click', () => {
    playSound('click');
    document.getElementById('waiting-room').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    playSound('click');
    // Pre-fill create form with current settings
    document.getElementById('create-name').value = currentLobby.name;
    document.getElementById('create-map').value = currentLobby.mapId;
    document.getElementById('create-mode').value = currentLobby.mode;
    document.getElementById('create-time').value = currentLobby.roundTime;
    document.getElementById('val-time').textContent = currentLobby.roundTime;
    document.getElementById('create-players').value = currentLobby.maxPlayers;
    document.getElementById('val-players').textContent = currentLobby.maxPlayers;
    document.getElementById('create-vehicles').checked = currentLobby.vehiclesAllowed;
    document.getElementById('create-ff').checked = currentLobby.friendlyFire;
    document.getElementById('create-respawn').value = currentLobby.respawnTime;
    document.getElementById('val-respawn').textContent = currentLobby.respawnTime;
    document.getElementById('create-killlimit').value = currentLobby.killLimit;
    document.getElementById('val-killlimit').textContent = currentLobby.killLimit;

    // Change create button to update button
    const submitBtn = document.getElementById('btn-submit-create');
    submitBtn.textContent = 'UPDATE SETTINGS';
    submitBtn.onclick = updateLobbySettings;

    document.querySelector('[data-tab="create"]').click();
});

function updateLobbySettings() {
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);

    const settings = {
        name: document.getElementById('create-name').value,
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : currentLobby.loadout,
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked,
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-killlimit').value)
    };

    fetch(`https://${GetParentResourceName()}/updateSettings`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });

    // Reset button back to original
    const submitBtn = document.getElementById('btn-submit-create');
    submitBtn.textContent = Config.Locales[Config.Locale].btn_create;
    submitBtn.onclick = null; // Back to event listener

    document.querySelector('[data-tab="ffa"]').click(); // Actually waiting room will be shown
}

// Chat
document.getElementById('wait-chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value.trim();
        if (msg) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

function addChatMessage(name, message) {
    const container = document.getElementById('wait-chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// HUD
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').textContent = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').textContent = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').textContent = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-scores').style.display = 'block';
        if (data.scoreBlue !== undefined) document.querySelector('.score-blue').textContent = data.scoreBlue;
        if (data.scoreRed !== undefined) document.querySelector('.score-red').textContent = data.scoreRed;
    } else {
        document.getElementById('hud-scores').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health-bar').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').textContent = data.ammo;
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('hud').style.display = 'none';
    document.getElementById('winner-display').textContent = `${Config.Locales[Config.Locale].winner.replace('%s', data.winnerName)}`;

    const tbody = document.querySelector('#winner-scoreboard tbody');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name}</td>
            <td>${s.kills}</td>
            <td>${s.deaths}</td>
            <td>${s.kd}</td>
        `;
        tbody.appendChild(tr);
    });

    // Map Voting
    const voteContainer = document.getElementById('vote-options');
    voteContainer.innerHTML = '';
    Maps.slice(0, 3).forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'team-btn';
        btn.textContent = map.label;
        btn.onclick = () => {
            playSound('click');
            document.querySelectorAll('#vote-options button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteContainer.appendChild(btn);
    });

    document.getElementById('winner-screen').style.display = 'flex';
}

document.getElementById('btn-winner-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// ESC to close
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('waiting-room').style.display === 'flex') return;
        if (document.getElementById('winner-screen').style.display === 'flex') return;
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('waiting-room').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
