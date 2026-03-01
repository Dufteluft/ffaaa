let currentLobby = null;
let isHost = false;
let myPlayerId = null;

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
        // Fehlerbehandlung falls Audio-Dateien fehlen
        sounds[name].play().catch(e => {
            console.warn(`Audio ${name} konnte nicht abgespielt werden:`, e.message);
        });
    }
}

// Event Listeners for Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        playSound('click');
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');

        if (btn.dataset.tab === 'open-lobbies') {
            fetchLobbies();
        }
    });
});

// Settings Sliders Sync
const sliderSync = (id) => {
    const slider = document.getElementById(id);
    const valSpan = document.getElementById(id + '-val');
    slider.addEventListener('input', () => {
        valSpan.innerText = slider.value;
    });
};
sliderSync('round-time');
sliderSync('max-players');
sliderSync('respawn-time');
sliderSync('kill-limit');

// Listen for NUI Messages
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            document.getElementById('app').style.display = 'flex';
            setupInitialData(data.config, data.maps);

            // "FFA verlassen" Button anzeigen wenn im Spiel
            if (data.isInGame) {
                document.getElementById('btn-quit-ffa').style.display = 'block';
            } else {
                document.getElementById('btn-quit-ffa').style.display = 'none';
            }
            break;
        case 'close':
            document.getElementById('app').style.display = 'none';
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
            showLobbyArea(data.lobby, true);
            break;
        case 'lobbyJoined':
            showLobbyArea(data.lobby, false);
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
            if (data.isPersistent) {
                document.getElementById('hud-timer').style.display = 'none';
            } else {
                document.getElementById('hud-timer').style.display = 'block';
            }
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            document.getElementById('hud-health').innerText = data.health;
            document.getElementById('hud-armor').innerText = data.armor;
            document.getElementById('hud-ammo').innerText = data.ammo;
            break;
        case 'hideHUD':
            document.getElementById('game-hud').style.display = 'none';
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'countdown':
            showCountdown(data.seconds);
            break;
    }
});

function setupInitialData(config, maps) {
    // Fill Map Select
    const mapSelect = document.getElementById('map-select');
    mapSelect.innerHTML = '';
    maps.forEach(map => {
        const opt = document.createElement('option');
        opt.value = map.id;
        opt.innerText = map.label;
        mapSelect.appendChild(opt);
    });

    // Fill Loadout Select
    const loadoutSelect = document.getElementById('loadout-select');
    loadoutSelect.innerHTML = '';
    for (let key in config.WeaponLoadouts) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.innerText = key.charAt(0).toUpperCase() + key.slice(1);
        loadoutSelect.appendChild(opt);
    }

    // Predefined FFA Maps
    const ffaGrid = document.querySelector('.map-grid');
    ffaGrid.innerHTML = '';
    maps.forEach(map => {
        const card = document.createElement('div');
        card.className = 'map-card';
        card.innerHTML = `
            <div class="map-image-placeholder"></div>
            <div class="map-info">
                <h3>${map.label}</h3>
                <p>FFA Standard</p>
                <button class="primary-btn" onclick="quickJoin('${map.id}')">BEITRETEN</button>
            </div>
        `;
        ffaGrid.appendChild(card);
    });
}

function quickJoin(mapId) {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/quickJoin`, {
        method: 'POST',
        body: JSON.stringify({ mapId })
    });
}

function fetchLobbies() {
    fetch(`https://${GetParentResourceName()}/fetchLobbies`, {
        method: 'POST'
    });
}

function renderLobbyList(lobbies) {
    const tbody = document.getElementById('lobby-list-body');
    tbody.innerHTML = '';
    lobbies.forEach(lobby => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${lobby.name}</td>
            <td>${lobby.hostName}</td>
            <td>${lobby.playerCount} / ${lobby.maxPlayers}</td>
            <td>${lobby.mapLabel}</td>
            <td>${lobby.mode.toUpperCase()}</td>
            <td><button class="primary-btn" onclick="joinLobby('${lobby.id}')">Beitreten</button></td>
        `;
        tbody.appendChild(tr);
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
    const settings = {
        name: document.getElementById('lobby-name').value || 'Neue Lobby',
        mapId: document.getElementById('map-select').value,
        mode: document.getElementById('mode-select').value,
        loadout: document.getElementById('loadout-select').value,
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

    document.getElementById('lobby-title').innerText = lobby.name;
    document.getElementById('lobby-waiting-area').style.display = 'flex';
    document.getElementById('btn-start-game').style.display = asHost ? 'block' : 'none';

    // Summary info
    document.getElementById('lobby-info-summary').innerHTML = `
        <p>Map: ${lobby.mapLabel}</p>
        <p>Modus: ${lobby.mode.toUpperCase()}</p>
        <p>Zeit: ${lobby.roundTime} Min</p>
    `;
}

function renderPlayerList(players) {
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    players.forEach(p => {
        const div = document.createElement('div');
        div.className = `player-item ${p.ready ? 'ready' : ''}`;
        div.innerHTML = `
            <span>${p.name} ${p.isHost ? '(HOST)' : ''}</span>
            <span>${p.team.toUpperCase()}</span>
            ${isHost && !p.isHost ? `<button class="secondary-btn" onclick="kickPlayer('${p.id}')">Kick</button>` : ''}
        `;
        list.appendChild(div);
    });

    // Enable/Disable Start Button
    if (isHost) {
        const allReady = players.filter(p => !p.isHost).every(p => p.ready);
        document.getElementById('btn-start-game').disabled = players.length < 2; // Need at least 2 players
    }
}

// ... more UI logic for teams, ready, leave ...
document.getElementById('btn-ready-toggle').addEventListener('click', () => {
    playSound('click');
    fetch(`https://${GetParentResourceName()}/toggleReady`, { method: 'POST' });
});

document.getElementById('btn-quit-ffa').addEventListener('click', () => {
    playSound('click');
    document.getElementById('btn-quit-ffa').style.display = 'none';
    fetch(`https://${GetParentResourceName()}/leaveLobby`, { method: 'POST' });
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

// Team selection
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

// Auto-Refresh Lobbys alle 5 Sekunden wenn Tab offen
setInterval(() => {
    const openLobbiesTab = document.getElementById('open-lobbies');
    if (openLobbiesTab.classList.contains('active') && document.getElementById('app').style.display === 'flex') {
        fetchLobbies();
    }
}, 5000);

// HUD Updates
function updateHUD(data) {
    if (data.time) {
        document.getElementById('hud-timer').innerText = data.time;
        // Timer verstecken wenn 00:00 (Persistent)
        if (data.time === '00:00') {
            document.getElementById('hud-timer').style.display = 'none';
        } else {
            document.getElementById('hud-timer').style.display = 'block';
        }
    }
    if (data.kills !== undefined) document.getElementById('hud-kills').innerText = data.kills;
    if (data.deaths !== undefined) document.getElementById('hud-deaths').innerText = data.deaths;

    if (data.mode === 'tdm') {
        document.getElementById('hud-team-score').style.display = 'block';
        document.querySelector('.score-blue').innerText = `B: ${data.scoreBlue}`;
        document.querySelector('.score-red').innerText = `R: ${data.scoreRed}`;
    } else {
        document.getElementById('hud-team-score').style.display = 'none';
    }
}

function showCountdown(seconds) {
    const overlay = document.getElementById('countdown-overlay');
    const num = document.getElementById('countdown-number');
    overlay.style.display = 'block';
    num.innerText = seconds;
    if (seconds <= 0) {
        overlay.style.display = 'none';
    }
}

function showWinnerScreen(data) {
    playSound('win');
    document.getElementById('game-hud').style.display = 'none';
    document.getElementById('winner-screen').style.display = 'flex';
    document.getElementById('winner-name').innerText = data.winnerName + " GEWINNT!";

    const statsTable = document.getElementById('match-stats-table');
    let html = `<table><thead><tr><th>Name</th><th>Kills</th><th>Tode</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.innerHTML = html;

    // Map Voting (nur wenn nicht persistent)
    if (currentLobby && !currentLobby.isPersistent) {
        document.getElementById('map-voting-section').style.display = 'block';
        const voteGrid = document.getElementById('voting-maps-grid');
        voteGrid.innerHTML = '';

        // 3 Zufällige Maps zur Auswahl
        // In einer echten Umgebung kämen diese vom Server
        const maps = ['legion', 'sandyshores', 'airport', 'vinewood', 'port', 'paleto'];
        const selection = maps.sort(() => 0.5 - Math.random()).slice(0, 3);

        selection.forEach(mapId => {
            const btn = document.createElement('button');
            btn.className = 'secondary-btn';
            btn.innerText = mapId.toUpperCase();
            btn.onclick = () => {
                playSound('click');
                fetch(`https://${GetParentResourceName()}/voteMap`, {
                    method: 'POST',
                    body: JSON.stringify({ mapId })
                });
                btn.style.borderColor = '#fbc02d';
            };
            voteGrid.appendChild(btn);
        });
    } else {
        document.getElementById('map-voting-section').style.display = 'none';
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
    if (currentLobby && currentLobby.isPersistent) {
        // Bei persistenten Lobbys bleiben wir einfach drin
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    } else {
        document.getElementById('lobby-waiting-area').style.display = 'flex';
        fetch(`https://${GetParentResourceName()}/closeWinnerScreen`, { method: 'POST' });
    }
});

// Chat Logik
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

window.addEventListener('message', (event) => {
    if (event.data.action === 'addChatMessage') {
        const chat = document.getElementById('chat-messages');
        const div = document.createElement('div');
        div.innerHTML = `<strong>${event.data.name}:</strong> ${event.data.message}`;
        chat.appendChild(div);
        chat.scrollTop = chat.scrollHeight;
    }
});

// Close UI on Escape
window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') {
        fetch(`https://${GetParentResourceName()}/closeUI`, { method: 'POST' });
    }
});
