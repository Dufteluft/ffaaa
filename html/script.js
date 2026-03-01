let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Audio Setup
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

// Tab-Steuerung
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;
        playSound('click');
        switchTab(tab);
    });
});

function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');

    // UI-Elemente je nach Tab anpassen
    const sidebar = document.getElementById('sidebar-filters');
    const listTab = document.getElementById('tab-content-list');
    const createTab = document.getElementById('tab-content-create');

    if (tab === 'create') {
        sidebar.classList.add('hidden');
        listTab.classList.remove('active');
        createTab.classList.add('active');
    } else {
        sidebar.classList.remove('hidden');
        listTab.classList.add('active');
        createTab.classList.remove('active');
        fetchLobbies(); // Daten für Tab 1 oder 3 laden
    }
}

// Slider-Sync & Initialisierung
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

// NUI Message-Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            switchTab('ffa'); // Standardtab beim Öffnen
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
            document.getElementById('game-hud').style.display = 'block';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Filter-Dropdowns befüllen
    const filterMaps = document.getElementById('filter-maps');
    filterMaps.innerHTML = '<option value="all">ALLE MAPS</option>';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        filterMaps.appendChild(opt);
    });

    // Erstellungs-Dropdowns befüllen
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.toUpperCase();
        loadoutSelect.appendChild(opt);
    }

    // Lokalisierung anwenden (Vereinfacht)
    if (config.Locales && config.Locales[config.Locale]) {
        const lang = config.Locales[config.Locale];
        for (let key in lang) {
            const el = document.getElementById(`locale-${key.replace(/_/g, '-')}`);
            if (el) el.innerText = lang[key].toUpperCase();
        }
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

    if (lobbies.length === 0) {
        container.innerHTML = '<div class="no-lobbies">KEINE AKTIVEN LOBBYS GEFUNDEN</div>';
        return;
    }

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const status = lobby.status || 'waiting';

        item.innerHTML = `
            <div class="map-preview">
                <img src="assets/map_${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/140x80/111/fff?text=${lobby.mapLabel}'">
            </div>
            <div class="info-main">
                <div class="match-type">${lobby.name.toUpperCase()}</div>
                <div class="map-name"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | ${lobby.mode.toUpperCase()}</div>
            </div>
            <div class="player-count">
                <span style="font-weight: 900; font-size: 18px;">${playerCount}/${maxPlayers}</span>
            </div>
            <div class="status-badge status-${status.toLowerCase()}">${status}</div>
            <div class="actions">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">BEITRETEN</button>
            </div>
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

// Lobby Erstellung
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA MATCH',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: document.getElementById('loadout-select').value,
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

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title-display').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('host-edit-settings').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-item"><span>MAP:</span> <strong>${lobby.mapLabel}</strong></div>
        <div class="info-item"><span>MODUS:</span> <strong>${lobby.mode.toUpperCase()}</strong></div>
        <div class="info-item"><span>ZEIT:</span> <strong>${lobby.roundTime} MIN</strong></div>
        <div class="info-item"><span>LIMIT:</span> <strong>${lobby.killLimit > 0 ? lobby.killLimit : 'AUS'}</strong></div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <div class="player-info">
                <span style="font-weight: 800;">${p.name.toUpperCase()}</span>
                <span style="font-size: 10px; color: #aaa; margin-left: 10px;">${p.team.toUpperCase()}</span>
            </div>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        // Spiel starten Button nur aktiv wenn mind. 2 Spieler (oder 1 für Debug/Solo)
        document.getElementById('btn-start-game').disabled = players.length < 1;
    }
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-time-left').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-scores').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-scores').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) {
        document.getElementById('hud-health-bar').style.width = `${data.health}%`;
    }
    if (data.armor !== undefined) {
        document.getElementById('hud-armor-bar').style.width = `${data.armor}%`;
    }
    if (data.ammo !== undefined) {
        document.getElementById('hud-ammo').innerText = data.ammo;
    }
}

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    const text = document.getElementById('countdown-text');

    if (seconds > 0) {
        overlay.style.display = 'flex';
        text.innerText = seconds;
        playSound('click');
    } else {
        overlay.style.display = 'none';
        playSound('start');
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName.toUpperCase();

    const tbody = document.getElementById('match-stats-body');
    tbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${s.name.toUpperCase()}</td>
            <td>${s.kills}</td>
            <td>${s.deaths}</td>
            <td>${s.kd}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Event-Listener für Lobby-Aktionen
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

// Chat
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

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color: var(--primary)">${name}:</strong> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// Winner Actions
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

// UI Schließen
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh für Lobbyliste (alle 5 Sekunden)
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none' &&
        currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
