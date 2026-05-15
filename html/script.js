let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';

// Maps and Config from Server
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
        if (btn.dataset.tab === currentTab) return;
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;

        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');

        if (tab === 'create') {
            document.getElementById('tab-content-create').style.display = 'flex';
        } else {
            document.getElementById('tab-content-browser').style.display = 'flex';
            const container = document.getElementById('lobby-list-container');
            if (container) {
                container.classList.add('switching');

                setTimeout(() => {
                    currentTab = tab;
                    fetchLobbies();
                    container.classList.remove('switching');
                }, 300);
            }
        }
        currentTab = tab;
    });
});

// Modal Controls
document.getElementById('open-create-modal').addEventListener('click', () => {
    playSound('click');
    document.getElementById('create-lobby-modal').style.display = 'flex';
});

document.getElementById('btn-close-modal').addEventListener('click', () => {
    playSound('click');
    document.getElementById('create-lobby-modal').style.display = 'none';
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
    if (!data.action) return;

    switch (data.action) {
        case 'open':
            if (!data.config || !data.maps) return;
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
            document.getElementById('create-lobby-modal').style.display = 'none';
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
            document.getElementById('hud-team-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            if (data.isPersistent) {
                document.getElementById('hud-timer').innerText = '∞';
            }
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'updateHUD':
            if (data.time) document.getElementById('hud-timer').innerText = data.time;
            if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
            if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
            if (data.scoreBlue !== undefined) document.getElementById('score-blue').innerText = data.scoreBlue;
            if (data.scoreRed !== undefined) document.getElementById('score-red').innerText = data.scoreRed;
            break;
        case 'updateHUDDetails':
            if (data.health !== undefined) document.getElementById('bar-health').style.width = data.health + '%';
            if (data.armor !== undefined) document.getElementById('bar-armor').style.width = data.armor + '%';
            if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'playSound':
            playSound(data.sound);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function applyLocalization() {
    const locale = serverConfig.Locales[serverConfig.Locale || 'de'];
    if (!locale) return;

    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locale[key]) {
            if (el.tagName === 'INPUT' && el.placeholder) {
                el.placeholder = locale[key];
            } else {
                el.innerHTML = locale[key];
            }
        }
    });
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    applyLocalization();

    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label.toUpperCase();
        mapSelect.appendChild(opt);
    });

    const loadoutMultiSelect = document.getElementById('loadout-multi-select');
    if (loadoutMultiSelect) {
        loadoutMultiSelect.innerHTML = '';
        for (let key in config.WeaponLoadouts) {
            const label = document.createElement('label');
            label.className = 'checkbox-item';
            label.innerHTML = `
                <input type="checkbox" name="loadout" value="${key}">
                <span class="checkmark"></span>
                ${key.toUpperCase()}
            `;
            loadoutMultiSelect.appendChild(label);
        }
    }
}

function fetchLobbies() {
    if (typeof GetParentResourceName === 'undefined') return;
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

        let status = lobby.status || 'waiting';
        let strokeColor = '#00ff88'; // Success
        if (status === 'joining') strokeColor = '#00d4ff'; // Primary
        else if (percent > 80) strokeColor = '#ff9500'; // Warning

        const radius = 25;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        // Simplified Map Image URLs (using placeholders for now)
        const mapImg = lobby.mapImage || `https://via.placeholder.com/140x80/0f1419/ffffff?text=${lobby.mapLabel}`;

        item.innerHTML = `
            <div class="lobby-map-preview">
                <img src="${mapImg}" alt="${lobby.mapLabel}">
            </div>
            <div class="lobby-info-main">
                <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                <div class="map-name-row">
                    <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}
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
            <div class="mode-icon">
                <i class="fa-solid fa-user"></i>
            </div>
            <div class="status-badge status-${status.toLowerCase()}">${status}</div>
            <div class="action-area">
                ${renderActionButton(lobby)}
            </div>
        `;
        container.appendChild(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>FULL</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}', true)">SPECTATE</button>`;
    }
    const pulsingClass = lobby.status === 'joining' ? 'pulsing' : '';
    return `<button class="action-btn btn-join ${pulsingClass}" onclick="joinLobby('${lobby.id}')">JOIN</button>`;
}

function joinLobby(lobbyId, isSpectator = false) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId, isSpectator })
    });
}

document.getElementById('btn-create-lobby').addEventListener('click', () => {
    playSound('click');

    const selectedLoadouts = [];
    document.querySelectorAll('#loadout-multi-select input:checked').forEach(input => {
        selectedLoadouts.push(input.value);
    });

    const settings = {
        name: document.getElementById('lobby-name').value || 'CUSTOM LOBBY',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: selectedLoadouts, // Now an array
        roundTime: parseInt(document.getElementById('round-time').value),
        maxPlayers: parseInt(document.getElementById('max-players').value),
        vehiclesAllowed: document.getElementById('vehicles-allowed').checked,
        friendlyFire: document.getElementById('friendly-fire').checked,
        respawnTime: parseInt(document.getElementById('respawn-time').value),
        killLimit: parseInt(document.getElementById('kill-limit').value)
    };

    if (currentLobby && isHost) {
        fetch(`https://${GetParentResourceName()}/updateSettings`, {
            method: 'POST',
            body: JSON.stringify(settings)
        });
        document.getElementById('tab-content-create').style.display = 'none';
        document.getElementById('lobby-waiting-area').style.display = 'flex';
    } else {
        fetch(`https://${GetParentResourceName()}/createLobby`, {
            method: 'POST',
            body: JSON.stringify(settings)
        });
    }
});

const btnCancelCreate = document.getElementById('btn-cancel-create');
if (btnCancelCreate) {
    btnCancelCreate.addEventListener('click', () => {
        playSound('click');
        if (currentLobby) {
            document.getElementById('tab-content-create').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'flex';
        } else {
            document.querySelector('.tab-btn[data-tab="ffa"]').click();
        }
    });
}

const btnEditSettings = document.getElementById('btn-edit-settings');
if (btnEditSettings) {
    btnEditSettings.addEventListener('click', () => {
        playSound('click');
        document.getElementById('lobby-waiting-area').style.display = 'none';
        document.getElementById('tab-content-create').style.display = 'flex';

        // Fill form with current settings
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

        // Set loadouts
        document.querySelectorAll('#loadout-multi-select input').forEach(input => {
            input.checked = Array.isArray(currentLobby.loadout) ? currentLobby.loadout.includes(input.value) : (currentLobby.loadout === input.value);
        });
    });
}

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('lobby-title').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = asHost ? 'block' : 'none';
    const btnEdit = document.getElementById('btn-edit-settings');
    if (btnEdit) btnEdit.style.display = asHost ? 'block' : 'none';

    document.getElementById('lobby-info-summary').innerHTML = `
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime === 0 ? '∞' : lobby.roundTime + ' MIN'}</p>
        <p>KILL LIMIT: ${lobby.killLimit === 0 ? '∞' : lobby.killLimit}</p>
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
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
        `;
        list.appendChild(div);
    });

    if (isHost) {
        // Enforce 2 player minimum for non-persistent custom lobbies
        document.getElementById('btn-start-game').disabled = players.length < (currentLobby.isPersistent ? 1 : 2);
    }
}

function kickPlayer(playerId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: playerId })
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

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName.toUpperCase() + " WINS!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting
    const voteList = document.getElementById('map-voting-list');
    if (voteList) {
        voteList.innerHTML = '';
        serverMaps.slice(0, 3).forEach(map => {
            const div = document.createElement('div');
            div.className = 'vote-map-item';
            div.style.cssText = `width: 150px; cursor: pointer; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; padding: 10px; text-align: center;`;
            div.innerHTML = `
                <div style="font-weight: 900; font-size: 12px; margin-bottom: 5px;">${map.label.toUpperCase()}</div>
                <div id="vote-count-${map.id}" style="color: var(--primary); font-weight: 900;">0 VOTS</div>
            `;
            div.onclick = () => {
                playSound('click');
                fetch(`https://${GetParentResourceName()}/voteMap`, {
                    method: 'POST',
                    body: JSON.stringify({ mapId: map.id })
                });
                div.style.borderColor = 'var(--primary)';
            };
            voteList.appendChild(div);
        });
    }
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

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('lobby-waiting-area').style.display === 'none' &&
        document.getElementById('winner-screen').style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
