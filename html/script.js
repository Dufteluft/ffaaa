let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let selectedVoteMap = null;

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

// Localization helper
function setLocales(locales) {
    if (!locales) return;
    for (let key in locales) {
        const elements = document.querySelectorAll(`#l-${key}, .l-${key}`);
        elements.forEach(el => {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locales[key];
            } else {
                el.innerText = locales[key];
            }
        });
    }
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
            document.getElementById('lobby-list-view').style.display = 'none';
            document.getElementById('sidebar-filters').style.display = 'none';
            document.getElementById('create-lobby-view').style.display = 'block';
        } else {
            document.getElementById('lobby-list-view').style.display = 'block';
            document.getElementById('sidebar-filters').style.display = 'flex';
            document.getElementById('create-lobby-view').style.display = 'none';
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
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            setLocales(data.config.Locales[data.config.Locale]);
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
            document.getElementById('winner-screen').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-team-scores').style.display = data.isPersistent ? 'none' : 'flex';
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
            handleCountdown(data.seconds);
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

    // Loadout Grid (Checkboxes)
    const loadoutGrid = document.getElementById('loadout-checkbox-grid');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}">
            <span>${config.WeaponLoadouts[key][0].label}</span>
        `;
        loadoutGrid.appendChild(label);
    }
}

function fetchLobbies() {
    const filters = {
        tab: currentTab,
        map: document.getElementById('filter-maps').value,
        full: document.getElementById('filter-players').value
    };
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify(filters));
}

// Filter Listeners
document.getElementById('filter-maps').addEventListener('change', fetchLobbies);
document.getElementById('filter-players').addEventListener('change', fetchLobbies);

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';

        const mapImg = `https://via.placeholder.com/120x70/1a1f2e/ffffff?text=${lobby.mapLabel}`;

        div.innerHTML = `
            <div class="lobby-map-preview"><img src="${mapImg}"></div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} • ${lobby.mode.toUpperCase()}</div>
            </div>
            <div class="player-count-badge">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="action-area">
                ${lobby.playerCount >= lobby.maxPlayers ?
                    `<button class="action-btn btn-disabled" disabled>VOLL</button>` :
                    `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}', '${lobby.isPersistent}')">BEITRETEN</button>`
                }
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId, isPersistent) {
    playSound('click');
    if (isPersistent === 'true') {
        const lobby = serverMaps.find(m => m.id === lobbyId) || { id: lobbyId };
        $.post(`https://${GetParentResourceName()}/quickJoin`, JSON.stringify({ mapId: lobby.id }));
    } else {
        $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
    }
}

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
        <p>LIMIT: ${lobby.killLimit}</p>
    `;

    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span style="font-size: 10px; color: #888;">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-circle-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer-val').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills-val').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths-val').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-team-scores').style.display = 'flex';
        if (data.scoreBlue !== undefined) document.getElementById('score-blue-val').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.getElementById('score-red-val').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-team-scores').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) {
        const health = Math.max(0, data.health);
        document.getElementById('hud-health-bar').style.width = health + '%';
        document.getElementById('hud-health-val').innerText = health;
    }
    if (data.armor !== undefined) {
        document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    }
    if (data.ammo !== undefined) {
        document.getElementById('hud-ammo-val').innerText = data.ammo;
    }
}

function handleCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Chat
function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<b style="color: var(--primary)">${name}:</b> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('send-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendChat(); });

function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (msg) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        input.value = '';
    }
}

// Create Lobby
document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('input[name="loadout"]:checked').forEach(cb => selectedLoadouts.push(cb.value));

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

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    document.querySelector('[data-tab="ffa"]').click();
});

// Lobby Actions
document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`, JSON.stringify({}));
});

document.getElementById('btn-start-game').addEventListener('click', () => {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`, JSON.stringify({}));
});

document.getElementById('btn-leave-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/closeLobby`, JSON.stringify({}));
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: btn.dataset.team }));
    });
});

// Winner Screen & Map Vote
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Render Map Vote
    const voteGrid = document.getElementById('map-vote-grid');
    voteGrid.innerHTML = '';
    serverMaps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `<span class="vote-label">${map.label.toUpperCase()}</span>`;
        div.onclick = () => {
            selectedVoteMap = map.id;
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId: map.id }));
        };
        voteGrid.appendChild(div);
    });
}

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`, JSON.stringify({}));
});

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
});

// Global UI close
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        $.post(`https://${GetParentResourceName()}/closeUI`, JSON.stringify({}));
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
