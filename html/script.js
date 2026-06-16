let Config = {};
let currentLobby = null;
let myPlayerId = null;
let currentTab = 'ffa-lobby';
let autoRefreshInterval = null;

const audioAssets = {
    click: new Audio('assets/click.mp3'),
    join: new Audio('assets/join.mp3'),
    kill: new Audio('assets/kill.mp3'),
    win: new Audio('assets/win.mp3'),
    start: new Audio('assets/start.mp3')
};

function playSound(name) {
    if (audioAssets[name]) {
        audioAssets[name].currentTime = 0;
        audioAssets[name].play().catch(() => {}); // Catch if sound file doesn't exist
    }
}

window.addEventListener('message', function(event) {
    const data = event.data;

    switch(data.action) {
        case 'open':
            Config = data.config;
            myPlayerId = data.myId;
            initializeUI(data.maps);
            document.getElementById('app').style.display = 'flex';
            switchTab('ffa-lobby');
            startAutoRefresh();
            break;

        case 'close':
            document.getElementById('app').style.display = 'none';
            stopAutoRefresh();
            break;

        case 'lobbyCreated':
        case 'lobbyJoined':
            playSound('join');
            currentLobby = data.lobby;
            showWaitingRoom(data.lobby);
            break;

        case 'updateLobbyPlayers':
            updatePlayerList(data.players);
            break;

        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;

        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;

        case 'gameStarting':
            playSound('start');
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-room').style.display = 'none';
            break;

        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('tdm-scores').style.display = 'none'; // Default to FFA style unless TDM detected
            break;

        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;

        case 'countdown':
            const cd = document.getElementById('big-countdown');
            if (data.seconds > 0) {
                cd.style.display = 'block';
                cd.innerText = data.seconds;
            } else {
                cd.style.display = 'none';
            }
            break;

        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) {
                document.getElementById('score-blue').innerText = data.scoreBlue;
                document.getElementById('score-red').innerText = data.scoreRed;
                document.getElementById('tdm-scores').style.display = 'flex';
            }
            break;

        case 'updateHUDDetails':
            document.getElementById('bar-health').style.width = data.health + '%';
            document.getElementById('bar-armor').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;

        case 'playSound':
            playSound(data.sound);
            break;

        case 'showWinner':
            playSound('win');
            showWinnerScreen(data);
            break;
    }
});

// INITIALIZATION
function initializeUI(maps) {
    applyLocalization();

    // Map Selects
    const selectMap = document.getElementById('select-map');
    const quickJoinList = document.getElementById('quick-join-list');
    const voteMapList = document.getElementById('vote-map-list');

    selectMap.innerHTML = '';
    quickJoinList.innerHTML = '';
    voteMapList.innerHTML = '';

    maps.forEach(map => {
        // Create Lobby Select
        let opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        selectMap.appendChild(opt);

        // Quick Join Cards
        let card = document.createElement('div');
        card.className = 'map-card';
        card.innerHTML = `<h3>${map.label}</h3><p>FFA MODE</p>`;
        card.onclick = () => {
            playSound('click');
            fetchNUI('quickJoin', { mapId: map.id });
        };
        quickJoinList.appendChild(card);

        // Vote Cards
        let vCard = document.createElement('div');
        vCard.className = 'vote-item';
        vCard.innerText = map.label;
        vCard.onclick = () => {
            playSound('click');
            fetchNUI('voteMap', { mapId: map.id });
        };
        voteMapList.appendChild(vCard);
    });

    // Loadout Multi-Select
    const selectLoadout = document.getElementById('select-loadout');
    selectLoadout.innerHTML = '';
    Object.keys(Config.WeaponLoadouts).forEach(key => {
        let opt = document.createElement('option');
        opt.value = key;
        opt.innerText = getLocale(key) || key;
        selectLoadout.appendChild(opt);
    });
}

function applyLocalization() {
    const elements = document.querySelectorAll('[data-locale]');
    elements.forEach(el => {
        const key = el.getAttribute('data-locale');
        el.innerText = getLocale(key);
    });
}

function getLocale(key) {
    if (Config.Locales && Config.Locales[Config.Locale]) {
        return Config.Locales[Config.Locale][key] || key;
    }
    return key;
}

// TAB SWITCHING
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
        playSound('click');
        switchTab(btn.getAttribute('data-tab'));
    };
});

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');

    if (tabId === 'open-lobbies') {
        fetchNUI('fetchLobbies', { tab: 'custom' });
    }
}

// LOBBY CREATION
document.getElementById('btn-submit-create').onclick = () => {
    const name = document.getElementById('input-lobby-name').value;
    if (!name) return;

    const loadouts = Array.from(document.getElementById('select-loadout').selectedOptions).map(o => o.value);

    const settings = {
        name: name,
        mapId: document.getElementById('select-map').value,
        mode: document.getElementById('select-mode').value,
        loadout: loadouts.length > 0 ? loadouts : 'all',
        roundTime: parseInt(document.getElementById('range-round-time').value),
        maxPlayers: parseInt(document.getElementById('range-max-players').value),
        vehiclesAllowed: document.getElementById('check-vehicles').checked,
        friendlyFire: document.getElementById('check-friendly-fire').checked,
        respawnTime: parseInt(document.getElementById('range-respawn-time').value),
        killLimit: parseInt(document.getElementById('range-kill-limit').value)
    };

    playSound('click');
    fetchNUI('createLobby', settings);
};

// SLIDERS
const sliders = [
    { id: 'range-round-time', valId: 'val-round-time' },
    { id: 'range-max-players', valId: 'val-max-players' },
    { id: 'range-respawn-time', valId: 'val-respawn-time' },
    { id: 'range-kill-limit', valId: 'val-kill-limit' }
];

sliders.forEach(s => {
    const el = document.getElementById(s.id);
    el.oninput = () => {
        document.getElementById(s.valId).innerText = el.value;
    };
});

// LOBBY LIST
function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-body');
    const filterFree = document.getElementById('filter-free-slots').checked;
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        if (filterFree && lobby.playerCount >= lobby.maxPlayers) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lobby.name}</td>
            <td>${lobby.hostName}</td>
            <td>${lobby.playerCount} / ${lobby.maxPlayers}</td>
            <td>${lobby.mapLabel}</td>
            <td>${lobby.mode.toUpperCase()}</td>
            <td><button class="join-btn" onclick="joinLobby('${lobby.id}')">${getLocale('btn_join')}</button></td>
        `;
        container.appendChild(tr);
    });
}

function joinLobby(id) {
    playSound('click');
    fetchNUI('joinLobby', { lobbyId: id });
}

// WAITING ROOM
function showWaitingRoom(lobby) {
    document.getElementById('lobby-waiting-room').style.display = 'flex';
    document.getElementById('waiting-lobby-name').innerText = lobby.name;

    const isHost = (myPlayerId == lobby.host);
    document.querySelectorAll('.host-only').forEach(el => {
        el.style.display = isHost ? 'block' : 'none';
    });

    document.getElementById('lobby-chat-messages').innerHTML = '';
}

function updatePlayerList(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';

    players.forEach(p => {
        const li = document.createElement('li');
        li.className = 'player-item';

        let status = p.ready ? '✔' : '...';
        if (p.isHost) status = '👑';

        li.innerHTML = `
            <span>${p.name} (${p.team.toUpperCase()})</span>
            <div>
                <span>${status}</span>
                ${(myPlayerId == currentLobby.host && p.id != myPlayerId) ? `<button onclick="kickPlayer('${p.id}')" style="margin-left: 10px; background: red; padding: 2px 5px; font-size: 10px;">X</button>` : ''}
            </div>
        `;
        list.appendChild(li);
    });
}

function kickPlayer(id) {
    fetchNUI('kickPlayer', { id: id });
}

// CHAT
document.getElementById('lobby-chat-input').onkeydown = (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (!msg) return;
        fetchNUI('sendLobbyChat', { message: msg });
        e.target.value = '';
    }
};

function addChatMessage(name, msg) {
    const container = document.getElementById('lobby-chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${msg}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// WAITING ROOM BUTTONS
document.getElementById('btn-ready').onclick = () => {
    playSound('click');
    fetchNUI('toggleReady');
};

document.getElementById('btn-leave').onclick = () => {
    playSound('click');
    document.getElementById('lobby-waiting-room').style.display = 'none';
    fetchNUI('leaveLobby');
};

document.getElementById('btn-start').onclick = () => {
    playSound('click');
    fetchNUI('startGame');
};

document.getElementById('btn-close-lobby').onclick = () => {
    playSound('click');
    fetchNUI('closeLobby');
};

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.onclick = () => {
        playSound('click');
        fetchNUI('setTeam', { team: btn.getAttribute('data-team') });
    };
});

// WINNER SCREEN
function showWinnerScreen(data) {
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display').innerHTML = `${data.winnerName} <span data-locale="winner_suffix">${getLocale('winner_suffix')}</span>`;

    const body = document.getElementById('winner-stats-body');
    body.innerHTML = '';
    data.stats.forEach((s, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>#${index + 1}</td>
            <td>${s.name}</td>
            <td>${s.kills}</td>
            <td>${s.deaths}</td>
            <td>${s.kd}</td>
        `;
        body.appendChild(tr);
    });
}

document.getElementById('btn-winner-close').onclick = () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetchNUI('closeWinnerScreen');
};

// UTILS
function fetchNUI(eventName, data = {}) {
    return fetch(`https://${GetParentResourceName()}/${eventName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

function startAutoRefresh() {
    stopAutoRefresh();
    autoRefreshInterval = setInterval(() => {
        if (currentTab === 'open-lobbies' && document.getElementById('app').style.display !== 'none') {
            fetchNUI('fetchLobbies', { tab: 'custom' });
        }
    }, 5000);
}

function stopAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
}

// CLOSE ON ESC
window.onkeydown = (e) => {
    if (e.key === 'Escape') {
        fetchNUI('closeUI');
    }
};
