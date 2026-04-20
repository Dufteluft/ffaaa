let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let playerStats = {};

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
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');
    currentTab = tab;

    // Show/Hide sections based on tab
    if (tab === 'create') {
        $('#lobby-list-container').hide();
        $('#sidebar-filters').hide();
        $('#create-lobby-form').fadeIn(300);
    } else {
        $('#create-lobby-form').hide();
        $('#lobby-list-container').show();
        $('#sidebar-filters').show();
        fetchLobbies();
    }
});

// Slider Value Updates
const setupSlider = (id) => {
    $(`#${id}`).on('input', function() {
        $(`#${id}-val`).text($(this).val());
    });
};
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

// NUI Message Handling
window.addEventListener('message', function(event) {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(300).css('display', 'flex');
            setupInitialData(data.config, data.maps);
            applyLocales(data.config.Locale);
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
            $('#create-lobby-form').hide();
            showLobbyArea(data.lobby, data.lobby.host === data.myId);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
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
            showCountdown(data.seconds);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Fill Map Select & Filters
    const mapSelect = $('#map-select');
    const filterMaps = $('#filter-maps');
    mapSelect.empty();
    filterMaps.find('option:not([value="all"])').remove();

    maps.forEach(map => {
        mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
        filterMaps.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    // Fill Loadout Multi-Select (Checkboxes)
    const checkboxGrid = $('#loadout-checkbox-grid');
    checkboxGrid.empty();
    for (let key in config.WeaponLoadouts) {
        checkboxGrid.append(`
            <label class="checkbox-item">
                <input type="checkbox" name="loadout" value="${key}" ${key === 'all' ? 'checked' : ''}>
                <span>${config.WeaponLoadouts[key].label.toUpperCase()}</span>
            </label>
        `);
    }

    // Map Voting Grid (First 4 maps)
    const votingGrid = $('#map-voting-grid');
    votingGrid.empty();
    maps.slice(0, 4).forEach(map => {
        votingGrid.append(`
            <div class="map-vote-item" onclick="voteMap('${map.id}')" id="vote-${map.id}">
                <div class="map-vote-label">${map.label.toUpperCase()}</div>
                <div class="vote-count" id="vote-count-${map.id}">0</div>
            </div>
        `);
    });
}

function applyLocales(lang) {
    const loc = serverConfig.Locales[lang];
    if (!loc) return;

    $('#menu-title').text(loc.menu_title);
    $('#tab-ffa').text(loc.tab_ffa);
    $('#tab-create').text(loc.tab_create);
    $('#tab-list').text(loc.tab_list);
    $('#label-maps').html(`${loc.map} <i class="fa-solid fa-chevron-down"></i>`);
    $('#label-players').html(`${loc.players} <i class="fa-solid fa-chevron-down"></i>`);
    $('#btn-sidebar-create').text(loc.btn_create);
    $('#label-lobby-name').text(loc.lobby_name);
    $('#label-map-select').text(loc.map_select);
    $('#label-mode-select').text(loc.mode_select);
    $('#label-loadout-select').text(loc.loadout_select);
    $('#label-round-time').text(loc.round_time);
    $('#label-max-players').text(loc.max_players);
    $('#label-vehicles-allowed').text(loc.vehicles_allowed);
    $('#label-friendly-fire').text(loc.friendly_fire);
    $('#label-respawn-time').text(loc.respawn_time);
    $('#label-kill-limit').text(loc.kill_limit);
    $('#btn-create-lobby').text(loc.btn_create);
    $('#btn-cancel-create').text(loc.btn_cancel);
    $('#label-players-list').text(loc.players);
    $('#label-settings').text(loc.tab_create);
    $('#btn-team-blue').text(loc.team_blue);
    $('#btn-team-red').text(loc.team_red);
    $('#btn-team-spec').text(loc.spectator);
    $('#btn-team-random').text(loc.random);
    $('#btn-ready-toggle').text(loc.btn_ready);
    $('#btn-start-game').text(loc.btn_start);
    $('#btn-leave-lobby').text(loc.btn_leave);
    $('#label-game-ended').text(loc.game_ended);
    $('#winner-suffix').text(loc.winner_suffix);
    $('#btn-back-to-lobby').text(loc.back_to_lobby);
    $('#btn-back-to-menu').text(loc.main_menu);
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({
        tab: currentTab,
        map: $('#filter-maps').val(),
        players: $('#filter-players').val()
    }));
}

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    lobbies.forEach(lobby => {
        const loc = serverConfig.Locales[serverConfig.Locale];
        const item = $(`
            <div class="lobby-item">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                    <div class="lobby-name-display">${lobby.name}</div>
                    <div class="lobby-stats-row">
                        <span><i class="fa-solid fa-user"></i> ${lobby.hostName}</span>
                        <span><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</span>
                    </div>
                </div>
                <div class="player-count-badge">${lobby.playerCount} / ${lobby.maxPlayers}</div>
                <div class="action-area">
                    ${renderActionButton(lobby, loc)}
                </div>
            </div>
        `);
        container.append(item);
    });
}

function renderActionButton(lobby, loc) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>${loc.full}</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}', true)">${loc.spectate}</button>`;
    }
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${loc.btn_join}</button>`;
}

function joinLobby(lobbyId, isSpectator = false) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId, isSpectator }));
}

$('#btn-create-lobby').on('click', function() {
    playSound('click');
    const loadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        loadouts.push($(this).val());
    });

    const settings = {
        name: $('#lobby-name').val() || 'CUSTOM LOBBY',
        mapId: $('#map-select').val(),
        mode: $('#mode-select').val(),
        loadout: loadouts,
        roundTime: parseInt($('#round-time').val()),
        maxPlayers: parseInt($('#max-players').val()),
        vehiclesAllowed: $('#vehicles-allowed').is(':checked'),
        friendlyFire: $('#friendly-fire').is(':checked'),
        respawnTime: parseInt($('#respawn-time').val()),
        killLimit: parseInt($('#kill-limit').val())
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#lobby-title-display').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);
    $('#btn-start-game').toggle(asHost);
    $('#team-selection-area').toggle(lobby.mode === 'tdm');

    $('#lobby-info-summary').html(`
        <div class="summary-item"><span class="summary-label">MAP</span><span class="summary-value">${lobby.mapLabel}</span></div>
        <div class="summary-item"><span class="summary-label">MODE</span><span class="summary-value">${lobby.mode.toUpperCase()}</span></div>
        <div class="summary-item"><span class="summary-label">TIME</span><span class="summary-value">${lobby.roundTime} MIN</span></div>
        <div class="summary-item"><span class="summary-label">KILLS</span><span class="summary-value">${lobby.killLimit > 0 ? lobby.killLimit : '∞'}</span></div>
    `);
}

function renderPlayerList(players) {
    const list = $('#player-list');
    list.empty();
    players.forEach(p => {
        const item = $(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <div class="player-info">
                    <span class="player-name">${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
                    <span class="player-team-tag">${p.team}</span>
                </div>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
            </div>
        `);
        list.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
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

$('#chat-input').on('keypress', function(e) {
    if (e.which === 13) {
        const msg = $(this).val();
        if (msg.trim().length > 0) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
            $(this).val('');
        }
    }
});

function addChatMessage(name, message) {
    const chat = $('#chat-messages');
    chat.append(`<div class="chat-msg"><span class="chat-sender">${name}:</span> ${message}</div>`);
    chat.scrollTop(chat[0].scrollHeight);
}

function updateHUD(data) {
    if (data.time) $('#hud-time').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);

    if (data.mode === 'tdm') {
        $('#hud-tdm-scores').show();
        if (data.scoreBlue !== undefined) $('#score-blue').text(data.scoreBlue);
        if (data.scoreRed !== undefined) $('#score-red').text(data.scoreRed);
    } else {
        $('#hud-tdm-scores').hide();
    }
}

function updateHUDDetails(data) {
    $('#hud-health').css('width', data.health + '%');
    $('#hud-armor').css('width', data.armor + '%');
    $('#hud-ammo').text(data.ammo);
}

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-name').text(data.winnerName.toUpperCase());

    const table = $('#match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    table.html(html);

    $('#winner-screen').fadeIn(300);
}

function voteMap(mapId) {
    playSound('click');
    $('.map-vote-item').removeClass('active');
    $(`#vote-${mapId}`).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
}

function showCountdown(seconds) {
    // Optional: Visual countdown on screen
}

$('#btn-back-to-menu').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
});

$('#btn-back-to-lobby').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $('#lobby-waiting-area').fadeIn(300);
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
});

$(document).on('keyup', function(e) {
    if (e.which === 27) { // ESC
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Auto-Refresh Lobbies
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);

// Filters Change
$('#filter-maps, #filter-players').on('change', fetchLobbies);
