let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let lobbiesCache = [];
let currentLobby = null;
let isHost = false;

function applyLocalization(locale) {
    const lang = serverConfig.Locales[locale] || serverConfig.Locales['en'];
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (lang[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = lang[key];
            } else {
                el.textContent = lang[key];
            }
        }
    });
}

function playSound(name) {
    const audio = new Audio(`assets/${name}.mp3`);
    audio.volume = 0.5;
    audio.play().catch(() => {});
}

window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            serverConfig = data.config;
            serverMaps = data.maps;
            setupFormInitialData();
            document.getElementById('app').style.display = 'flex';
            applyLocalization(serverConfig.Locale);
            fetchLobbies();
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            lobbiesCache = data.lobbies;
            renderLobbyList(lobbiesCache);
            break;
        case 'joinLobby':
            showLobbyArea(data.lobby, data.isHost);
            break;
        case 'updatePlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'startCountdown':
            showCountdown(data.seconds);
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupFormInitialData() {
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    serverMaps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.textContent = map.label;
        mapSelect.appendChild(opt);
    });

    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (const [id, data] of Object.entries(serverConfig.WeaponLoadouts)) {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = data.label;
        loadoutSelect.appendChild(opt);
    }
}

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        currentTab = tab;
        document.getElementById(`tab-${tab}`).classList.add('active');

        playSound('click');
        if (tab === 'ffa' || tab === 'lobby') {
            fetchLobbies();
        }
    });
});

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
        const empty = document.createElement('div');
        empty.className = 'info-box';
        empty.style.width = '100%';
        empty.style.textAlign = 'center';
        empty.textContent = (serverConfig.Locales[serverConfig.Locale] || serverConfig.Locales['en'])['waiting_for_players'];
        container.appendChild(empty);
        return;
    }

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-name">${lobby.name}</div>
                <div class="match-details">
                    <span><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-crosshairs"></i> ${lobby.mode.toUpperCase()}</span>
                    <span><i class="fa-solid fa-user-crown"></i> ${lobby.hostName}</span>
                </div>
            </div>
            <div class="player-count">
                <div class="count">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <div class="label" data-locale="players">Spieler</div>
            </div>
            <div class="action-area">
                <button class="action-btn" onclick="joinLobbyAction('${lobby.id}')" data-locale="btn_join">Beitreten</button>
            </div>
        `;
        container.appendChild(item);
    });
    applyLocalization(serverConfig.Locale);
}

function joinLobbyAction(lobbyId) {
    playSound('click');
    const endpoint = currentTab === 'ffa' ? 'quickJoin' : 'joinLobby';
    const lobby = lobbiesCache.find(l => l.id === lobbyId);
    const body = currentTab === 'ffa' ? { mapId: lobby.mapId } : { lobbyId };

    fetch(`https://${GetParentResourceName()}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(body)
    });
}

document.getElementById('btn-create-lobby-submit').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = Array.from(document.getElementById('loadout-select').selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
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

document.getElementById('btn-create-cancel').addEventListener('click', () => {
    playSound('click');
    document.querySelector('.tab-btn[data-tab="ffa"]').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').textContent = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="info-box">
            <div class="label" data-locale="map_select">MAP</div>
            <div class="value">${lobby.mapLabel}</div>
        </div>
        <div class="info-box">
            <div class="label" data-locale="mode_select">MODE</div>
            <div class="value">${lobby.mode.toUpperCase()}</div>
        </div>
        <div class="info-box">
            <div class="label" data-locale="round_time">TIME</div>
            <div class="value">${lobby.roundTime} MIN</div>
        </div>
    `;
    applyLocalization(serverConfig.Locale);
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';

    players.forEach(p => {
        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;

        const lang = serverConfig.Locales[serverConfig.Locale] || serverConfig.Locales['en'];
        const teamLabel = lang['team_' + p.team] || p.team.toUpperCase();

        item.innerHTML = `
            <div class="player-info">
                <span class="name">${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
                <span class="team-badge" style="font-size: 10px; color: var(--text-muted); margin-left: 10px;">${teamLabel}</span>
            </div>
            <div class="player-actions">
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-minus"></i></button>` : ''}
            </div>
        `;
        list.appendChild(item);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
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

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg';
    const nameSpan = document.createElement('span');
    nameSpan.className = 'name';
    nameSpan.textContent = name + ': ';
    const textSpan = document.createElement('span');
    textSpan.className = 'text';
    textSpan.textContent = message;
    msg.appendChild(nameSpan);
    msg.appendChild(textSpan);
    chat.appendChild(msg);
    chat.scrollTop = chat.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim().length > 0) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

function showCountdown(seconds) {
    const countdownEl = document.getElementById('countdown-message');
    if (seconds <= 0) {
        countdownEl.style.display = 'none';
        document.getElementById('app').style.display = 'none';
        return;
    }

    countdownEl.style.display = 'block';
    const lang = serverConfig.Locales[serverConfig.Locale] || serverConfig.Locales['en'];
    countdownEl.textContent = lang['countdown'].replace('%s', seconds);
}

function updateHUD(data) {
    const hud = document.getElementById('match-hud');
    hud.style.display = 'flex';

    document.getElementById('hud-timer').textContent = data.timer;
    document.getElementById('hud-kills').textContent = data.kills;
    document.getElementById('hud-deaths').textContent = data.deaths;

    document.getElementById('health-bar').style.width = `${data.health}%`;
    document.getElementById('armor-bar').style.width = `${data.armor}%`;
    document.getElementById('hud-ammo').textContent = data.ammo;

    if (data.mode === 'tdm') {
        document.getElementById('hud-team-scores').style.display = 'flex';
        document.getElementById('score-blue').textContent = data.scoreBlue;
        document.getElementById('score-red').textContent = data.scoreRed;
    } else {
        document.getElementById('hud-team-scores').style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('match-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').textContent = data.winnerName + " WINS!";

    const tableContainer = document.getElementById('match-stats-table');
    tableContainer.innerHTML = '';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = `<tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableContainer.appendChild(table);

    // Map Voting
    const voteGrid = document.getElementById('map-voting-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 4).forEach(map => {
        const item = document.createElement('div');
        item.className = 'vote-item';
        item.innerHTML = `<div class="map-name">${map.label}</div>`;
        item.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            item.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteGrid.appendChild(item);
    });
}

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
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
