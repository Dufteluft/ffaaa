let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let mapVotes = {};

// Localization strings (will be populated from config)
let locales = {};

// Audio elements for sounds
const audioAssets = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3')
};

function playSound(name) {
    if (audioAssets[name]) {
        audioAssets[name].currentTime = 0;
        audioAssets[name].play().catch(e => console.log('Sound play error:', e));
    }
}

function applyLocalization(config) {
    locales = config.Locales[config.Locale] || config.Locales['en'];

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            el.innerText = locales[key];
        }
    });

    document.querySelectorAll('[data-placeholder]').forEach(el => {
        const key = el.getAttribute('data-placeholder');
        if (locales[key]) {
            el.placeholder = locales[key];
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

        currentTab = tab;

        // Reset display
        document.getElementById('tab-content-browser').style.display = (tab === 'ffa' || tab === 'list') ? 'block' : 'none';
        document.getElementById('tab-content-create').style.display = (tab === 'create') ? 'block' : 'none';
        document.getElementById('browser-filters').style.display = (tab === 'list') ? 'flex' : 'none';

        if (tab === 'ffa' || tab === 'list') {
            fetchLobbies();
        }
    });
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
            applyLocalization(data.config);
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
            playSound('start');
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
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
            if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            if (data.health !== undefined) document.getElementById('hud-health').style.width = data.health + '%';
            if (data.armor !== undefined) document.getElementById('hud-armor').style.width = data.armor + '%';
            if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'showWinner':
            playSound('win');
            showWinnerScreen(data);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Populate Map Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    // Populate Multi-select Loadout
    const loadoutGrid = document.getElementById('loadout-multi-select');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="checkbox" id="loadout-${key}" value="${key}">
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
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const filterFreeSlots = document.getElementById('filter-free-slots').checked;

    lobbies.forEach(lobby => {
        if (filterFreeSlots && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';

        const isFull = lobby.playerCount >= lobby.maxPlayers;
        const modeLabel = lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All';

        item.innerHTML = `
            <div class="lobby-info">
                <h3>${lobby.name}</h3>
                <p>${locales['host'] || 'Host'}: ${lobby.hostName} | ${modeLabel}</p>
            </div>
            <div class="lobby-map">
                <p>${locales['map'] || 'Map'}: ${lobby.mapLabel}</p>
            </div>
            <div class="lobby-players">
                <p>${locales['players'] || 'Spieler'}: ${lobby.playerCount}/${lobby.maxPlayers}</p>
            </div>
            <div class="lobby-actions">
                ${currentTab === 'ffa'
                    ? `<button class="action-btn" onclick="quickJoin('${lobby.mapId}')">${locales['btn_join']}</button>`
                    : `<button class="action-btn ${isFull ? 'btn-disabled' : ''}" ${isFull ? 'disabled' : ''} onclick="joinLobby('${lobby.id}')">${locales['btn_join']}</button>`
                }
            </div>
        `;
        container.appendChild(item);
    });
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

document.getElementById('btn-create-lobby-action').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('#loadout-multi-select input:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadouts: selectedLoadouts,
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

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.querySelector('[data-tab="ffa"]').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;

    document.getElementById('lobby-title-display').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-match').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby-action').style.display = asHost ? 'block' : 'none';
    document.getElementById('host-only-controls').style.display = asHost ? 'block' : 'none';

    // Clear chat
    document.getElementById('chat-messages-container').innerHTML = '';
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list-container');
    container.innerHTML = '';

    players.forEach(p => {
        const row = document.createElement('div');
        row.className = `player-row ${p.ready ? 'ready' : ''}`;

        let teamLabel = p.team.toUpperCase();
        if (locales['team_' + p.team]) teamLabel = locales['team_' + p.team];
        else if (locales[p.team]) teamLabel = locales[p.team];

        row.innerHTML = `
            <div class="p-info">
                <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            </div>
            <div class="p-team">
                <span class="team-tag tag-${p.team}">${teamLabel}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `;
        container.appendChild(row);
    });

    if (isHost) {
        document.getElementById('btn-start-match').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

document.getElementById('btn-toggle-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start-match').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave-lobby-action').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-close-lobby-action').addEventListener('click', () => {
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
            body: JSON.stringify({ team: btn.getAttribute('data-team') })
        });
    });
});

document.getElementById('lobby-chat-input').addEventListener('keypress', (e) => {
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
    const container = document.getElementById('chat-messages-container');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="name">${name}:</span><span class="text">${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function showWinnerScreen(data) {
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerText = (data.winnerName || 'Unknown').toUpperCase() + ' ' + (locales['winner_suffix'] || 'GEWINNT!');

    const body = document.getElementById('winner-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const row = document.createElement('tr');
        row.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        body.appendChild(row);
    });

    // Render Map Voting
    const voteContainer = document.getElementById('map-vote-container');
    voteContainer.innerHTML = '';
    serverMaps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.id = `vote-${map.id}`;
        div.innerHTML = `
            <div class="label">${map.label}</div>
            <div class="count" id="vote-count-${map.id}">0</div>
        `;
        div.onclick = () => voteMap(map.id);
        voteContainer.appendChild(div);
    });
}

function voteMap(mapId) {
    playSound('click');
    document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`vote-${mapId}`).classList.add('active');

    // Optimistic UI update
    const countEl = document.getElementById(`vote-count-${mapId}`);
    countEl.innerText = parseInt(countEl.innerText) + 1;

    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
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

// UI Close on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh for Lobby List
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && (currentTab === 'ffa' || currentTab === 'list')) {
        fetchLobbies();
    }
}, 5000);

// Host Edit Settings
document.getElementById('btn-edit-settings').addEventListener('click', () => {
    if (!isHost) return;
    playSound('click');

    // Pre-fill creation form with current lobby settings
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
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

    // Switch to creation tab
    document.querySelector('[data-tab="create"]').click();
});
