let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];
let myPlayerId = null;
let currentLobby = null;
let isHost = false;

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

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(300).css('display', 'flex');
            setupInitialData(data.config, data.maps);
            setLocales(data.config.Locales[data.config.Locale]);
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
            currentLobby = data.lobby;
            isHost = (data.action === 'lobbyCreated');
            showLobbyArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayerList(data.players);
            break;
        case 'gameStarting':
            $('#main-menu').hide();
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(500);
            $('#hud-team-scores').toggle(data.mode === 'tdm');
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(500);
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            $('#hud-health-fill').css('width', data.health + '%');
            $('#hud-armor-fill').css('width', data.armor + '%');
            $('#hud-ammo').text(data.ammo);
            break;
        case 'countdown':
            if (data.seconds > 0) {
                $('#countdown-display').show();
                $('#countdown-number').text(data.seconds);
            } else {
                $('#countdown-display').fadeOut(300);
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'updateStats':
            $('#stat-kills').text(data.kills);
            $('#stat-deaths').text(data.deaths);
            $('#stat-kd').text(data.kd);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Map Selects
    const mapOptions = maps.map(m => `<option value="${m.id}">${m.label.toUpperCase()}</option>`).join('');
    $('#create-map-select').html(mapOptions);
    $('#filter-maps').html(`<option value="all">${config.Locales[config.Locale]['all_weapons'] || 'ALLE'}</option>` + mapOptions);

    // Loadout Multi-Select (Checkboxes)
    let loadoutHtml = '';
    for (let key in config.WeaponLoadouts) {
        loadoutHtml += `
            <label class="loadout-item">
                <input type="checkbox" name="loadout" value="${key}">
                ${config.WeaponLoadouts[key].label}
            </label>
        `;
    }
    $('#loadout-checkboxes').html(loadoutHtml);
}

function setLocales(loc) {
    $('[id^="locale-"]').each(function() {
        const key = $(this).attr('id').replace('locale-', '');
        if (loc[key]) $(this).text(loc[key]);
    });
}

// Tab Switching
$('.tab-btn').on('click', function() {
    const tab = $(this).data('tab');
    if (tab === currentTab) return;

    playSound('click');
    $('.tab-btn').removeClass('active');
    $(this).addClass('active');

    $('.tab-content').removeClass('active');
    if (tab === 'ffa' || tab === 'list') {
        $('#tab-lobbies').addClass('active');
        currentTab = tab;
        fetchLobbies();
    } else {
        $('#tab-create').addClass('active');
        currentTab = tab;
    }
});

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    if (!lobbies) return;

    lobbies.forEach((lobby, index) => {
        const item = $(`
            <div class="lobby-item" style="animation-delay: ${index * 0.05}s">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE FOR ALL'}</div>
                    <div class="map-name-row"><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} | Host: ${lobby.hostName}</div>
                </div>
                <div class="player-count-badge">${lobby.playerCount} / ${lobby.maxPlayers}</div>
                <div class="action-area">
                    ${renderActionButton(lobby)}
                </div>
            </div>
        `);
        container.append(item);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) return `<button class="action-btn btn-full" disabled>FULL</button>`;
    if (lobby.status === 'ACTIVE') return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}')">SPECTATE</button>`;
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">JOIN</button>`;
}

window.joinLobby = function(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId: id }));
};

// Create Lobby Logic
$('#create-round-time').on('input', function() { $('#round-time-val').text($(this).val()); });
$('#create-max-players').on('input', function() { $('#max-players-val').text($(this).val()); });
$('#create-respawn-time').on('input', function() { $('#respawn-time-val').text($(this).val()); });
$('#create-kill-limit').on('input', function() { $('#kill-limit-val').text($(this).val() == 0 ? 'AUS' : $(this).val()); });

$('#btn-create-lobby-final').on('click', function() {
    playSound('click');
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() { selectedLoadouts.push($(this).val()); });

    const settings = {
        name: $('#create-lobby-name').val() || 'CUSTOM LOBBY',
        mapId: $('#create-map-select').val(),
        mode: $('#create-mode-select').val(),
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : ['pistol'],
        roundTime: parseInt($('#create-round-time').val()),
        maxPlayers: parseInt($('#create-max-players').val()),
        vehiclesAllowed: $('#create-vehicles').is(':checked'),
        friendlyFire: $('#create-ff').is(':checked'),
        respawnTime: parseInt($('#create-respawn-time').val()),
        killLimit: parseInt($('#create-kill-limit').val())
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

// Lobby Area
function showLobbyArea(lobby) {
    $('#lobby-title-display').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);
    $('#btn-start-game').toggle(isHost);

    $('#lobby-info-summary').html(`
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode === 'tdm' ? 'TEAM DEATHMATCH' : 'FREE FOR ALL'}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
    `);

    $('#team-selection-box').toggle(lobby.mode === 'tdm');
    playSound('join');
}

function renderPlayerList(players) {
    const container = $('#player-list');
    container.empty();
    players.forEach(p => {
        const item = $(`
            <div class="player-item ${p.ready ? 'ready' : ''} ${p.team}">
                <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color:gold;margin-left:5px"></i>' : ''}</span>
                <div style="display:flex; gap: 10px; align-items:center;">
                    <span style="font-size:10px; opacity:0.6">${p.team.toUpperCase()}</span>
                    ${isHost && !p.isHost ? `<i class="fa-solid fa-xmark kick-btn" onclick="kickPlayer('${p.id}')" style="color:var(--danger); cursor:pointer;"></i>` : ''}
                </div>
            </div>
        `);
        container.append(item);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
    }
}

window.kickPlayer = function(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id: id }));
};

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
$('#chat-input').on('keypress', function(e) {
    if (e.key === 'Enter') {
        const msg = $(this).val();
        if (msg.trim().length > 0) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
            $(this).val('');
        }
    }
});

window.addEventListener('message', (e) => {
    if (e.data.action === 'addChatMessage') {
        $('#chat-messages').append(`<div class="chat-msg"><span class="name">${e.data.name}:</span> ${e.data.message}</div>`);
        $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
    }
});

// HUD
function updateHUD(data) {
    if (data.time) $('#hud-timer').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
    if (data.scoreBlue !== undefined) $('#score-blue').text(data.scoreBlue);
    if (data.scoreRed !== undefined) $('#score-red').text(data.scoreRed);
}

// Winner Screen
function showWinnerScreen(data) {
    playSound('win');
    $('#winner-name-display').text(data.winnerName);
    $('#stats-body').empty();
    data.stats.forEach(s => {
        $('#stats-body').append(`
            <tr>
                <td>${s.name}</td>
                <td>${s.kills}</td>
                <td>${s.deaths}</td>
                <td>${s.kd}</td>
            </tr>
        `);
    });

    // Map Voting
    $('#vote-grid').empty();
    serverMaps.forEach(map => {
        $('#vote-grid').append(`<button class="action-btn btn-spectate" onclick="voteMap('${map.id}')" style="min-width:auto; font-size:10px;">${map.label}</button>`);
    });

    $('#winner-screen').fadeIn(500).css('display', 'flex');
}

window.voteMap = function(mapId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
};

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

// Close UI on Escape
$(document).on('keyup', function(e) {
    if (e.key === "Escape") {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

// Auto-Refresh
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
