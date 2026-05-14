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
        const targetTab = btn.dataset.tab;
        if (targetTab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`tab-${targetTab}`).classList.add('active');

        currentTab = targetTab;
        if (currentTab !== 'create') {
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
            if (data.config && data.maps) {
                setupInitialData(data.config, data.maps);
            }
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
            document.getElementById('hud-tdm-container').style.display = data.mode === 'tdm' ? 'flex' : 'none';
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
            const cd = document.getElementById('hud-countdown');
            if (data.seconds > 0) {
                cd.innerText = data.seconds;
                cd.style.display = 'block';
            } else {
                cd.style.display = 'none';
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

    // Apply Localizations
    applyLocalization(config.Locale);

    // Populate Maps
    const mapSelect = document.getElementById('map-select');
    const filterMaps = document.getElementById('filter-maps');
    mapSelect.innerHTML = '';
    filterMaps.innerHTML = '<option value="all">ALL MAPS</option>';

    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);

        const filterOpt = document.createElement('option');
        filterOpt.value = map.id;
        filterOpt.innerText = map.label.toUpperCase();
        filterMaps.appendChild(filterOpt);
    });

    // Populate Loadouts
    const loadoutContainer = document.getElementById('loadout-container');
    loadoutContainer.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const label = document.createElement('label');
        label.className = 'checkbox-item';
        label.innerHTML = `
            <input type="checkbox" name="loadout" value="${key}">
            <span>${key.toUpperCase()}</span>
        `;
        label.querySelector('input').addEventListener('change', function() {
            if (this.checked) label.classList.add('active');
            else label.classList.remove('active');
        });
        loadoutContainer.appendChild(label);
    }
}

function applyLocalization(lang) {
    const locales = serverConfig.Locales[lang];
    if (!locales) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            el.innerText = locales[key];
        }
    });
}

function fetchLobbies() {
    // Only fetch if NUI is open
    if (document.getElementById('app').style.display !== 'flex') return;

    if (typeof GetParentResourceName === 'function') {
        fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
            method: 'POST',
            body: JSON.stringify({ tab: currentTab })
        });
    }
}

function renderLobbyList(lobbies) {
    const container = currentTab === 'ffa' ? document.getElementById('ffa-list-container') : document.getElementById('lobby-list-container');
    if (!container) return;

    container.innerHTML = '';

    // Filter lobbies based on tab
    const filteredLobbies = lobbies.filter(l => {
        if (currentTab === 'ffa') return l.isPersistent;
        if (currentTab === 'lobby') return !l.isPersistent;
        return false;
    });

    filteredLobbies.forEach(lobby => {
        const item = document.createElement('div');
        item.className = 'lobby-item';

        const modeLabel = lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All';

        item.innerHTML = `
            <div class="lobby-item-header">
                <span class="match-mode">${modeLabel}</span>
                <span class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</span>
            </div>
            <h3>${lobby.name.toUpperCase()}</h3>
            <div class="lobby-item-details">
                <span><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</span>
                <span><i class="fa-solid fa-user-crown"></i> ${lobby.hostName}</span>
            </div>
            <button class="confirm-btn" onclick="joinLobby('${lobby.id}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                ${lobby.playerCount >= lobby.maxPlayers ? 'FULL' : 'BEITRETEN'}
            </button>
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

    const selectedLoadouts = [];
    document.querySelectorAll('input[name="loadout"]:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('lobby-name').value || 'FFA LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts, // Send array of selected loadouts
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked,
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value)
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
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';
    document.getElementById('team-selector').style.display = lobby.mode === 'tdm' ? 'flex' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <div class="settings-summary">
            <span><b>MAP:</b> ${lobby.mapLabel}</span>
            <span><b>MODE:</b> ${lobby.mode.toUpperCase()}</span>
            <span><b>TIME:</b> ${lobby.roundTime || '∞'} MIN</span>
            <span><b>KILL LIMIT:</b> ${lobby.killLimit || 'OFF'}</span>
        </div>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;

        let teamTag = '';
        if (currentLobby.mode === 'tdm' && p.team !== 'none') {
            teamTag = `<span class="team-tag tag-${p.team}">${p.team.toUpperCase()}</span>`;
        }

        div.innerHTML = `
            <div class="player-info">
                <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
                ${teamTag}
            </div>
            <div class="player-actions">
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
                <i class="fa-solid ${p.ready ? 'fa-check' : 'fa-clock'}" style="margin-left: 10px; color: ${p.ready ? '#00ff88' : '#a0a0a0'};"></i>
            </div>
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

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="create"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById('tab-create').classList.add('active');
    currentTab = 'create';

    // Pre-fill form
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
    document.getElementById('round-time').value = currentLobby.roundTime;
    document.getElementById('round-time-val').innerText = currentLobby.roundTime;
    document.getElementById('max-players').value = currentLobby.maxPlayers;
    document.getElementById('max-players-val').innerText = currentLobby.maxPlayers;
    document.getElementById('vehicles-allowed').checked = currentLobby.vehiclesAllowed;
    document.getElementById('friendly-fire').checked = currentLobby.friendlyFire;
    document.getElementById('respawn-time').value = currentLobby.respawnTime;
    document.getElementById('respawn-time-val').innerText = currentLobby.respawnTime;
    document.getElementById('kill-limit').value = currentLobby.killLimit;
    document.getElementById('kill-limit-val').innerText = currentLobby.killLimit;
});

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'msg';
    div.innerHTML = `<b>${name}:</b> <span>${message}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

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

function updateHUD(data) {
    if (data.time !== undefined) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) document.getElementById('hud-score-blue').innerText = data.scoreBlue;
    if (data.scoreRed !== undefined) document.getElementById('hud-score-red').innerText = data.scoreRed;
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health-bar').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor-bar').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase();

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const voteOptions = document.getElementById('vote-options');
    voteOptions.innerHTML = '';
    const mapsToVote = serverMaps.slice(0, 3);
    mapsToVote.forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `<span>${map.label.toUpperCase()}</span><span class="count" id="vote-count-${map.id}">0</span>`;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('active'));
            div.classList.add('active');
            const countEl = div.querySelector('.count');
            countEl.innerText = parseInt(countEl.innerText) + 1;

            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
        };
        voteOptions.appendChild(div);
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

setInterval(fetchLobbies, 5000);
