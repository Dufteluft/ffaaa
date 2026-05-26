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

        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        if (tab === 'create') {
            document.getElementById('create-lobby-view').classList.add('active');
        } else {
            document.getElementById('lobby-list-view').classList.add('active');
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
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
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
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'showHUD':
            document.getElementById('game-hud').style.display = 'flex';
            updateHUD({ mode: 'ffa', isPersistent: data.isPersistent }); // Reset HUD
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'countdown':
            showCountdown(data.seconds);
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

    // Map Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    // Loadouts Multi-Select
    const loadoutGrid = document.getElementById('loadout-multi-select');
    loadoutGrid.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const item = document.createElement('div');
        item.className = 'loadout-item';
        item.innerHTML = `
            <input type="checkbox" id="loadout-${key}" value="${key}" ${key === 'all' ? 'checked' : ''}>
            <label for="loadout-${key}">${key.toUpperCase()}</label>
        `;
        item.onclick = () => {
            const cb = item.querySelector('input');
            cb.checked = !cb.checked;
        };
        loadoutGrid.appendChild(item);
    }
}

function applyLocalization(locales) {
    if (!locales) return;
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locales[key]) {
            el.innerText = locales[key];
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

    lobbies.forEach((lobby, index) => {
        const item = document.createElement('div');
        item.className = 'lobby-item';
        item.style.animationDelay = `${index * 0.05}s`;

        const playerCount = lobby.playerCount || 0;
        const maxPlayers = lobby.maxPlayers || 16;
        const percent = (playerCount / maxPlayers) * 100;
        let strokeColor = '#00ff88';
        if (percent > 80) strokeColor = '#ff9500';

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        const mapImg = `https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE-FOR-ALL'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel.toUpperCase()}
                    ${lobby.isPersistent ? ' <span style="color:var(--primary)">[PERSISTENT]</span>' : ` | HOST: ${lobby.hostName.toUpperCase()}`}
                </div>
            </div>
            <div class="player-counter-wrapper">
                <svg class="player-counter-svg">
                    <circle class="circle-bg" cx="30" cy="30" r="${radius}"></circle>
                    <circle class="circle-progress" cx="30" cy="30" r="${radius}"
                        style="stroke: ${strokeColor}; stroke-dasharray: ${circumference}; stroke-dashoffset: ${offset};">
                    </circle>
                </svg>
                <div class="player-count-text">${playerCount}/${maxPlayers}</div>
            </div>
            <div class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</div>
            <div class="action-area">
                <button class="action-btn ${playerCount >= maxPlayers ? 'btn-disabled' : 'btn-join'}"
                    onclick="${playerCount < maxPlayers ? (lobby.isPersistent ? `quickJoin('${lobby.mapId}')` : `joinLobby('${lobby.id}')`) : ''}"
                    ${playerCount >= maxPlayers ? 'disabled' : ''}>
                    ${playerCount >= maxPlayers ? 'FULL' : (lobby.isPersistent ? 'ENTER' : 'JOIN')}
                </button>
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

function quickJoin(mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/quickJoin`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('#loadout-multi-select input:checked').forEach(cb => {
        selectedLoadouts.push(cb.value);
    });

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
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
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';

    updateLobbyInfo(lobby);
    document.getElementById('chat-messages').innerHTML = '';
}

function updateLobbyInfo(lobby) {
    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel.toUpperCase()}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime === 0 ? '∞' : lobby.roundTime + ' MIN'}</p>
        <p>KILL LIMIT: ${lobby.killLimit === 0 ? 'NONE' : lobby.killLimit}</p>
        <p>VEHICLES: ${lobby.vehiclesAllowed ? 'YES' : 'NO'}</p>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
            <span style="color:var(--text-muted)">${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
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

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<span style="color:var(--primary)">${name}:</span> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
        fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
            method: 'POST',
            body: JSON.stringify({ message: e.target.value })
        });
        e.target.value = '';
    }
});

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

// HUD & Game Functions
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'block';
        if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-tdm-score').style.display = 'none';
    }

    if (data.isPersistent) {
        document.getElementById('hud-timer').innerText = '∞';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    // Optional visual effect for countdown
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
    const voteGrid = document.getElementById('vote-grid');
    voteGrid.innerHTML = '';
    serverMaps.slice(0, 3).forEach(map => {
        const div = document.createElement('div');
        div.className = 'vote-item';
        div.innerHTML = `<span>${map.label.toUpperCase()}</span><div class="vote-count" id="vote-${map.id}">0</div>`;
        div.onclick = () => {
            document.querySelectorAll('.vote-item').forEach(i => i.classList.remove('selected'));
            div.classList.add('selected');
            fetch(`https://${GetParentResourceName()}/voteMap`, {
                method: 'POST',
                body: JSON.stringify({ mapId: map.id })
            });
            // Instant feedback
            const count = div.querySelector('.vote-count');
            count.innerText = parseInt(count.innerText) + 1;
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
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-edit-settings').addEventListener('click', () => {
    playSound('click');
    // Pre-fill create form with current lobby settings
    document.getElementById('lobby-name').value = currentLobby.name;
    document.getElementById('map-select').value = currentLobby.mapId;
    document.getElementById('mode-select').value = currentLobby.mode;
    document.getElementById('round-time').value = currentLobby.roundTime;
    document.getElementById('max-players').value = currentLobby.maxPlayers;
    document.getElementById('vehicles-allowed').checked = currentLobby.vehiclesAllowed;
    document.getElementById('friendly-fire').checked = currentLobby.friendlyFire;
    document.getElementById('respawn-time').value = currentLobby.respawnTime;
    document.getElementById('kill-limit').value = currentLobby.killLimit;

    // Trigger slider updates
    setupSlider('round-time'); setupSlider('max-players'); setupSlider('respawn-time'); setupSlider('kill-limit');
    document.getElementById('round-time-val').innerText = currentLobby.roundTime;
    document.getElementById('max-players-val').innerText = currentLobby.maxPlayers;
    document.getElementById('respawn-time-val').innerText = currentLobby.respawnTime;
    document.getElementById('kill-limit-val').innerText = currentLobby.killLimit;

    document.querySelector('.tab-btn[data-tab="create"]').click();
    document.getElementById('btn-create-lobby').innerText = "SPEICHERN";
    document.getElementById('btn-create-lobby').onclick = () => {
        const selectedLoadouts = [];
        document.querySelectorAll('#loadout-multi-select input:checked').forEach(cb => {
            selectedLoadouts.push(cb.value);
        });
        const settings = {
            lobbyId: currentLobby.id,
            name: document.getElementById('lobby-name').value,
            mapId: document.getElementById('map-select').value,
            mode: document.getElementById('mode-select').value,
            loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
            roundTime: parseInt(document.getElementById('round-time').value),
            maxPlayers: parseInt(document.getElementById('max-players').value),
            vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
            friendlyFire: document.getElementById('friendly-fire').checked,
            respawnTime: parseInt(document.getElementById('respawn-time').value),
            killLimit: parseInt(document.getElementById('kill-limit').value)
        };
        fetch(`https://${GetParentResourceName()}/updateSettings`, {
            method: 'POST',
            body: JSON.stringify(settings)
        });
        // Reset button
        document.getElementById('btn-create-lobby').innerText = "LOBBY ERSTELLEN";
        document.getElementById('btn-create-lobby').onclick = null; // Back to default event listener
    };
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
