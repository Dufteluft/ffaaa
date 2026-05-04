let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let myPlayerId = null;
let currentLobby = null;
let isHost = false;
let lobbiesCache = [];

// Sound Effekte
const audio = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    start: new Audio('assets/start.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3')
};

function playSound(name) {
    if (audio[name]) {
        audio[name].currentTime = 0;
        audio[name].play().catch(e => console.log('Audio play failed', e));
    }
}

// Lokalisierung anwenden
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locales[key];
            } else {
                el.innerText = locales[key];
            }
        }
    });
}

// Tab-Wechsel
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
        if (tab === 'ffa' || tab === 'lobby') {
            fetchLobbies();
        }
    });
});

// Slider-Werte synchronisieren
const bindSlider = (id, valId) => {
    const slider = document.getElementById(id);
    const label = document.getElementById(valId);
    if (slider && label) {
        slider.addEventListener('input', () => { label.innerText = slider.value; });
    }
};
bindSlider('create-time', 'val-time');
bindSlider('create-players', 'val-players');
bindSlider('create-respawn', 'val-respawn');
bindSlider('create-kills', 'val-kills');

// NUI Message Handler
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            serverConfig = data.config;
            serverMaps = data.maps;
            setupFormOptions();
            applyLocalization(serverConfig.Locales[serverConfig.Locale]);
            fetchLobbies();
            if (data.stats) updateSidebarStats(data.stats);
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
            isHost = (data.lobby.host === data.myId);
            myPlayerId = data.myId;
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
            playSound('start');
            break;

        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-team-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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

        case 'receiveStats':
            updateSidebarStats(data.stats);
            break;

        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupFormOptions() {
    const mapSelect = document.getElementById('create-map');
    mapSelect.innerHTML = '';
    serverMaps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('create-loadout');
    loadoutSelect.innerHTML = '';
    for (let key in serverConfig.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }
}

function fetchLobbies() {
    if (typeof GetParentResourceName === 'undefined') return;
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: currentTab })
    });
}

function renderLobbyList(lobbies) {
    const container = currentTab === 'ffa' ? document.getElementById('ffa-list-container') : document.getElementById('lobby-list-container');
    container.innerHTML = '';

    const searchTerm = document.getElementById('lobby-search').value.toLowerCase();
    const filterFree = document.getElementById('filter-free').checked;

    lobbies.forEach(lobby => {
        // Filterung für Tab 3
        if (currentTab === 'lobby') {
            if (searchTerm && !lobby.name.toLowerCase().includes(searchTerm)) return;
            if (filterFree && lobby.playerCount >= lobby.maxPlayers) return;
        }

        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info">
                <div class="lobby-name">${lobby.name}</div>
                <div class="lobby-meta">
                    <span><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-trophy"></i> ${lobby.mode.toUpperCase()}</span>
                    ${lobby.hostName ? `<span><i class="fa-solid fa-user-crown"></i> ${lobby.hostName}</span>` : ''}
                </div>
            </div>
            <div class="player-count">${lobby.playerCount} / ${lobby.maxPlayers}</div>
            <button class="btn-join" onclick="joinLobby('${lobby.id}')" data-locale="btn_join">Beitreten</button>
        `;
        container.appendChild(item);
    });

    // Lokalisierung für neu erstellte Buttons
    applyLocalization(serverConfig.Locales[serverConfig.Locale]);
}

window.joinLobby = (id) => {
    playSound('click');
    const lobby = lobbiesCache.find(l => l.id === id);
    const action = (lobby && lobby.isPersistent) ? 'quickJoin' : 'joinLobby';

    fetch(`https://${GetParentResourceName()}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: id, mapId: lobby ? lobby.mapId : null })
    });
};

// Lobby Erstellung
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('create-loadout');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('create-name').value || 'Meine Lobby',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts[0] : 'all', // Wir nehmen für den Start eins, Server kann Liste verarbeiten
        loadouts: selectedLoadouts,
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked,
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-kills').value)
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

function showLobbyWaitingArea(lobby) {
    document.getElementById('lobby-display-name').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-status-tag').innerText = lobby.status.toUpperCase();

    const summary = document.getElementById('lobby-settings-summary');
    summary.innerHTML = `
        <div>MAP: ${lobby.mapLabel}</div>
        <div>MODUS: ${lobby.mode.toUpperCase()}</div>
        <div>ZEIT: ${lobby.roundTime} MIN</div>
        <div>KILLS: ${lobby.killLimit > 0 ? lobby.killLimit : '∞'}</div>
        <div>RESPAWN: ${lobby.respawnTime}s</div>
        <div>CARS: ${lobby.vehiclesAllowed ? 'JA' : 'NEIN'}</div>
    `;

    document.getElementById('btn-start-game').style.display = isHost ? 'block' : 'none';
    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <div class="p-info">
                <strong>${p.name}</strong>
                <small>${p.team.toUpperCase()}</small>
            </div>
            <div class="p-actions">
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
                ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}
            </div>
        `;
        container.appendChild(item);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

window.kickPlayer = (id) => {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
};

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
            body: JSON.stringify({ team: btn.getAttribute('data-team') })
        });
    });
});

// Chat
const sendChat = () => {
    const input = document.getElementById('chat-input');
    if (input.value.trim().length > 0) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: input.value })
        });
        input.value = '';
    }
};
document.getElementById('btn-send-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keypress', (e) => { if(e.key === 'Enter') sendChat(); });

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    document.getElementById('hud-health').style.width = `${data.health}%`;
    document.getElementById('hud-armor').style.width = `${data.armor}%`;
    document.getElementById('hud-ammo').innerText = data.ammo;
    // Waffennamen-Update könnte hier auch rein
}

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    const number = document.getElementById('countdown-number');

    if (seconds > 0) {
        overlay.style.display = 'flex';
        number.innerText = seconds;
    } else {
        overlay.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-text').innerText = `GEWINNER: ${data.winnerName}`;

    const body = document.getElementById('end-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        body.appendChild(tr);
    });

    const grid = document.getElementById('map-voting-grid');
    grid.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const item = document.createElement('div');
        item.className = 'map-vote-item';
        item.innerText = map.label;
        item.onclick = () => {
            document.querySelectorAll('.map-vote-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        grid.appendChild(item);
    });
}

document.getElementById('btn-back-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-back-main').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

function updateSidebarStats(stats) {
    document.getElementById('stat-kills').innerText = stats.kills || 0;
    document.getElementById('stat-deaths').innerText = stats.deaths || 0;
    const kd = (stats.deaths > 0) ? (stats.kills / stats.deaths).toFixed(2) : (stats.kills || 0).toFixed(2);
    document.getElementById('stat-kd').innerText = kd;
    document.getElementById('stat-wins').innerText = stats.wins || 0;
}

// Suche & Filter in Tab 3
document.getElementById('lobby-search').addEventListener('input', () => renderLobbyList(lobbiesCache));
document.getElementById('filter-free').addEventListener('change', () => renderLobbyList(lobbiesCache));

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Refresh alle 5s
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' && (currentTab === 'ffa' || currentTab === 'lobby')) {
        fetchLobbies();
    }
}, 5000);
