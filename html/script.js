let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// Audio engine
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
        audioAssets[name].play().catch(() => {});
    }
}

// Localization Engine
function applyLocalization(locale) {
    const translations = serverConfig.Locales[locale];
    if (!translations) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (translations[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = translations[key];
            } else {
                el.innerText = translations[key];
            }
        }
    });
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.dataset.tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        currentTab = btn.dataset.tab;
        if (currentTab === 'create') {
            document.getElementById('tab-create-lobby').classList.add('active');
        } else {
            document.getElementById('tab-lobby-list').classList.add('active');
            fetchLobbies();
        }
    });
});

// Slider Value Sync
const syncSlider = (id) => {
    const slider = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (slider && val) {
        slider.addEventListener('input', () => {
            val.innerText = slider.value;
        });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(syncSlider);

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            applyLocalization(data.config.Locale);
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
            showLobbyArea(data.lobby, data.action === 'lobbyCreated' || (currentLobby && currentLobby.hostId == myPlayerId));
            break;
        case 'leftLobby':
            document.getElementById('lobby-waiting-area').style.display = 'none';
            currentLobby = null;
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
            document.getElementById('countdown-overlay').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('hud').style.display = 'block';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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
        case 'setMyId':
            myPlayerId = data.id;
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

    const freeOnly = document.getElementById('filter-slots').value === 'free';
    const translations = serverConfig.Locales[serverConfig.Locale];

    lobbies.forEach(lobby => {
        if (freeOnly && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}
                </div>
            </div>
            <div class="player-count-box">
                <div class="count-val">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <div class="count-label">${translations['tab_players']}</div>
            </div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${translations['btn_join']}</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: lobbyId }) // Quick join uses mapId as lobby identifier in Tab 1
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobbyId })
        });
    }
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.getElementById('loadout-select').selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'all',
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

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    updateLobbyInfo(lobby);
}

function updateLobbyInfo(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-item">MAP: ${lobby.mapLabel}</div>
        <div class="info-item">MODE: ${lobby.mode.toUpperCase()}</div>
        <div class="info-item">TIME: ${lobby.roundTime} MIN</div>
        <div class="info-item">LIMIT: ${lobby.killLimit > 0 ? lobby.killLimit : 'OFF'}</div>
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
            <span style="font-size: 10px; color: var(--text-muted);">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(pid) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: pid })
    });
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';
    msgEl.innerHTML = `<span class="name">${name}:</span><span class="text">${message}</span>`;
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    const display = document.getElementById('big-countdown');

    if (seconds > 0) {
        overlay.style.display = 'flex';
        display.innerText = seconds;
        playSound('click');
    } else {
        overlay.style.display = 'none';
        playSound('start');
    }
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health').style.width = `${Math.max(0, data.health)}%`;
    document.getElementById('hud-armor').style.width = `${data.armor}%`;
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    renderMapVoting();
}

function renderMapVoting() {
    const container = document.getElementById('map-vote-list');
    container.innerHTML = '';
    // Choose 3 random maps for voting
    const shuffled = [...serverMaps].sort(() => 0.5 - Math.random());
    shuffled.slice(0, 3).forEach(map => {
        const btn = document.createElement('div');
        btn.className = 'vote-item';
        btn.innerText = map.label.toUpperCase();
        btn.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        container.appendChild(btn);
    });
}

// Basic Button Listeners
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

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="ffa"]').click();
});

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
