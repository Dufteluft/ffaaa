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

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        if (targetTab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${targetTab}`).classList.add('active');

        currentTab = targetTab;
        if (currentTab !== 'create') {
            fetchLobbies();
        }
    });
});

// Localization
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            el.innerText = locales[key];
        }
    });
}

// Range Slider Sync
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
            document.getElementById('game-hud').style.display = 'block';
            if (data.isPersistent) {
                document.querySelector('.hud-timer-box').style.display = 'none';
            } else {
                document.querySelector('.hud-timer-box').style.display = 'flex';
            }
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
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization(config.Locales[config.Locale]);

    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    // Reset Creation Form
    document.getElementById('lobby-name').value = '';
    document.querySelectorAll('input[name="loadout"]').forEach(cb => cb.checked = false);
}

function fetchLobbies() {
    const tabToFetch = currentTab === 'lobby' ? 'list' : 'ffa';
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: tabToFetch })
    });
}

function renderLobbyList(lobbies) {
    const container = currentTab === 'ffa' ? document.getElementById('ffa-list-container') : document.getElementById('open-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL'}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} • ${lobby.hostName}</div>
            </div>
            <div class="lobby-players">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="lobby-status status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="confirm-btn" style="padding: 10px 20px;" onclick="joinLobby('${lobby.id}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>JOIN</button>
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
    playSound('click');
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);

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

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>KILL LIMIT: ${lobby.killLimit || 'OFF'}</p>
    `;

    document.getElementById('chat-messages').innerHTML = '';
}

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    if (!currentLobby || !isHost) return;
    playSound('click');

    // Switch to create tab
    document.querySelector('[data-tab="create"]').click();
    document.getElementById('lobby-waiting-area').style.display = 'none';

    // Pre-fill form
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;

    // Pre-fill loadouts
    document.querySelectorAll('input[name="loadout"]').forEach(cb => {
        cb.checked = Array.isArray(currentLobby.loadout) ? currentLobby.loadout.includes(cb.value) : false;
    });

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

    // Change button text to indicate update
    const createBtn = document.getElementById('btn-create-lobby');
    const originalText = createBtn.innerText;
    createBtn.innerText = "UPDATE";

    const updateHandler = () => {
        updateLobbySettings();
        createBtn.innerText = originalText;
        createBtn.removeEventListener('click', updateHandler);
    };

    createBtn.addEventListener('click', updateHandler);
});

function updateLobbySettings() {
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);
    const settings = {
        name: document.getElementById('lobby-name').value,
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

    fetch(`https://${GetParentResourceName()}/updateSettings`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });

    // Switch back to lobby area
    document.getElementById('lobby-waiting-area').style.display = 'flex';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <span style="font-size: 10px; color: #888;">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const msgEl = document.createElement('div');
    msgEl.innerHTML = `<strong style="color: var(--primary);">${name}:</strong> ${message}`;
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.querySelector('.blue-score').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.querySelector('.red-score').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('countdown-display');
    if (seconds > 0) {
        el.style.display = 'block';
        el.innerText = seconds;
        if (seconds <= 3) playSound('click');
    } else {
        el.style.display = 'none';
        playSound('start');
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
        <thead><tr style="border-bottom: 1px solid #444; color: #888; font-size: 12px;">
        <th style="text-align: left; padding: 10px;">NAME</th>
        <th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr style="border-bottom: 1px solid #222;">
            <td style="text-align: left; padding: 10px; font-weight: 800;">${s.name.toUpperCase()}</td>
            <td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Render Map Voting
    const voteContainer = document.getElementById('vote-options');
    voteContainer.innerHTML = '';
    serverMaps.forEach(map => {
        const el = document.createElement('div');
        el.className = 'vote-item';
        el.innerText = map.label.toUpperCase();
        el.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            el.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteContainer.appendChild(el);
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

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh Open Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
