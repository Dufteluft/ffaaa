let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// Audio Assets
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

// Tab Management
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = tab;

        if (tab === 'create') {
            document.getElementById('browser-view').classList.remove('active');
            document.getElementById('create-view').classList.add('active');
        } else {
            document.getElementById('create-view').classList.remove('active');
            document.getElementById('browser-view').classList.add('active');
            fetchLobbies();
        }
    });
});

// Localization Helper
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locales[key];
            } else {
                el.innerText = locales[key];
            }
        }
    });
}

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            serverConfig = data.config;
            serverMaps = data.maps;
            setupInitialData(data.config, data.maps);
            applyLocalization(data.config.Locales[data.config.Locale]);
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

        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            document.getElementById('winner-screen').style.display = 'none';
            break;

        case 'countdown':
            const cdEl = document.getElementById('big-countdown');
            if (data.seconds > 0) {
                cdEl.style.display = 'block';
                cdEl.innerText = data.seconds;
            } else {
                cdEl.style.display = 'none';
            }
            break;

        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;

        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;

        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
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
    // Populate Map Dropdowns
    const mapSelects = [document.getElementById('map-select'), document.getElementById('filter-maps')];
    mapSelects.forEach(sel => {
        sel.innerHTML = (sel.id === 'filter-maps') ? '<option value="all">ALL MAPS</option>' : '';
        maps.forEach(map => {
            const opt = document.createElement('option');
            opt.value = map.id;
            opt.innerText = map.label.toUpperCase();
            sel.appendChild(opt);
        });
    });

    // Populate Loadout Dropdowns
    const loadoutSelects = [document.getElementById('loadout-select'), document.getElementById('filter-weapons')];
    loadoutSelects.forEach(sel => {
        sel.innerHTML = (sel.id === 'filter-weapons') ? '<option value="all">ALL WEAPONS</option>' : '';
        for (let key in config.WeaponLoadouts) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = key.toUpperCase();
            sel.appendChild(opt);
        }
    });
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

    // Filters
    const mapFilter = document.getElementById('filter-maps').value;
    const weaponFilter = document.getElementById('filter-weapons').value;
    const freeSlotsFilter = document.getElementById('filter-free-slots').checked;

    lobbies.forEach(lobby => {
        if (mapFilter !== 'all' && lobby.mapId !== mapFilter) return;
        // In this simplified version, weapon info isn't always in lobby summary, but we could add it
        if (freeSlotsFilter && lobby.playerCount >= lobby.maxPlayers) return;

        const item = document.createElement('div');
        item.className = 'lobby-item';

        const isFull = lobby.playerCount >= lobby.maxPlayers;
        const btnText = isFull ? 'FULL' : 'JOIN';
        const btnClass = isFull ? 'btn-disabled' : 'btn-join';

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="assets/maps/${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/100x60/222/fff?text=${lobby.mapId}'">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()}</div>
                <div class="lobby-name-row">${lobby.name}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
            </div>
            <div class="lobby-meta">
                <div class="player-count">${lobby.playerCount} / ${lobby.maxPlayers}</div>
                <div class="status-badge">${lobby.status}</div>
                <button class="action-btn ${btnClass}" ${isFull ? 'disabled' : ''} onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">${btnText}</button>
            </div>
        `;
        container.appendChild(item);
    });
}

window.joinLobby = function(lobbyId, mapId) {
    playSound('click');
    if (currentTab === 'ffa') {
        fetch(`https://${GetParentResourceName()}/quickJoin`, {
            method: 'POST',
            body: JSON.stringify({ mapId: mapId })
        });
    } else {
        fetch(`https://${GetParentResourceName()}/joinLobby`, {
            method: 'POST',
            body: JSON.stringify({ lobbyId: lobbyId })
        });
    }
};

// Form Sliders
const setupSlider = (id) => {
    const el = document.getElementById(id);
    const val = document.getElementById(id + '-val');
    if (el && val) {
        el.addEventListener('input', () => { val.innerText = el.value; });
    }
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(setupSlider);

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts,
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
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost && !lobby.isPersistent ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="summary-item"><label>MAP</label><span>${lobby.mapLabel}</span></div>
        <div class="summary-item"><label>MODE</label><span>${lobby.mode.toUpperCase()}</span></div>
        <div class="summary-item"><label>TIME</label><span>${lobby.roundTime === 0 ? '∞' : lobby.roundTime + 'M'}</span></div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span class="name">${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <span class="team-badge" style="color: ${getTeamColor(p.team)}">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });
}

function getTeamColor(team) {
    if (team === 'blue') return '#2196f3';
    if (team === 'red') return '#f44336';
    return '#fff';
}

window.kickPlayer = function(id) {
    playSound('click');
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

document.getElementById('btn-close-lobby').addEventListener('click', () => {
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

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="author">${name}:</span> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
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

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const table = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>PLAYER</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    table.innerHTML = html;

    // Map Voting
    const voteCont = document.getElementById('vote-options');
    voteCont.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerHTML = `${map.label.toUpperCase()} <span class="vote-count" id="vote-${map.id}">0 Votes</span>`;
        btn.onclick = () => {
            playSound('click');
            document.querySelectorAll('.vote-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
            // Visual feedback
            const countEl = document.getElementById(`vote-${map.id}`);
            const count = parseInt(countEl.innerText) + 1;
            countEl.innerText = `${count} Votes`;
        };
        voteCont.appendChild(btn);
    });
}

document.getElementById('btn-back-to-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-back-to-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
