let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let selectedLoadouts = [];
let lobbiesCache = [];

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
            lobbiesCache = data.lobbies;
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
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            document.getElementById('game-hud').style.display = 'flex';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'flex';
            if (data.mode === 'tdm') {
                document.getElementById('hud-score-ffa').style.display = 'none';
                document.getElementById('hud-score-tdm').style.display = 'flex';
            } else {
                document.getElementById('hud-score-ffa').style.display = 'flex';
                document.getElementById('hud-score-tdm').style.display = 'none';
            }
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer-val').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills-val').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths-val').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.getElementById('score-blue-val').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('score-red-val').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('health-bar').style.width = `${data.health}%`;
            document.getElementById('armor-bar').style.width = `${data.armor}%`;
            document.getElementById('hud-ammo-val').innerText = data.ammo;
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') el.placeholder = locales[key];
            else el.innerText = locales[key];
        }
    });
}

function setupInitialData(config, maps) {
    applyLocalization(config.Locales[config.Locale]);

    // Setup Maps Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    // Setup Loadout Grid
    const loadoutGrid = document.getElementById('loadout-grid');
    loadoutGrid.innerHTML = '';
    selectedLoadouts = [];
    for (let key in config.WeaponLoadouts) {
        const item = document.createElement('div');
        item.className = 'loadout-item';
        item.dataset.loadout = key;
        item.innerHTML = `<span>${config.WeaponLoadouts[key].label.toUpperCase()}</span>`;
        item.onclick = () => {
            playSound('click');
            if (item.classList.contains('selected')) {
                item.classList.remove('selected');
                selectedLoadouts = selectedLoadouts.filter(l => l !== key);
            } else {
                item.classList.add('selected');
                selectedLoadouts.push(key);
            }
        };
        loadoutGrid.appendChild(item);
    }

    // Setup Map Voting Grid (Winner Screen)
    const mapVoteGrid = document.getElementById('map-vote-grid');
    mapVoteGrid.innerHTML = '';
    maps.slice(0, 4).forEach(map => {
        const item = document.createElement('div');
        item.className = 'map-vote-item';
        item.innerHTML = `
            <img src="https://via.placeholder.com/200x100/0f1419/ffffff?text=${map.label}" alt="${map.label}">
            <div class="map-vote-label">${map.label.toUpperCase()}</div>
        `;
        item.onclick = () => {
            playSound('click');
            document.querySelectorAll('.map-vote-item').forEach(el => el.classList.remove('voted'));
            item.classList.add('voted');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        mapVoteGrid.appendChild(item);
    });
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = btn.dataset.tab;

        if (currentTab === 'create') {
            document.getElementById('tab-content-browser').style.display = 'none';
            document.getElementById('tab-content-create').style.display = 'block';
        } else {
            document.getElementById('tab-content-browser').style.display = 'block';
            document.getElementById('tab-content-create').style.display = 'none';
            fetchLobbies();
        }
    });
});

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

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const mapLabel = lobby.mapLabel || 'UNKNOWN';

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="https://via.placeholder.com/140x80/0f1419/ffffff?text=${mapLabel}" alt="${mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name.toUpperCase()}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${mapLabel} | ${lobby.mode.toUpperCase()}
                </div>
            </div>
            <div class="player-count-text">${playerCount}/${maxPlayers}</div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">JOIN</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    const lobby = lobbiesCache.find(l => l.id === lobbyId);
    if (lobby && lobby.isPersistent) {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: lobby.mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId })
        });
    }
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadouts: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
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

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
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

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    const number = document.getElementById('countdown-number');

    if (seconds <= 0) {
        overlay.style.display = 'none';
        return;
    }

    overlay.style.display = 'flex';
    number.innerText = seconds;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = (data.winnerName || 'UNKNOWN').toUpperCase() + " WINS!";

    const statsTable = document.getElementById('match-stats-table');
    if (data.stats) {
        let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
        data.stats.forEach(s => {
            html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
        });
        html += `</tbody></table>`;
        statsTable.innerHTML = html;
    }
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
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
