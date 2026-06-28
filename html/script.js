let currentLobby = null;
let isHost = false;
let myPlayerId = null;
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

        document.querySelectorAll('.tab-view').forEach(view => view.classList.remove('active'));
        const sidebar = document.getElementById('sidebar');

        if (tab === 'create') {
            document.getElementById('create-lobby-view').classList.add('active');
            sidebar.style.display = 'none';
        } else {
            document.getElementById('lobby-list-view').classList.add('active');
            sidebar.style.display = 'flex';
            currentTab = tab;
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
            myPlayerId = data.myId;
            setupInitialData(data.config, data.maps);
            fetchLobbies();
            applyLocalization(data.config.Locales[data.config.Locale]);
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showLobbyArea(data.lobby, data.lobby.host == myPlayerId);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'syncSettings':
            updateLobbySettings(data.lobby);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'countdown':
            showHUDCountdown(data.seconds);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'block';
            document.getElementById('tdm-score-box').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUDDetails':
            document.getElementById('bar-health').style.width = data.health + '%';
            document.getElementById('bar-armor').style.width = data.armor + '%';
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'updateHUD':
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.time !== undefined) document.getElementById('hud-timer').innerText = data.time;
            if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const fillSelect = (id, items, labelField = 'label') => {
        const select = document.getElementById(id);
        select.innerHTML = '';
        items.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id || item.name || item;
            opt.innerText = (item[labelField] || item).toUpperCase();
            select.appendChild(opt);
        });
    };

    fillSelect('map-select', maps);
    fillSelect('filter-maps', [{ id: 'all', label: 'ALL MAPS' }, ...maps]);

    const loadoutItems = Object.keys(config.WeaponLoadouts).map(k => ({ id: k, label: k }));
    fillSelect('loadout-select', loadoutItems);
    fillSelect('filter-weapons', [{ id: 'all', label: 'ALL WEAPONS' }, ...loadoutItems]);
}

function applyLocalization(loc) {
    if (!loc) return;
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (loc[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = loc[key];
            } else {
                // Keep the suffix for the winner name if it's there
                if (key === 'wins_suffix') return;
                el.innerText = loc[key].toUpperCase();
            }
        }
    });
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({
            tab: currentTab,
            mapId: document.getElementById('filter-maps').value,
            weapon: document.getElementById('filter-weapons').value,
            playerFilter: document.getElementById('filter-players').value
        })
    });
}

document.getElementById('filter-maps').addEventListener('change', fetchLobbies);
document.getElementById('filter-weapons').addEventListener('change', fetchLobbies);
document.getElementById('filter-players').addEventListener('change', fetchLobbies);

function renderLobbyList(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name.toUpperCase()}</div>
                <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | HOST: ${lobby.hostName}</div>
            </div>
            <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <div class="action-area">
                <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${serverConfig.Locales[serverConfig.Locale].btn_join}</button>
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

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(opt => opt.value);

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
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

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';

    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';

    updateLobbySettings(lobby);
}

function updateLobbySettings(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="settings-grid">
            <p><span>MAP:</span> ${lobby.mapLabel}</p>
            <p><span>MODE:</span> ${lobby.mode.toUpperCase()}</p>
            <p><span>TIME:</span> ${lobby.roundTime} MIN</p>
            <p><span>LIMIT:</span> ${lobby.killLimit || 'NONE'}</p>
        </div>
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
            <span class="player-team">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-slash"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start-game').disabled = players.length < 2 && !currentLobby.isPersistent;
    }
}

function kickPlayer(id) {
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

function showHUDCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerHTML = `${data.winnerName.toUpperCase()} <span data-locale="wins_suffix">${serverConfig.Locales[serverConfig.Locale].wins_suffix}</span>`;

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const voteList = document.getElementById('map-vote-list');
    voteList.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerText = map.label.toUpperCase();
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

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
