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
        const tab = btn.dataset.tab;
        if (tab === currentTab && tab !== 'create') return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        if (tab === 'create') {
            document.getElementById('create-lobby-tab').classList.add('active');
            document.getElementById('sidebar-filters').style.display = 'none';
            // Reset button text if it was "Speichern"
            document.getElementById('btn-create-lobby').innerText = 'LOBBY ERSTELLEN';
        } else {
            document.getElementById('lobby-browser').classList.add('active');
            document.getElementById('sidebar-filters').style.display = 'flex';
            currentTab = tab;
            fetchLobbies();
        }
    });
});

// Slider Value Sync
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
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-team-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Filter Maps
    const filterMaps = document.getElementById('filter-maps');
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        filterMaps.appendChild(opt);
    });

    // Create Form Maps
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    // Multi-select Loadout
    const loadoutGrid = document.getElementById('loadout-checkbox-grid');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const label = config.WeaponLoadouts[key][0].label || key;
        const item = document.createElement('label');
        item.className = 'loadout-item';
        item.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}">
            <span>${key.toUpperCase()}</span>
        `;
        loadoutGrid.appendChild(item);
    }

    // Map Voting Grid
    const votingGrid = document.getElementById('map-voting-grid');
    votingGrid.innerHTML = '';
    maps.slice(0, 4).forEach(map => {
        const item = document.createElement('div');
        item.className = 'vote-item';
        item.onclick = () => voteMap(map.id, item);
        item.innerHTML = `<div class="vote-label">${map.label.toUpperCase()}</div>`;
        votingGrid.appendChild(item);
    });
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

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animation = `slideIn 0.3s forwards ${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;
        let strokeColor = '#00ff88';
        if (percent > 80) strokeColor = '#ff9500';

        const radius = 22;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="https://via.placeholder.com/120x68/0f1419/ffffff?text=${lobby.mapLabel}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL'}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel.toUpperCase()}</div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="25" cy="25" r="${radius}"></circle>
                    <circle class="circle-progress" cx="25" cy="25" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${playerCount}/${maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">${lobby.status === 'ACTIVE' ? 'ZUSCHAUEN' : 'BEITRETEN'}</button>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId, mapId) {
    playSound('click');
    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId })
        });
    }
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(cb => cb.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value),
        vehiclesAllowed: document.getElementById('vehicles-toggle').checked,
        friendlyFire: document.getElementById('friendly-fire-toggle').checked
    };

    playSound('click');
    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    document.querySelector('.tab-btn[data-tab="ffa"]').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    updateLobbyInfo(lobby);
}

function updateLobbyInfo(lobby) {
    const summary = document.getElementById('lobby-info-summary');
    summary.innerHTML = `
        <div class="info-item"><span class="label">MAP</span><span class="value">${lobby.mapLabel.toUpperCase()}</span></div>
        <div class="info-item"><span class="label">MODUS</span><span class="value">${lobby.mode.toUpperCase()}</span></div>
        <div class="info-item"><span class="label">ZEIT</span><span class="value">${lobby.roundTime} MIN</span></div>
        <div class="info-item"><span class="label">LIMIT</span><span class="value">${lobby.killLimit || 'AUS'}</span></div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span style="font-size: 11px; font-weight: 800; color: var(--text-muted);">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="icon-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

function voteMap(mapId, el) {
    playSound('click');
    document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
    el.classList.add('active');
    fetch(`https://${GetParentResourceName()}/voteMap`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

function updateHUD(data) {
    if (data.time !== undefined) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health-fill').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
    if (data.weapon !== undefined) document.getElementById('hud-weapon-name').innerText = data.weapon.toUpperCase();
}

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    const number = document.getElementById('countdown-number');

    if (seconds > 0) {
        overlay.style.display = 'flex';
        number.innerText = seconds;
        playSound('click');
    } else {
        overlay.style.display = 'none';
        if (seconds === 0) playSound('start');
    }
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<span style="color: var(--primary); font-weight: 900;">${name}:</span> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
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

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});
document.getElementById('btn-send-chat').addEventListener('click', sendMessage);

function sendMessage() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (msg) {
        playSound('click');
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: msg })
        });
        input.value = '';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
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

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
