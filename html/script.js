let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};

// Tab Switching Logic
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        if (target === currentTab) return;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`tab-${target}`).classList.add('active');
        currentTab = target;

        if (target === 'open') {
            fetchLobbies();
        }
    });
});

// Slider Value Updates
const setupSlider = (id, valId) => {
    const slider = document.getElementById(id);
    const display = document.getElementById(valId);
    if (slider && display) {
        slider.addEventListener('input', () => {
            display.innerText = slider.value;
        });
    }
};

setupSlider('create-time', 'val-time');
setupSlider('create-players', 'val-players');
setupSlider('create-respawn', 'val-respawn');
setupSlider('create-kills', 'val-kills');

// Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            document.getElementById('hud').style.display = 'none';
            serverConfig = data.config;
            setupCreateForm(data.maps, data.config.WeaponLoadouts);
            renderDefaultLobbies(data.maps);
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showWaitingRoom(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'updateLobbies':
            renderOpenLobbies(data.lobbies);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('hud').style.display = 'block';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('hud').style.display = 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-time').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            document.getElementById('bar-health').style.width = data.health + '%';
            document.getElementById('bar-armor').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'countdown':
            const cd = document.getElementById('hud-countdown');
            if (data.seconds > 0) {
                cd.style.display = 'block';
                document.getElementById('countdown-val').innerText = data.seconds;
            } else {
                cd.style.display = 'none';
            }
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function setupCreateForm(maps, loadouts) {
    const mapSelect = document.getElementById('create-map');
    mapSelect.innerHTML = '';
    maps.forEach(m => {
        mapSelect.innerHTML += `<option value="${m.id}">${m.label.toUpperCase()}</option>`;
    });

    const loadoutSelect = document.getElementById('create-loadout');
    loadoutSelect.innerHTML = '';
    for (let key in loadouts) {
        loadoutSelect.innerHTML += `<option value="${key}">${loadouts[key].label.toUpperCase()}</option>`;
    }
}

function renderDefaultLobbies(maps) {
    const container = document.getElementById('default-lobby-list');
    container.innerHTML = '';
    maps.forEach(map => {
        const card = document.createElement('div');
        card.className = 'lobby-card-small';
        card.innerHTML = `
            <h3 style="font-family: Impact; letter-spacing: 1px;">${map.label.toUpperCase()} FFA</h3>
            <p style="color: var(--text-muted); font-size: 13px;">Sofortiger Beitritt zum permanenten Match.</p>
            <button class="btn btn-primary" onclick="quickJoin('${map.id}')">SOFORT BEITRETEN</button>
        `;
        container.appendChild(card);
    });
}

function fetchLobbies() {
    post('fetchLobbies', { tab: 'open' });
}

function renderOpenLobbies(lobbies) {
    const container = document.getElementById('open-lobby-list');
    container.innerHTML = '';
    if (lobbies.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 50px;">Keine aktiven Lobbys gefunden.</p>';
        return;
    }

    lobbies.forEach(l => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info">
                <div style="font-weight: 800; font-size: 18px;">${l.name.toUpperCase()}</div>
                <div style="color: var(--text-muted); font-size: 12px;">Host: ${l.hostName} | Map: ${l.mapLabel} | Modus: ${l.mode.toUpperCase()}</div>
            </div>
            <div class="lobby-meta" style="display: flex; align-items: center; gap: 30px;">
                <div style="font-weight: 800;">${l.playerCount}/${l.maxPlayers}</div>
                <button class="btn btn-primary" onclick="joinLobby('${l.id}')">BEITRETEN</button>
            </div>
        `;
        container.appendChild(item);
    });
}

function showWaitingRoom(lobby) {
    currentLobby = lobby;
    document.getElementById('lobby-waiting').style.display = 'flex';
    document.getElementById('waiting-lobby-name').innerText = lobby.name.toUpperCase();
    document.getElementById('waiting-lobby-id').innerText = lobby.id;
    document.getElementById('info-map').innerText = lobby.mapLabel;
    document.getElementById('info-mode').innerText = lobby.mode.toUpperCase();
    document.getElementById('info-loadout').innerText = lobby.loadout.toUpperCase();
    document.getElementById('max-player-count').innerText = lobby.maxPlayers;

    document.getElementById('chat-messages').innerHTML = '';
}

function renderPlayerList(players) {
    const list = document.getElementById('waiting-player-list');
    list.innerHTML = '';
    document.getElementById('player-count').innerText = players.length;

    const me = players.find(p => p.isMe); // We might need to send which one is "me"
    isHost = players.find(p => p.id === GetParentResourceName())?.isHost; // Simplified check, need server to send correctly

    // Better way: Server sends who is host
    const myId = null; // We'll get this from server or handle via name

    players.forEach(p => {
        if (p.isMe) isHost = p.isHost;

        const item = document.createElement('div');
        item.className = `player-item ${p.ready ? 'ready' : ''}`;
        item.innerHTML = `
            <div class="p-name">${p.name.toUpperCase()} ${p.isHost ? '<span style="color: var(--warning); font-size: 10px; margin-left: 5px;">[HOST]</span>' : ''}</div>
            <div style="display: flex; align-items: center; gap: 15px;">
                <span style="font-size: 12px; font-weight: 800; color: var(--primary);">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<i class="fa-solid fa-circle-xmark" style="color: var(--danger); cursor: pointer;" onclick="kickPlayer('${p.id}')"></i>` : ''}
            </div>
        `;
        list.appendChild(item);
    });

    document.getElementById('btn-start').style.display = isHost ? 'block' : 'none';
}

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.style.marginBottom = '5px';
    msg.innerHTML = `<span style="color: var(--primary); font-weight: 800;">${name.toUpperCase()}:</span> ${message}`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
}

function showWinnerScreen(data) {
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " GEWINNT!";

    const statsContainer = document.getElementById('match-stats');
    let html = `<table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
            <tr style="border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 12px; text-align: left;">
                <th style="padding: 10px;">NAME</th>
                <th>KILLS</th>
                <th>TODE</th>
                <th>K/D</th>
            </tr>
        </thead>
        <tbody>`;

    data.stats.forEach(s => {
        html += `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 15px 10px; font-weight: 800;">${s.name.toUpperCase()}</td>
            <td>${s.kills}</td>
            <td>${s.deaths}</td>
            <td>${s.kd}</td>
        </tr>`;
    });

    html += `</tbody></table>`;
    statsContainer.innerHTML = html;
}

// Callbacks
function quickJoin(mapId) { post('quickJoin', { mapId }); }
function joinLobby(lobbyId) { post('joinLobby', { lobbyId }); }
function kickPlayer(id) { post('kickPlayer', { id }); }

document.getElementById('btn-create-submit').addEventListener('click', () => {
    const settings = {
        name: document.getElementById('create-name').value || 'FFA Match',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: document.getElementById('create-loadout').value,
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-kills').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };
    post('createLobby', settings);
});

document.getElementById('btn-create-cancel').addEventListener('click', () => {
    document.querySelector('.tab-btn[data-tab="ffa"]').click();
});

document.getElementById('btn-ready').addEventListener('click', () => post('toggleReady'));
document.getElementById('btn-start').addEventListener('click', () => post('startGame'));
document.getElementById('btn-leave').addEventListener('click', () => {
    document.getElementById('lobby-waiting').style.display = 'none';
    post('leaveLobby');
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        post('setTeam', { team: btn.dataset.team });
    });
});

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim() !== '') {
        post('sendLobbyChat', { message: e.target.value });
        e.target.value = '';
    }
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    document.getElementById('winner-screen').style.display = 'none';
    post('leaveLobby');
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('winner-screen').style.display === 'flex') return;
        post('closeUI');
    }
});

function post(event, data = {}) {
    fetch(`https://${GetParentResourceName()}/${event}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

// Auto Refresh Open Lobbies
setInterval(() => {
    if (currentTab === 'open' && document.getElementById('app').style.display === 'flex') {
        fetchLobbies();
    }
}, 5000);
