let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let selectedMapVote = null;

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

    if (tab === 'create') {
        $('#lobby-browser-section').hide();
        $('#create-lobby-section').show();
    } else {
        $('#create-lobby-section').hide();
        $('#lobby-browser-section').show();
        $('#filters-container').toggle(tab === 'list');
        fetchLobbies();
    }
});

// Slider Value Sync
function setupSlider(id) {
    $(`#${id}`).on('input', function() {
        $(`#${id}-val`).text($(this).val());
    });
}
setupSlider('round-time');
setupSlider('max-players');
setupSlider('respawn-time');
setupSlider('kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').show();
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
        case 'gameStarting':
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').show();
            $('#hud-scores').toggle(data.mode === 'tdm');
            break;
        case 'hideHUD':
            $('#game-hud').hide();
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            $('#hud-health').css('width', data.health + '%');
            $('#hud-armor').css('width', data.armor + '%');
            $('#hud-ammo').text(data.ammo);
            break;
        case 'countdown':
            if (data.seconds > 0) {
                $('#countdown-display').text(data.seconds).show();
            } else {
                $('#countdown-display').hide();
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'startMapVote':
            showMapVoting(data.maps);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setLocales(loc) {
    if (!loc) return;
    $('#loc-menu-title').text(loc.menu_title);
    $('#loc-tab-ffa').text(loc.tab_ffa);
    $('#loc-tab-create').text(loc.tab_create);
    $('#loc-tab-list').text(loc.tab_list);
    $('#loc-lobby-name').text(loc.lobby_name);
    $('#loc-map-select, #loc-map-select-create').text(loc.map_select);
    $('#loc-mode-select').text(loc.mode_select);
    $('#loc-loadout-select').text(loc.loadout_select);
    $('#loc-round-time').html(`${loc.round_time}: <span id="round-time-val">15</span>`);
    $('#loc-max-players, #loc-max-players-create').html(`${loc.max_players}: <span id="max-players-val">16</span>`);
    $('#loc-vehicles-allowed').text(loc.vehicles_allowed);
    $('#loc-friendly-fire').text(loc.friendly_fire);
    $('#loc-respawn-time').html(`${loc.respawn_time}: <span id="respawn-time-val">5</span>`);
    $('#loc-kill-limit').html(`${loc.kill_limit}: <span id="kill-limit-val">30</span>`);
    $('#btn-create-lobby-action').text(loc.btn_create);
    $('#btn-cancel-create').text(loc.btn_cancel);
    $('#loc-players').text(loc.players || "PLAYERS");
    $('#loc-settings').text(loc.settings || "SETTINGS");
    $('#btn-ready-toggle').text(loc.btn_ready);
    $('#btn-start-game').text(loc.btn_start);
    $('#btn-leave-lobby').text(loc.btn_leave);
    $('#loc-hud-kills').text(loc.kills);
    $('#loc-hud-deaths').text(loc.deaths);
    $('#loc-game-ended').text(loc.game_ended);
    $('#loc-vote-map').text(loc.vote_map || "VOTE FOR NEXT MAP");
}

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    const mapSelect = $('#map-select');
    const filterMaps = $('#filter-maps');
    mapSelect.empty();
    filterMaps.html('<option value="all">ALL MAPS</option>');

    maps.forEach(map => {
        mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
        filterMaps.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    const loadoutGrid = $('#loadout-checkboxes');
    loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        loadoutGrid.append(`
            <label class="loadout-item">
                <input type="checkbox" name="loadout" value="${key}">
                <span>${config.WeaponLoadouts[key][0].label || key.toUpperCase()}</span>
            </label>
        `);
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({
        tab: currentTab,
        filters: {
            map: $('#filter-maps').val(),
            players: $('#filter-players').val()
        }
    }));
}

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    lobbies.forEach(lobby => {
        container.append(`
            <div class="lobby-item">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? 'Team Deathmatch' : 'Free-for-All'}</div>
                    <div class="map-name-row">${lobby.mapLabel}</div>
                    <div class="host-name">HOST: ${lobby.hostName}</div>
                </div>
                <div class="player-count-text">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <div class="status-badge ${lobby.status === 'ACTIVE' ? 'status-active' : ''}">${lobby.status}</div>
                <div class="action-area">
                    <button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">${lobby.playerCount >= lobby.maxPlayers ? 'FULL' : 'JOIN'}</button>
                </div>
            </div>
        `);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
}

$('#btn-create-lobby-action').on('click', function() {
    playSound('click');
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    const settings = {
        name: $('#lobby-name').val() || 'CUSTOM LOBBY',
        mapId: $('#map-select').val(),
        mode: $('#mode-select').val(),
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['all'],
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

    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').show();
    $('#btn-start-game').toggle(asHost);
    $('#team-selection-area').toggle(lobby.mode === 'tdm');

    $('#lobby-info-summary').html(`
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
        <p>LIMIT: ${lobby.killLimit > 0 ? lobby.killLimit : 'NONE'}</p>
    `);
}

function renderPlayerList(players) {
    const list = $('#player-list');
    list.empty();
    players.forEach(p => {
        list.append(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
                <span>${p.team.toUpperCase()}</span>
                ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')">X</button>` : ''}
            </div>
        `);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
    }
}

function updateHUD(data) {
    if (data.time) $('#hud-timer').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
    if (data.scoreBlue !== undefined) $('.blue-score').text(data.scoreBlue);
    if (data.scoreRed !== undefined) $('.red-score').text(data.scoreRed);
}

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-screen').show();
    $('#winner-name').text(data.winnerName.toUpperCase() + " " + (serverConfig.Locales[serverConfig.Locale].winner_suffix || "WINS!"));

    const statsTable = $('#match-stats-table');
    let html = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        html += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    html += `</tbody></table>`;
    statsTable.html(html);
}

function showMapVoting(maps) {
    $('#map-voting').show();
    const container = $('#map-voting-container');
    container.empty();
    selectedMapVote = null;

    maps.forEach(map => {
        container.append(`
            <div class="vote-item" data-id="${map.id}">
                <h3>${map.label.toUpperCase()}</h3>
            </div>
        `);
    });

    $('.vote-item').on('click', function() {
        $('.vote-item').removeClass('selected');
        $(this).addClass('selected');
        selectedMapVote = $(this).data('id');
        $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId: selectedMapVote }));
    });

    let timeLeft = 10;
    const interval = setInterval(() => {
        timeLeft--;
        $('#voting-timer').text(timeLeft + 's');
        if (timeLeft <= 0) {
            clearInterval(interval);
            $('#map-voting').hide();
        }
    }, 1000);
}

function addChatMessage(name, message) {
    const chat = $('#chat-messages');
    chat.append(`<div><strong>${name}:</strong> ${message}</div>`);
    chat.scrollTop(chat[0].scrollHeight);
}

$('#chat-input').on('keypress', function(e) {
    if (e.which === 13) {
        const msg = $(this).val();
        if (msg.trim()) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
            $(this).val('');
        }
    }
});

$('#btn-ready-toggle').on('click', () => $.post(`https://${GetParentResourceName()}/toggleReady`));
$('#btn-start-game').on('click', () => { playSound('start'); $.post(`https://${GetParentResourceName()}/startGame`); });
$('#btn-leave-lobby').on('click', () => { $('#lobby-waiting-area').hide(); $.post(`https://${GetParentResourceName()}/leaveLobby`); });
$('.team-btn').on('click', function() {
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
});

$('#btn-back-to-menu').on('click', () => { $('#winner-screen').hide(); $.post(`https://${GetParentResourceName()}/leaveLobby`); });
$('#btn-back-to-lobby').on('click', () => { $('#winner-screen').hide(); $('#lobby-waiting-area').show(); $.post(`https://${GetParentResourceName()}/closeWinnerScreen`); });

window.addEventListener('keyup', (e) => {
    if (e.key === 'Escape') $.post(`https://${GetParentResourceName()}/closeUI`);
});

setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
