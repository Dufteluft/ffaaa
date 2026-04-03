let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let currentWinnerData = null;

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

$(document).ready(function() {
    // Tab Switching
    $('.tab-btn').click(function() {
        const tab = $(this).data('tab');
        if (tab === currentTab) return;

        playSound('click');
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');

        currentTab = tab;

        if (tab === 'create') {
            $('#tab-list-content').hide();
            $('#main-sidebar').hide();
            $('#tab-create-content').show();
        } else {
            $('#tab-create-content').hide();
            $('#tab-list-content').show();
            $('#main-sidebar').show();
            fetchLobbies();
        }
    });

    // Slider Listeners
    const sliders = [
        { id: 'create-time', val: 'val-time' },
        { id: 'create-players', val: 'val-players' },
        { id: 'create-respawn', val: 'val-respawn' },
        { id: 'create-kills', val: 'val-kills' }
    ];

    sliders.forEach(s => {
        $(`#${s.id}`).on('input', function() {
            $(`#${s.val}`).text($(this).val());
        });
    });

    // Create Lobby Submit
    $('#btn-submit-create').click(function() {
        playSound('click');
        const loadouts = [];
        $('.loadout-checkbox:checked').each(function() {
            loadouts.push($(this).val());
        });

        const settings = {
            name: $('#create-name').val() || 'Custom Match',
            mapId: $('#create-map').val(),
            mode: $('#create-mode').val(),
            loadout: loadouts,
            roundTime: parseInt($('#create-time').val()),
            maxPlayers: parseInt($('#create-players').val()),
            respawnTime: parseInt($('#create-respawn').val()),
            killLimit: parseInt($('#create-kills').val()),
            vehiclesAllowed: $('#create-vehicles').is(':checked'),
            friendlyFire: $('#create-ff').is(':checked')
        };

        $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
    });

    $('#btn-cancel-create').click(function() {
        playSound('click');
        $('.tab-btn[data-tab="ffa"]').click();
    });

    // Lobby Actions
    $('#btn-ready-toggle').click(() => { playSound('click'); $.post(`https://${GetParentResourceName()}/toggleReady`); });
    $('#btn-start-game').click(() => { playSound('start'); $.post(`https://${GetParentResourceName()}/startGame`); });
    $('#btn-leave-lobby').click(() => { playSound('click'); $.post(`https://${GetParentResourceName()}/leaveLobby`); hideLobbyArea(); });
    $('#btn-close-lobby').click(() => { playSound('click'); $.post(`https://${GetParentResourceName()}/closeLobby`); hideLobbyArea(); });

    $('.team-btn').click(function() {
        playSound('click');
        $('.team-btn').removeClass('active');
        $(this).addClass('active');
        $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
    });

    // Chat
    $('#btn-send-chat').click(sendChatMessage);
    $('#chat-input').keypress(function(e) { if (e.which == 13) sendChatMessage(); });

    // Winner Screen
    $('#btn-back-to-lobby').click(() => {
        $('#winner-screen').hide();
        $('#lobby-waiting-area').show();
        $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
    });

    $('#btn-back-to-menu').click(() => {
        $('#winner-screen').hide();
        $('#app').show();
        $.post(`https://${GetParentResourceName()}/leaveLobby`);
    });
});

function sendChatMessage() {
    const msg = $('#chat-input').val();
    if (msg.trim().length > 0) {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
        $('#chat-input').val('');
    }
}

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').show();
            $('#game-hud').hide();
            setupInitialData(data.config, data.maps);
            setLocales(data.config.Locales[data.config.Locale]);
            fetchLobbies();
            break;
        case 'close':
            $('#app').hide();
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
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            $('#game-hud').show();
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
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'playSound':
            playSound(data.sound);
            break;
    }
});

function setLocales(locales) {
    if (!locales) return;
    for (const [key, value] of Object.entries(locales)) {
        $(`.l-${key}`).html(value);
        $(`#l-${key}`).html(value);
    }
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const mapSelect = $('#create-map');
    mapSelect.empty();
    maps.forEach(map => {
        mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    const loadoutGrid = $('#create-loadout-grid');
    loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        loadoutGrid.append(`
            <label class="checkbox-container">
                <input type="checkbox" class="loadout-checkbox" value="${key}">
                <span class="checkmark"></span>
                ${key.toUpperCase()}
            </label>
        `);
    }

    const filterMaps = $('#filter-maps');
    filterMaps.empty().append('<option value="all">ALL MAPS</option>');
    maps.forEach(map => {
        filterMaps.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    lobbies.forEach(lobby => {
        const item = $(`
            <div class="lobby-item">
                <div class="lobby-map-preview">
                    <img src="https://via.placeholder.com/120x80/0f1419/ffffff?text=${lobby.mapLabel}" alt="${lobby.mapLabel}">
                </div>
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                    <div class="lobby-name-row">${lobby.name}</div>
                    <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</div>
                    <div class="lobby-item-footer">
                        <span><i class="fa-solid fa-user"></i> ${lobby.playerCount}/${lobby.maxPlayers}</span>
                        <span class="status-badge status-${lobby.status.toLowerCase()}">${lobby.status}</span>
                    </div>
                </div>
                <div class="action-area">
                    <button class="confirm-btn" style="padding: 10px 20px;" onclick="joinLobby('${lobby.id}', ${lobby.isPersistent})">BEITRETEN</button>
                </div>
            </div>
        `);
        container.append(item);
    });
}

function joinLobby(lobbyId, isPersistent) {
    playSound('click');
    if (isPersistent) {
        // Quick join for persistent lobbies
        const lobby = serverMaps.find(m => "FFA " + m.label === lobbies.find(l => l.id === lobbyId).name); // Hacky, better to use mapId
        // The server handles quickJoin via mapId
        const lobbyData = serverMaps.find(m => lobbyId === lobbyId); // This logic needs to be better
        // We use the ID passed from server
        $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
    } else {
        $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
    }
}

// Global join function for inline onclick
window.joinLobby = (id, isPersistent) => {
    playSound('click');
    if (currentTab === 'ffa') {
        // For FFA tab, we might want quickJoin logic
        const lobby = serverMaps.find(m => "FFA " + m.label === lobbies.find(l => l.id === id).name);
        // But since we have the lobbyId from updateLobbies, joinLobby is enough
    }
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId: id }));
};

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#app').hide();
    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').show();

    $('#btn-start-game').toggle(asHost);
    $('#btn-close-lobby').toggle(asHost);

    $('#lobby-info-summary').html(`
        <div><i class="fa-solid fa-map"></i> MAP: ${lobby.mapLabel}</div>
        <div><i class="fa-solid fa-gamepad"></i> MODUS: ${lobby.mode.toUpperCase()}</div>
        <div><i class="fa-solid fa-clock"></i> ZEIT: ${lobby.roundTime} MIN</div>
        <div><i class="fa-solid fa-skull"></i> LIMIT: ${lobby.killLimit || 'AUS'}</div>
    `);

    $('#chat-messages').empty();
}

function hideLobbyArea() {
    $('#lobby-waiting-area').hide();
    $('#app').show();
}

function renderPlayerList(players) {
    const list = $('#player-list');
    list.empty();
    players.forEach(p => {
        const item = $(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <div>
                    <span class="chat-name">${p.name.toUpperCase()}</span>
                    ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; font-size: 10px;"></i>' : ''}
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 10px; opacity: 0.5;">${p.team.toUpperCase()}</span>
                    ${isHost && !p.isHost ? `<i class="fa-solid fa-xmark" style="color: var(--danger); cursor: pointer;" onclick="kickPlayer('${p.id}')"></i>` : ''}
                </div>
            </div>
        `);
        list.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
    }
}

window.kickPlayer = (id) => {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
};

function addChatMessage(name, message) {
    const container = $('#chat-messages');
    container.append(`
        <div class="chat-msg">
            <span class="chat-name">${name}:</span>
            <span class="chat-text">${message}</span>
        </div>
    `);
    container.scrollTop(container[0].scrollHeight);
}

function updateHUD(data) {
    if (data.time) $('#hud-timer-val').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);

    if (data.mode === 'tdm') {
        $('#hud-tdm-scores').show();
        if (data.scoreBlue !== undefined) $('#hud-score-blue').text(data.scoreBlue);
        if (data.scoreRed !== undefined) $('#hud-score-red').text(data.scoreRed);
    } else {
        $('#hud-tdm-scores').hide();
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) $('#hud-health-fill').css('width', data.health + '%');
    if (data.armor !== undefined) $('#hud-armor-fill').css('width', data.armor + '%');
    if (data.ammo !== undefined) $('#hud-ammo').text(data.ammo);
}

function showWinnerScreen(data) {
    playSound('win');
    currentWinnerData = data;
    $('#game-hud').hide();
    $('#winner-screen').css('display', 'flex');
    $('#winner-name').text(data.winnerName.toUpperCase());

    const tbody = $('#match-stats-tbody');
    tbody.empty();
    data.stats.forEach(s => {
        tbody.append(`
            <tr>
                <td>${s.name.toUpperCase()}</td>
                <td>${s.kills}</td>
                <td>${s.deaths}</td>
                <td>${s.kd}</td>
            </tr>
        `);
    });

    // Map Voting
    const voteGrid = $('#voting-grid');
    voteGrid.empty();
    serverMaps.slice(0, 3).forEach(map => {
        voteGrid.append(`
            <div class="vote-item" onclick="voteMap('${map.id}', this)">
                <div style="font-weight: 800;">${map.label.toUpperCase()}</div>
                <div style="font-size: 10px; opacity: 0.5;">AUSWÄHLEN</div>
            </div>
        `);
    });
}

window.voteMap = (mapId, elem) => {
    playSound('click');
    $('.vote-item').removeClass('active');
    $(elem).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
};

function handleCountdown(seconds) {
    if (seconds > 0) {
        // We could show a big countdown overlay here
    } else {
        // Countdown finished
    }
}

// Auto-Refresh Lobbies
setInterval(() => {
    if ($('#app').is(':visible') && currentTab !== 'create') {
        fetchLobbies();
    }
}, 5000);
