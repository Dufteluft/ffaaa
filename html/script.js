let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

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
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            el.innerText = locales[key];
        }
    });
}

// Tab Management
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = tab;
        if (tab === 'ffa' || tab === 'list') {
            document.getElementById('tab-browser').style.display = 'block';
            document.getElementById('tab-create').style.display = 'none';
            fetchLobbies();
        } else if (tab === 'create') {
            document.getElementById('tab-browser').style.display = 'none';
            document.getElementById('tab-create').style.display = 'block';
        }
    });
});

// Slider Value Sync
function setupSlider(id, valId) {
    const slider = document.getElementById(id);
    const val = document.getElementById(valId);
    slider.addEventListener('input', () => {
        val.innerText = slider.value;
    });
}
setupSlider('create-time', 'val-time');
setupSlider('create-players', 'val-players');
setupSlider('create-respawn', 'val-respawn');
setupSlider('create-kills', 'val-kills');

// Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;
    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);
            myPlayerId = data.myId;
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
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health').style.width = data.health + '%';
            document.getElementById('hud-armor').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
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

    const mapSelect = document.getElementById('create-map');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        mapSelect.innerHTML += `<option value="${map.id}">${map.label}</option>`;
    });

    const loadoutSelect = document.getElementById('create-loadout');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        loadoutSelect.innerHTML += `<option value="${key}">${key.toUpperCase()}</option>`;
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

    const freeOnly = document.getElementById('filter-free-slots').checked;
    const search = document.getElementById('lobby-search').value.toLowerCase();

    lobbies.forEach(lobby => {
        if (freeOnly && lobby.playerCount >= lobby.maxPlayers) return;
        if (search && !lobby.name.toLowerCase().includes(search) && !lobby.mapLabel.toLowerCase().includes(search)) return;

        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-row">
                <span class="lobby-name">${lobby.name}</span>
                <span class="lobby-players">${lobby.playerCount}/${lobby.maxPlayers}</span>
            </div>
            <div class="lobby-info-row">
                <span class="lobby-map"><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                <span class="lobby-mode">${lobby.mode.toUpperCase()}</span>
            </div>
            <div class="lobby-actions">
                <button class="join-btn" onclick="joinLobby('${lobby.id}', ${lobby.isPersistent})">
                    ${lobby.status === 'ACTIVE' ? 'ZUSCHAUEN' : 'BEITRETEN'}
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId, isPersistent) {
    playSound('click');
    if (isPersistent) {
        const lobby = serverMaps.find(m => "FFA " + m.label === "FFA " + serverMaps.find(sm => sm.id === lobbyId || sm.label === lobbyId || true).label); // Hacky find
        // Better: persistent lobbies pass their mapId as well
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: lobbyId }) // Server handles finding the right persistent lobby
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobbyId })
        });
    }
}

document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('create-loadout');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('create-name').value || 'Meine Lobby',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: selectedLoadouts[0], // For now, handle single. Logic can be expanded.
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

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    document.getElementById('waiting-lobby-name').innerText = lobby.name;
    document.getElementById('waiting-lobby-id').innerText = lobby.id;
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-host-start').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-host-close').style.display = asHost ? 'block' : 'none';

    document.getElementById('waiting-settings').innerHTML = `
        <p>Map: ${lobby.mapLabel}</p>
        <p>Modus: ${lobby.mode.toUpperCase()}</p>
        <p>Limit: ${lobby.killLimit > 0 ? lobby.killLimit + ' Kills' : 'Deaktiviert'}</p>
    `;

    document.getElementById('team-selector').style.display = lobby.mode === 'tdm' ? 'flex' : 'none';
}

function renderPlayerList(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold"></i>' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button onclick="kickPlayer('${p.id}')" class="kick-btn"><i class="fa-solid fa-user-slash"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

document.getElementById('btn-toggle-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-host-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-lobby-leave').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-host-close').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
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
    const container = document.getElementById('lobby-chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="name">${name}:</span> <span class="text">${msg}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('lobby-chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

function showCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('final-winner-name').innerText = data.winnerName.toUpperCase();

    const body = document.getElementById('winner-stats-body');
    body.innerHTML = '';
    data.stats.forEach(s => {
        body.innerHTML += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });

    const voteList = document.getElementById('map-vote-list');
    voteList.innerHTML = '';
    serverMaps.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(v => v.classList.remove('active'));
            div.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteList.appendChild(div);
    });
}

document.getElementById('btn-win-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-win-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
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
