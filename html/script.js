let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let config = {};
let maps = [];

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

// NUI Message Router
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            myPlayerId = data.myId;
            setupConfig(data.config, data.maps);
            document.getElementById('app').style.display = 'flex';
            switchTab(currentTab);
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            enterLobby(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayers(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'syncSettings':
            syncLobbySettings(data.lobby);
            break;
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'gameStarting':
            document.getElementById('app').style.display = 'none';
            document.getElementById('lobby-waiting-area').style.display = 'none';
            break;
        case 'showHUD':
            document.getElementById('hud').style.display = 'block';
            document.getElementById('hud-tdm-score').style.display = data.mode === 'tdm' ? 'flex' : 'none';
            break;
        case 'hideHUD':
            document.getElementById('hud').style.display = 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function setupConfig(srvConfig, srvMaps) {
    config = srvConfig;
    maps = srvMaps;

    // Localize UI
    const locale = config.Locales[config.Locale];
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locale[key]) el.innerText = locale[key];
    });

    // Populate Map Selects
    const populateMaps = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        maps.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.innerText = m.label;
            el.appendChild(opt);
        });
    };
    populateMaps('map-select-input');

    // Populate Loadout Selects
    const populateLoadouts = (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '';
        for (const key in config.WeaponLoadouts) {
            const opt = document.createElement('option');
            opt.value = key;
            opt.innerText = key.toUpperCase();
            el.appendChild(opt);
        }
    };
    populateLoadouts('loadout-select-input');
}

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        switchTab(btn.dataset.tab);
    });
});

function switchTab(tabId) {
    currentTab = tabId;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tabId));

    if (tabId === 'create') {
        document.getElementById('tab-browser').style.display = 'none';
        document.getElementById('tab-create').style.display = 'block';
    } else {
        document.getElementById('tab-browser').style.display = 'block';
        document.getElementById('tab-create').style.display = 'none';
        fetchLobbies(tabId);
    }
}

function fetchLobbies(tab) {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST',
        body: JSON.stringify({ tab: tab })
    });
}

function renderLobbies(lobbies) {
    const container = document.getElementById('lobby-list-container');
    container.innerHTML = '';

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-main-info">
                <h4>${lobby.name}</h4>
                <div class="lobby-sub-info">
                    <span><i class="fa-solid fa-crown"></i> ${lobby.hostName}</span>
                    <span><i class="fa-solid fa-map"></i> ${lobby.mapLabel}</span>
                    <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                </div>
            </div>
            <div class="lobby-meta">
                <span class="lobby-status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</span>
                <span style="margin: 0 15px;">${lobby.playerCount} / ${lobby.maxPlayers}</span>
                <button class="create-btn" onclick="joinLobby('${lobby.id}', '${lobby.mapId}')">${config.Locales[config.Locale].btn_join}</button>
            </div>
        `;
        container.appendChild(div);
    });
}

function joinLobby(lobbyId, mapId) {
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
}

// Create Lobby Logic
document.getElementById('btn-submit-create').addEventListener('click', () => {
    playSound('click');
    const loadoutSelect = document.getElementById('loadout-select-input');
    const selectedLoadouts = Array.from(loadoutSelect.selectedOptions).map(option => option.value);

    const settings = {
        name: document.getElementById('lobby-name-input').value || 'FFA Match',
        mapId: document.getElementById('map-select-input').value,
        mode: document.getElementById('mode-select-input').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt(document.getElementById('round-time-input').value),
        maxPlayers: parseInt(document.getElementById('max-players-input').value),
        vehiclesAllowed: document.getElementById('vehicles-input').checked,
        friendlyFire: document.getElementById('ff-input').checked,
        respawnTime: parseInt(document.getElementById('respawn-time-input').value),
        killLimit: parseInt(document.getElementById('kill-limit-input').value)
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

document.getElementById('btn-cancel-create').addEventListener('click', () => {
    playSound('click');
    switchTab('ffa');
});

// Sync Sliders
function setupSlider(inputId, valId) {
    const input = document.getElementById(inputId);
    const val = document.getElementById(valId);
    if (!input || !val) return;
    input.addEventListener('input', () => {
        val.innerText = input.value;
    });
}
setupSlider('round-time-input', 'round-time-val');
setupSlider('max-players-input', 'max-players-val');
setupSlider('respawn-time-input', 'respawn-time-val');
setupSlider('kill-limit-input', 'kill-limit-val');

// Lobby Waiting Area
function enterLobby(lobby) {
    currentLobby = lobby;
    isHost = (myPlayerId == lobby.host);
    playSound('join');

    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-display-name').innerText = lobby.name.toUpperCase();

    document.getElementById('btn-start').style.display = isHost ? 'block' : 'none';
    document.getElementById('btn-close-lobby').style.display = isHost ? 'block' : 'none';

    renderSettingsEditor();
    syncLobbySettings(lobby);
}

function renderSettingsEditor() {
    const editor = document.getElementById('host-settings-editor');
    const view = document.getElementById('player-settings-view');

    if (isHost && !currentLobby.isPersistent) {
        editor.style.display = 'block';
        view.style.display = 'none';

        editor.innerHTML = `
            <div class="edit-group">
                <label>MAP</label>
                <select id="edit-map"></select>
            </div>
            <div class="edit-row">
                <div class="edit-group">
                    <label>MODE</label>
                    <select id="edit-mode">
                        <option value="ffa">FFA</option>
                        <option value="tdm">TDM</option>
                    </select>
                </div>
                <div class="edit-group">
                    <label>TIME</label>
                    <input type="number" id="edit-time" min="5" max="60">
                </div>
            </div>
            <button class="create-btn" style="width: 100%; margin-top: 10px;" id="btn-save-settings">SAVE SETTINGS</button>
        `;

        const mapSelect = document.getElementById('edit-map');
        maps.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.innerText = m.label;
            if (m.id === currentLobby.mapId) opt.selected = true;
            mapSelect.appendChild(opt);
        });

        document.getElementById('edit-mode').value = currentLobby.mode;
        document.getElementById('edit-time').value = currentLobby.roundTime;

        document.getElementById('btn-save-settings').onclick = () => {
            playSound('click');
            const newSettings = {
                mapId: document.getElementById('edit-map').value,
                mode: document.getElementById('edit-mode').value,
                roundTime: parseInt(document.getElementById('edit-time').value)
            };
            fetch(`https://${GetParentResourceName()}/saveSettings`, {
                method: 'POST',
                body: JSON.stringify(newSettings)
            });
        };
    } else {
        editor.style.display = 'none';
        view.style.display = 'block';
    }
}

function syncLobbySettings(lobby) {
    currentLobby = lobby;
    document.getElementById('view-map').innerText = lobby.mapLabel;
    document.getElementById('view-mode').innerText = lobby.mode.toUpperCase();
    document.getElementById('view-loadout').innerText = Array.isArray(lobby.loadout) ? lobby.loadout.join(', ').toUpperCase() : lobby.loadout.toUpperCase();
    document.getElementById('lobby-status-tag').innerText = lobby.status.toUpperCase();
    document.getElementById('lobby-display-name').innerText = lobby.name.toUpperCase();
}

function renderPlayers(players) {
    const container = document.getElementById('waiting-player-list');
    container.innerHTML = '';

    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ready-${p.ready}`;
        div.innerHTML = `
            <div class="p-info">
                <strong>${p.name}</strong>
                <span style="font-size: 11px; margin-left: 10px; color: var(--text-muted)">${p.team.toUpperCase()}</span>
            </div>
            <div class="p-actions">
                ${isHost && p.id != myPlayerId ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-minus"></i></button>` : ''}
                <i class="fa-solid ${p.ready ? 'fa-check-circle' : 'fa-clock'}" style="color: ${p.ready ? 'var(--success)' : 'var(--warning)'}"></i>
            </div>
        `;
        container.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start').disabled = (players.length < 2 && currentLobby.mode === 'tdm');
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

document.getElementById('btn-ready').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start').addEventListener('click', () => {
    playSound('start');
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave').addEventListener('click', () => {
    playSound('click');
    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

document.getElementById('btn-close-lobby').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/closeLobby`, { method: 'POST' });
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
    });
});

// Chat
document.getElementById('chat-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg.trim()) {
            fetch(`https://${GetParentResourceName()}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

function addChatMessage(name, msg) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg';
    div.innerHTML = `<span class="chat-author">${name}:</span> <span class="chat-text">${msg}</span>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// Gameplay HUD & Countdown
function handleCountdown(seconds) {
    const el = document.getElementById('big-countdown');
    const num = document.getElementById('countdown-num');

    if (seconds > 0) {
        el.style.display = 'block';
        num.innerText = seconds;
    } else {
        el.style.display = 'none';
    }
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-tdm-score').style.display = 'flex';
        document.querySelector('.score-blue').innerText = data.scoreBlue || 0;
        document.querySelector('.score-red').innerText = data.scoreRed || 0;
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health').style.width = `${data.health}%`;
    document.getElementById('hud-armor').style.width = `${data.armor}%`;
    document.getElementById('hud-ammo').innerText = data.ammo;
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('app').style.display = 'flex';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name-display').innerText = data.winnerName.toUpperCase() + ' ' + config.Locales[config.Locale].wins_suffix;

    const statsContainer = document.getElementById('winner-stats-container');
    let html = '<table><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr>';
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += '</table>';
    statsContainer.innerHTML = html;

    // Map Voting
    const voteContainer = document.getElementById('vote-options-container');
    voteContainer.innerHTML = '';
    maps.slice(0, 3).forEach(m => {
        const btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.innerText = m.label;
        btn.onclick = () => {
            playSound('click');
            fetch(`https://${GetParentResourceName()}/voteMap`, { method: 'POST', body: JSON.stringify({ mapId: m.id }) });
        };
        voteContainer.appendChild(btn);
    });
}

document.getElementById('btn-winner-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('main-menu').style.display === 'flex') {
        fetchLobbies(currentTab);
    }
}, 5000);

window.onkeyup = function(data) {
    if (data.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
};

RegisterNUICallback('saveSettings', function(data, cb) {
    TriggerServerEvent('ffa:saveSettings', data)
    cb('ok')
})
