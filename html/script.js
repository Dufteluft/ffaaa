let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

// Audio Setup
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

// Localization
function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.getAttribute('data-locale');
        if (locales[key]) {
            if (el.tagName === 'INPUT' && el.type === 'text') {
                el.placeholder = locales[key];
            } else {
                el.innerText = locales[key];
            }
        }
    });
}

// Tab Management
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab === currentTab) return;

        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        currentTab = tab;

        if (tab === 'create') {
            document.getElementById('tab-browser').style.display = 'none';
            document.getElementById('tab-create').style.display = 'block';
        } else {
            document.getElementById('tab-browser').style.display = 'block';
            document.getElementById('tab-create').style.display = 'none';
            fetchLobbies();
        }
    });
});

// Create Form Setup
function setupCreateForm() {
    const mapSelect = document.getElementById('create-map');
    mapSelect.innerHTML = '';
    serverMaps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    const loadoutGrid = document.getElementById('loadout-checkboxes');
    loadoutGrid.innerHTML = '';
    for (let key in serverConfig.WeaponLoadouts) {
        const label = document.createElement('label');
        const check = document.createElement('input');
        check.type = 'checkbox';
        check.value = key;
        check.className = 'loadout-check';
        label.appendChild(check);
        label.appendChild(document.createTextNode(' ' + key.toUpperCase()));
        loadoutGrid.appendChild(label);
    }
}

// Slider Sync
const syncSlider = (id, valId) => {
    const slider = document.getElementById(id);
    const val = document.getElementById(valId);
    if (slider && val) {
        slider.addEventListener('input', () => {
            val.innerText = slider.value;
        });
    }
};
syncSlider('create-time', 'val-time');
syncSlider('create-players', 'val-players');
syncSlider('create-respawn', 'val-respawn');
syncSlider('create-kills', 'val-kills');

// Submit Create Lobby
document.getElementById('btn-create-submit').addEventListener('click', () => {
    playSound('click');
    const selectedLoadouts = [];
    document.querySelectorAll('.loadout-check:checked').forEach(c => selectedLoadouts.push(c.value));

    const settings = {
        name: document.getElementById('create-name').value || 'FFA LOBBY',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadouts: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-kills').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };

    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
});

// Lobby Waiting Area
function showLobbyWaitingArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    document.getElementById('main-menu').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('lobby-display-name').innerText = lobby.name.toUpperCase();
    document.getElementById('lobby-display-map').innerText = 'MAP: ' + lobby.mapLabel.toUpperCase();

    document.getElementById('btn-start').style.display = asHost ? 'block' : 'none';
    document.getElementById('btn-edit-settings').style.display = asHost ? 'block' : 'none';
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const item = document.createElement('div');
        item.className = 'player-item' + (p.ready ? ' ready' : '');
        item.innerHTML = `
            <span>${p.name} ${p.isHost ? '(HOST)' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')">KICK</button>` : ''}
        `;
        list.appendChild(item);
    });

    if (isHost) {
        document.getElementById('btn-start').disabled = players.length < 2;
    }
}

function kickPlayer(id) {
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id })
    });
}

// Lobby Interactions
document.getElementById('btn-ready').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-start').addEventListener('click', () => {
    playSound('start');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/startGame`, { method: 'POST' });
});

document.getElementById('btn-leave').addEventListener('click', () => {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/leaveLobby`, { method: 'POST' });
    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
        fetch(`https://${resourceName}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.getAttribute('data-team') })
        });
    });
});

// Chat
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const msg = e.target.value;
        if (msg.trim().length > 0) {
            const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
            fetch(`https://${resourceName}/sendLobbyChat`, {
                method: 'POST',
                body: JSON.stringify({ message: msg })
            });
            e.target.value = '';
        }
    }
});

function addChatMessage(name, message) {
    const chat = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong>${name}:</strong> ${message}`;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
}

// HUD Updates
function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-scores').style.display = 'block';
        if (data.scoreBlue !== undefined) document.querySelector('.score-blue').innerText = data.scoreBlue;
        if (data.scoreRed !== undefined) document.querySelector('.score-red').innerText = data.scoreRed;
    } else {
        document.getElementById('hud-scores').style.display = 'none';
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) document.getElementById('hud-health-fill').style.width = data.health + '%';
    if (data.armor !== undefined) document.getElementById('hud-armor-fill').style.width = data.armor + '%';
    if (data.ammo !== undefined) document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    const el = document.getElementById('hud-countdown');
    if (seconds > 0) {
        el.innerText = seconds;
        el.style.display = 'block';
    } else {
        el.style.display = 'none';
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-display-name').innerText = data.winnerName.toUpperCase() + ' GEWINNT!';

    const statsTbody = document.getElementById('winner-stats');
    statsTbody.innerHTML = '';
    data.stats.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td>`;
        statsTbody.appendChild(tr);
    });
}

document.getElementById('btn-winner-lobby').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-winner-menu').addEventListener('click', () => {
    playSound('click');
    document.getElementById('winner-screen').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/leaveLobby`, { method: 'POST' });
});

// Common JS
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
        fetch(`https://${resourceName}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh
setInterval(() => {
    if (document.getElementById('app').style.display === 'flex' &&
        document.getElementById('main-menu').style.display === 'flex') {
        fetchLobbies();
    }
}, 5000);

// NUI Message Listener extensions (added above)
function joinLobby(id) {
    playSound('click');
    const resourceName = typeof GetParentResourceName !== 'undefined' ? GetParentResourceName() : 'ffa-lobby';
    fetch(`https://${resourceName}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: id })
    });
}

// Edit Settings
document.getElementById('btn-edit-settings').addEventListener('click', () => {
    playSound('click');
    // Pre-populate create form with current lobby settings
    document.getElementById('create-name').value = currentLobby.name;
    document.getElementById('create-map').value = currentLobby.mapId;
    document.getElementById('create-mode').value = currentLobby.mode;
    document.getElementById('create-time').value = currentLobby.roundTime;
    document.getElementById('create-players').value = currentLobby.maxPlayers;
    document.getElementById('create-respawn').value = currentLobby.respawnTime;
    document.getElementById('create-kills').value = currentLobby.killLimit;
    document.getElementById('create-vehicles').checked = currentLobby.vehiclesAllowed;
    document.getElementById('create-ff').checked = currentLobby.friendlyFire;

    // Switch to create tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="create"]').classList.add('active');
    document.getElementById('tab-browser').style.display = 'none';
    document.getElementById('tab-create').style.display = 'block';
    document.getElementById('lobby-waiting-area').style.display = 'none';
    document.getElementById('main-menu').style.display = 'flex';

    // Change Create Button to Update Button? For now just let them create/update.
});
