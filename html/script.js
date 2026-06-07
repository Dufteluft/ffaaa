let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let audioAssets = {};

// Initialisierung der Audio-Assets
function initAudio() {
    const soundList = ['click', 'join', 'start', 'kill', 'win'];
    soundList.forEach(name => {
        audioAssets[name] = new Audio(`assets/${name}.mp3`);
    });
}

function playSound(name) {
    if (audioAssets[name]) {
        audioAssets[name].currentTime = 0;
        audioAssets[name].play().catch(() => {});
    }
}

// Tab-Steuerung
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = tab;

        if (tab === 'ffa' || tab === 'list') {
            document.getElementById('tab-browser').style.display = 'flex';
            document.getElementById('tab-create').style.display = 'none';
            document.getElementById('sidebar-filters').style.display = (tab === 'list' ? 'block' : 'none');
            fetchLobbies();
        } else if (tab === 'create') {
            document.getElementById('tab-browser').style.display = 'none';
            document.getElementById('tab-create').style.display = 'flex';
        }
    });
});

// Slider-Sync
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

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupConfig(data.config, data.maps);
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
            showLobbyWaitingArea(data.lobby);
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
                document.getElementById('hud-timer').innerText = '∞';
            }
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health').style.width = `${data.health}%`;
            document.getElementById('hud-armor').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'countdown':
            const cd = document.getElementById('big-countdown');
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

function setupConfig(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Maps Dropdown
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    // Loadout Multi-Select
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
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const filterFreeOnly = document.getElementById('filter-free-slots').checked;

    lobbies.forEach(lobby => {
        if (filterFreeOnly && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info">
                <h4>${lobby.name}</h4>
                <p>${lobby.mapLabel} | ${lobby.mode.toUpperCase()} | Host: ${lobby.hostName}</p>
            </div>
            <div class="lobby-players">
                <i class="fa-solid fa-users"></i> ${lobby.playerCount} / ${lobby.maxPlayers}
            </div>
            <div class="lobby-status">
                <span class="status-${lobby.status.toLowerCase()}">${lobby.status}</span>
            </div>
            <div class="lobby-actions">
                <button class="confirm-btn" onclick="joinLobby('${lobby.id}')">BEITRETEN</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: lobbyId })
    });
}

function showLobbyWaitingArea(lobby) {
    currentLobby = lobby;
    document.getElementById('lobby-title-display').innerText = lobby.name;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    // Check if we are the host
    // The server doesn't explicitly send a "youAreHost" flag here,
    // but we can check the player list when it arrives or rely on lobbyCreated vs lobbyJoined
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';

    // Find myself in players to see if I'm host
    // Assuming the server sends my ID somehow or we track it.
    // Let's assume the server sends 'isHost' for each player relative to the lobby.

    let amIHost = false;

    players.forEach(p => {
        // In reality, we'd need to know which 'p' is the local player.
        // For now, let's use a placeholder check or rely on server-side host logic.
        if (p.isHost && p.isLocal) amIHost = true; // hypothetically

        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${currentLobby && currentLobby.hostPlayerId === p.id ? '' : '' /* Kick button logic */}
        `;

        // If I am host, I can kick others
        // We'll need the local player's server ID to be sure.

        container.appendChild(div);
    });

    // Simple Host UI toggle (this needs refinement with real IDs)
    // For now, we'll show host buttons if currentLobby.host matches someone.
    // In cl_lobby.lua, we should send if the player is the host.
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'block';
        document.querySelector('.score-blue').innerText = data.scoreBlue || 0;
        document.querySelector('.score-red').innerText = data.scoreRed || 0;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName;

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const votingList = document.getElementById('map-voting-list');
    votingList.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `
            <div class="vote-name">${map.label}</div>
            <div class="vote-count" id="vote-count-${map.id}">0</div>
        `;
        div.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        votingList.appendChild(div);
    });
}

// Event Listeners for Buttons
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.getElementById('loadout-select').selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'Meine Lobby',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts[0], // For now, keep it simple or update server to handle array
        loadouts: selectedLoadouts,
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

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// Auto-Refresh Lobbies
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        (currentTab === 'ffa' || currentTab === 'list')) {
        fetchLobbies();
    }
}, 5000);

initAudio();
