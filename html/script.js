let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// Audio
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

// Tab Switching Logic
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    $('.tab-content').removeClass('active');
    $(`#tab-${tab}-content`).addClass('active');

    currentTab = tab;
    if (tab === 'ffa' || tab === 'list') {
        fetchLobbies();
    }
});

// Slider Sync
const syncSlider = (id) => {
    $(`#create-${id}`).on('input', function() {
        $(`#val-${id}`).text($(this).val());
    });
};
['round-time', 'max-players', 'respawn-time', 'kill-limit'].forEach(syncSlider);

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(300).css('display', 'flex');
            setupInitialData(data.config, data.maps);
            fetchLobbies();
            break;
        case 'close':
            $('#app').fadeOut(300);
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
            $('#app').fadeOut(300);
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(300);
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(300);
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
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Locales
    for (let key in config.Locales[config.Locale]) {
        $(`#locale-${key.replace(/_/g, '-')}`).text(config.Locales[config.Locale][key]);
    }

    // Maps
    const $mapSelect = $('#create-map-select, #filter-maps');
    const existingFilter = $('#filter-maps').val();
    $mapSelect.find('option:not([value="all"])').remove();
    maps.forEach(map => {
        $mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });
    $('#filter-maps').val(existingFilter);

    // Loadouts (Multi-Select)
    const $loadoutGrid = $('#create-loadout-grid');
    $loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        $loadoutGrid.append(`
            <label class="loadout-item">
                <input type="checkbox" name="loadout" value="${key}">
                <span>${config.WeaponLoadouts[key].label}</span>
            </label>
        `);
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const $container = currentTab === 'ffa' ? $('#ffa-lobby-list') : $('#open-lobby-list');
    $container.empty();

    lobbies.forEach(lobby => {
        const $item = $(`
            <div class="lobby-item">
                <div class="lobby-info-main">
                    <h3>${lobby.name.toUpperCase()}</h3>
                    <div class="lobby-info-details">
                        <span><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</span>
                        <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                        <span><i class="fa-solid fa-user-tie"></i> ${lobby.hostName}</span>
                    </div>
                </div>
                <div class="player-count-badge">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <div class="action-area">
                    ${renderActionButton(lobby)}
                </div>
            </div>
        `);
        $container.append($item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>VOLL</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn" onclick="joinLobby('${lobby.id}')">SPECTATE</button>`;
    }
    const btnText = serverConfig.Locales[serverConfig.Locale].btn_join || 'BEITRETEN';
    const action = lobby.isPersistent ? `quickJoin('${lobby.mapId}')` : `joinLobby('${lobby.id}')`;
    return `<button class="action-btn" onclick="${action}">${btnText}</button>`;
}

function joinLobby(lobbyId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
}

function quickJoin(mapId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/quickJoin`, JSON.stringify({ mapId }));
}

$('#btn-create-action').on('click', function() {
    playSound('click');
    const loadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        loadouts.push($(this).val());
    });

    const settings = {
        name: $('#create-lobby-name').val() || 'CUSTOM LOBBY',
        mapId: $('#create-map-select').val(),
        mode: $('#create-mode-select').val(),
        loadout: loadouts.length > 0 ? loadouts : ['all'],
        roundTime: parseInt($('#create-round-time').val()),
        maxPlayers: parseInt($('#create-max-players').val()),
        vehiclesAllowed: $('#create-vehicles').is(':checked'),
        friendlyFire: $('#create-ff').is(':checked'),
        respawnTime: parseInt($('#create-respawn-time').val()),
        killLimit: parseInt($('#create-kill-limit').val())
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

$('#btn-cancel-create').on('click', function() {
    playSound('click');
    $('.tab-btn[data-tab="ffa"]').click();
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#waiting-lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);
    $('#btn-start-game').toggle(asHost);

    $('#lobby-settings-summary').html(`
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODUS: ${lobby.mode.toUpperCase()}</p>
        <p>ZEIT: ${lobby.roundTime} MIN</p>
        <p>LIMIT: ${lobby.killLimit > 0 ? lobby.killLimit : '∞'}</p>
    `);
}

function renderPlayerList(players) {
    const $container = $('#player-list-container');
    $container.empty();

    players.forEach(p => {
        $container.append(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <span>${p.name.toUpperCase()} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold; margin-left: 5px;"></i>' : ''}</span>
                <div style="display: flex; align-items: center; gap: 15px;">
                    <span style="font-size: 11px; font-weight: 800; opacity: 0.6;">${p.team.toUpperCase()}</span>
                    ${isHost && !p.isHost ? `<i class="fa-solid fa-xmark kick-btn" onclick="kickPlayer('${p.id}')"></i>` : ''}
                </div>
            </div>
        `);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 1); // Setze auf 2 für Release
    }
}

function kickPlayer(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
}

$('#btn-ready-toggle').on('click', function() {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`);
});

$('#btn-start-game').on('click', function() {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`);
});

$('#btn-leave-lobby').on('click', function() {
    playSound('click');
    $('#lobby-waiting-area').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('.team-btn').on('click', function() {
    playSound('click');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

// Chat
$('#lobby-chat-input').on('keypress', function(e) {
    if (e.which === 13) {
        const msg = $(this).val();
        if (msg.trim()) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
            $(this).val('');
        }
    }
});

function addChatMessage(name, message) {
    const $msg = $(`<div class="chat-msg"><span class="name">${name}:</span> <span class="text">${message}</span></div>`);
    $('#lobby-chat-messages').append($msg);
    $('#lobby-chat-messages').scrollTop($('#lobby-chat-messages')[0].scrollHeight);
}

// HUD Updates
function updateHUD(data) {
    if (data.time) $('#hud-timer').text(data.time);
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
    $('#hud-health-fill').css('width', `${data.health}%`);
    $('#hud-armor-fill').css('width', `${data.armor}%`);
    $('#hud-ammo').text(data.ammo);
}

function handleCountdown(seconds) {
    if (seconds > 0) {
        // Optionale Visualisierung im HUD
    } else {
        // Start-Effekt
    }
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    $('#winner-announcement').text(serverConfig.Locales[serverConfig.Locale].winner_suffix || 'GEWINNT!');
    $('#winner-player-name').text(data.winnerName.toUpperCase());

    let html = `<table><thead><tr><th>SPIELER</th><th>KILLS</th><th>TODE</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    $('#end-game-stats').html(html);

    $('#winner-screen').fadeIn(500);
}

$('#btn-back-to-lobby').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
});

$('#btn-back-to-menu').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

// Auto-Refresh
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);

// Filters
$('#filter-maps, #filter-players').on('change', function() {
    fetchLobbies();
});
