let serverConfig = {};
let currentTab = 'ffa';
let currentLobby = null;
let isHost = false;

// UI Elements
const app = document.getElementById('app');
const lobbyBrowser = document.getElementById('lobby-browser');
const createSection = document.getElementById('create-section');
const lobbyWaitingArea = document.getElementById('lobby-waiting-area');
const winnerScreen = document.getElementById('winner-screen');
const gameHud = document.getElementById('game-hud');
const countdownOverlay = document.getElementById('game-countdown');

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === currentTab) return;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = tab;

        if (tab === 'create') {
            lobbyBrowser.style.display = 'none';
            createSection.style.display = 'flex';
        } else {
            createSection.style.display = 'none';
            lobbyBrowser.style.display = 'block';
            fetchLobbies();
        }
        playSound('click');
    });
});

// NUI Message Listener
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            app.style.display = 'flex';
            setupConfig(data.config, data.maps);
            fetchLobbies();
            break;
        case 'close':
            app.style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            showWaitingArea(data.lobby, data.action === 'lobbyCreated');
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            app.style.display = 'none';
            lobbyWaitingArea.style.display = 'none';
            break;
        case 'showHUD':
            gameHud.style.display = 'block';
            document.getElementById('hud-tdm-score').style.display = (data.mode === 'tdm') ? 'block' : 'none';
            break;
        case 'hideHUD':
            gameHud.style.display = 'none';
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            updateHUDDetails(data);
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinner(data);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setupConfig(config, maps) {
    serverConfig = config;
    applyLocalization(config.Locales[config.Locale]);

    // Map Select
    const mapSelect = document.getElementById('create-map');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    // Loadout Multi-Select
    const loadoutGroup = document.getElementById('create-loadout');
    loadoutGroup.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const label = document.createElement('label');
        label.innerHTML = `<input type="checkbox" name="loadout" value="${key}"> ${key.toUpperCase()}`;
        loadoutGroup.appendChild(label);
    }
}

function applyLocalization(locales) {
    document.querySelectorAll('[data-locale]').forEach(el => {
        const key = el.dataset.locale;
        if (locales[key]) el.innerText = locales[key];
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

    lobbies.forEach(lobby => {
        const div = document.createElement('div');
        div.className = 'lobby-item';
        div.innerHTML = `
            <div class="lobby-info-main">
                <div class="match-type">${lobby.name}</div>
                <div class="map-name-row">${lobby.mapLabel} • ${lobby.mode.toUpperCase()}</div>
            </div>
            <div class="player-count">${lobby.playerCount}/${lobby.maxPlayers}</div>
            <button class="confirm-btn" onclick="joinLobby('${lobby.id}')" ${lobby.playerCount >= lobby.maxPlayers ? 'disabled' : ''}>
                ${serverConfig.Locales[serverConfig.Locale]['btn_join']}
            </button>
        `;
        container.appendChild(div);
    });
}

function joinLobby(id) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/joinLobby`, {
        method: 'POST',
        body: JSON.stringify({ lobbyId: id })
    });
}

// Create Lobby Form
document.getElementById('btn-submit-create').addEventListener('click', () => {
    const selectedLoadouts = Array.from(document.querySelectorAll('input[name="loadout"]:checked')).map(el => el.value);

    const settings = {
        name: document.getElementById('create-name').value || 'FFA LOBBY',
        mapId: document.getElementById('create-map').value,
        mode: document.getElementById('create-mode').value,
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'all',
        roundTime: parseInt(document.getElementById('create-time').value),
        maxPlayers: parseInt(document.getElementById('create-players').value),
        respawnTime: parseInt(document.getElementById('create-respawn').value),
        killLimit: parseInt(document.getElementById('create-killlimit').value),
        vehiclesAllowed: document.getElementById('create-vehicles').checked,
        friendlyFire: document.getElementById('create-ff').checked
    };

    fetch(`https://${GetParentResourceName()}/createLobby`, {
        method: 'POST',
        body: JSON.stringify(settings)
    });
    playSound('click');
});

// Slider Value Updates
const sliders = ['time', 'players', 'respawn', 'killlimit'];
sliders.forEach(s => {
    const el = document.getElementById(`create-${s}`);
    el.addEventListener('input', () => {
        document.getElementById(`val-${s}`).innerText = el.value;
    });
});

function showWaitingArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;

    document.getElementById('lobby-display-name').innerText = lobby.name;
    document.getElementById('lobby-display-meta').innerText = `${lobby.mapLabel} • ${lobby.mode.toUpperCase()} • ${lobby.roundTime} MIN`;

    lobbyWaitingArea.style.display = 'flex';
    document.getElementById('btn-start').style.display = asHost ? 'block' : 'none';

    document.getElementById('chat-messages').innerHTML = '';
    playSound('join');
}

function renderPlayerList(players) {
    const container = document.getElementById('player-list');
    container.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 11px; opacity: 0.6;">${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-circle-xmark"></i></button>` : ''}
            </div>
        `;
        container.appendChild(div);
    });

    if (isHost) {
        document.getElementById('btn-start').disabled = players.length < 2 && !currentLobby.isPersistent;
    }
}

function kickPlayer(id) {
    fetch(`https://${GetParentResourceName()}/kickPlayer`, {
        method: 'POST',
        body: JSON.stringify({ id: id })
    });
}

document.getElementById('btn-ready').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
    playSound('click');
});

document.getElementById('btn-start').addEventListener('click', () => {
    fetch(`https://${GetParentResourceName()}/startGame`, { method: 'POST' });
    playSound('start');
});

document.getElementById('btn-leave').addEventListener('click', () => {
    lobbyWaitingArea.style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
    playSound('click');
});

document.querySelectorAll('.team-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.team-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`https://${GetParentResourceName()}/setTeam`, {
            method: 'POST',
            body: JSON.stringify({ team: btn.dataset.team })
        });
        playSound('click');
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

function addChatMessage(name, message) {
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.innerHTML = `<strong style="color: var(--primary)">${name}:</strong> ${message}`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function updateHUD(data) {
    if (data.time) document.getElementById('hud-timer').innerText = data.time;
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;
    if (data.scoreBlue !== undefined) {
        document.querySelector('#hud-tdm-score .blue').innerText = data.scoreBlue;
        document.querySelector('#hud-tdm-score .red').innerText = data.scoreRed;
    }
}

function updateHUDDetails(data) {
    document.getElementById('hud-health').style.width = `${data.health}%`;
    document.getElementById('hud-armor').style.width = `${data.armor}%`;
    document.getElementById('hud-ammo').innerText = data.ammo;
}

function showCountdown(seconds) {
    if (seconds > 0) {
        countdownOverlay.style.display = 'flex';
        countdownOverlay.querySelector('.countdown-number').innerText = seconds;
    } else {
        countdownOverlay.style.display = 'none';
    }
}

function showWinner(data) {
    winnerScreen.style.display = 'flex';
    document.getElementById('winner-display-name').innerText = data.winnerName;

    // Stats Table
    let statsHtml = `<table style="width: 100%; margin-top: 20px; border-collapse: collapse;">
        <thead><tr style="border-bottom: 1px solid var(--border); opacity: 0.6;">
            <th style="text-align: left; padding: 10px;">SPIELER</th>
            <th>KILLS</th><th>TODE</th><th>K/D</th>
        </tr></thead><tbody>`;

    data.stats.forEach(s => {
        statsHtml += `<tr style="border-bottom: 1px solid var(--border);">
            <td style="text-align: left; padding: 10px;">${s.name}</td>
            <td style="text-align: center;">${s.kills}</td>
            <td style="text-align: center;">${s.deaths}</td>
            <td style="text-align: center;">${s.kd}</td>
        </tr>`;
    });
    statsHtml += `</tbody></table>`;
    document.getElementById('winner-stats').innerHTML = statsHtml;

    // Map Voting
    const voteContainer = document.getElementById('vote-options');
    voteContainer.innerHTML = '';
    serverConfig.Maps.slice(0, 3).forEach(map => {
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
        voteContainer.appendChild(div);
    });

    playSound('win');
}

document.getElementById('btn-back-lobby').addEventListener('click', () => {
    winnerScreen.style.display = 'none';
    fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
});

document.getElementById('btn-back-menu').addEventListener('click', () => {
    winnerScreen.style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
});

function playSound(name) {
    // In FiveM NUI we usually use a frontend sound or just trigger a client event
    // For this task, we assume the assets exist or we trigger a client event
    fetch(`https://${GetParentResourceName()}/playSound`, {
        method: 'POST',
        body: JSON.stringify({ sound: name })
    });
}

// Close on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});

// Auto-Refresh for Lobbies
setInterval(() => {
    if (app.style.display === 'flex' && lobbyWaitingArea.style.display === 'none' && winnerScreen.style.display === 'none') {
        fetchLobbies();
    }
}, 5000);
