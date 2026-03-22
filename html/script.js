let currentLobby = null;
let isHost = false;
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
        if (tab === currentTab) return;
        playSound('click');

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        if (tab === 'ffa' || tab === 'list') {
            document.getElementById('tab-browser').classList.add('active');
            currentTab = tab;
            fetchLobbies();
        } else {
            document.getElementById('tab-create').classList.add('active');
            currentTab = tab;
        }
    });
});

// Slider Value Displays
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
            document.getElementById('hud-tdm-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-round-time').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
            if (data.mode) document.getElementById('hud-tdm-scores').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health-fill').style.width = data.health + '%';
            document.getElementById('hud-armor-fill').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'countdown':
            const overlay = document.getElementById('hud-countdown-overlay');
            if (data.seconds > 0) {
                overlay.style.display = 'flex';
                document.getElementById('hud-countdown-text').innerText = data.seconds;
            } else {
                overlay.style.display = 'none';
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    setLocales(config.Locales[config.Locale]);

    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        if (key === 'all') continue;
        const div = document.createElement('div');
        div.className = 'loadout-item';
        div.innerHTML = `
            <input type="checkbox" id="wep-${key}" value="${key}">
            <label for="wep-${key}">${key.toUpperCase()}</label>
        `;
        loadoutGrid.appendChild(div);
    }
}

function setLocales(locales) {
    if (!locales) return;
    for (let key in locales) {
        const elements = document.querySelectorAll(`.l-${key}`);
        elements.forEach(el => {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locales[key];
            } else {
                el.innerText = locales[key].toUpperCase();
            }
        });
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
    if (!lobbies) return;

    lobbies.forEach((lobby, index) => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.style.animationDelay = `${index * 0.05}s`;

        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL'}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
            </div>
            <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="status-badge">${lobby.status}</div>
            <button class="action-btn" onclick="joinLobby('${lobby.id}')">BEITRETEN</button>
        `;
        container.appendChild(div);
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
    const loadouts = [];
    document.querySelectorAll('#loadout-checkboxes input:checked').forEach(cb => loadouts.push(cb.value));

    if (loadouts.length === 0) loadouts.push('pistol');

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: loadouts, // Pass as array
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        vehiclesAllowed: document.getElementById('vehicles-toggle').checked,
        friendlyFire: document.getElementById('ff-toggle').checked,
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

    document.getElementById('lobby-info-summary').innerHTML = `
        MAP: ${lobby.mapLabel} | MODE: ${lobby.mode.toUpperCase()}<br>
        TIME: ${lobby.roundTime} MIN | MAX: ${lobby.maxPlayers}<br>
        RESPAWN: ${lobby.respawnTime}s | LIMIT: ${lobby.killLimit}
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    if (!players) return;

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''} ${p.isHost ? 'host-mark' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '★' : ''}</span>
            <span style="font-size: 10px; color: var(--text-muted)">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>` : ''}
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

function addChatMessage(name, msg) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<span class="chat-msg-name">${name}:</span> <span>${msg}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('btn-send-chat').addEventListener('click', () => {
    const input = document.getElementById('chat-input');
    const msg = input.value;
    if (msg.trim().length > 0) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: msg })
        });
        input.value = '';
    }
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-send-chat').click();
});

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('app').style.display = 'flex'; // Ensure app is visible
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const voteGrid = document.getElementById('map-vote-grid');
    voteGrid.innerHTML = '';
    serverMaps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'map-vote-item';
        div.innerHTML = `<span>${map.label.toUpperCase()}</span>`;
        div.onclick = () => {
            document.querySelectorAll('.map-vote-item').forEach(i => i.classList.remove('voted'));
            div.classList.add('voted');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteGrid.appendChild(div);
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

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
