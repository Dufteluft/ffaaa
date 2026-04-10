let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};

// UI Locales (will be filled from config)
let locales = {};

// Audio (Standard FiveM paths or relative to html/)
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

    $('.tab-content').removeClass('active');
    $(`#tab-${tab}`).addClass('active');

    currentTab = tab;
    if (tab !== 'create') {
        fetchLobbies();
    }
});

// Slider Value Updates
const setupSlider = (id, valId) => {
    $(`#${id}`).on('input', function() {
        $(`#${valId}`).text($(this).val());
    });
};
setupSlider('create-round-time', 'val-round-time');
setupSlider('create-max-players', 'val-max-players');
setupSlider('create-respawn-time', 'val-respawn-time');
setupSlider('create-kill-limit', 'val-kill-limit');

// NUI Message Handling
window.addEventListener('message', (event) => {
    const data = event.data;

    switch (data.action) {
        case 'open':
            $('#app').fadeIn(300);
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
            $('#game-hud').fadeIn(500);
            if (data.isPersistent) {
                $('.timer-box').hide();
            } else {
                $('.timer-box').show();
            }
            break;
        case 'hideHUD':
            $('#game-hud').hide();
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
            // Logic for visual countdown if needed
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    locales = config.Locales[config.Locale];

    // Setup Localized Labels
    for (let key in locales) {
        const el = document.getElementById(`loc-${key.replace(/_/g, '-')}`);
        if (el) el.innerText = locales[key];
    }

    // Populate Map Select
    const $mapSelect = $('#create-map, #filter-maps');
    $mapSelect.find('option:not([value="all"])').remove();
    maps.forEach(map => {
        $mapSelect.append(`<option value="${map.id}">${map.label}</option>`);
    });

    // Populate Loadout Multi-select
    const $loadoutGrid = $('#loadout-grid');
    $loadoutGrid.empty();
    for (let key in config.WeaponLoadouts) {
        $loadoutGrid.append(`
            <div class="loadout-item">
                <input type="checkbox" name="loadout" value="${key}" id="ld-${key}">
                <label for="ld-${key}">${key.toUpperCase()}</label>
            </div>
        `);
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const containerId = currentTab === 'ffa' ? '#ffa-list-container' : '#open-list-container';
    const $container = $(containerId);
    $container.empty();

    lobbies.forEach((lobby, index) => {
        const statusClass = lobby.status === 'ACTIVE' ? 'status-active' : 'status-waiting';
        const actionBtn = renderActionButton(lobby);

        $container.append(`
            <div class="lobby-item" style="animation-delay: ${index * 0.05}s">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.mode.toUpperCase()} - ${lobby.name}</div>
                    <div class="map-name-row">
                        <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} |
                        <i class="fa-solid fa-user-group"></i> ${lobby.playerCount}/${lobby.maxPlayers} |
                        <i class="fa-solid fa-crown"></i> ${lobby.hostName}
                    </div>
                </div>
                <div class="status-badge ${statusClass}">${lobby.status}</div>
                <div class="action-area">${actionBtn}</div>
            </div>
        `);
    });
}

function renderActionButton(lobby) {
    if (lobby.playerCount >= lobby.maxPlayers) {
        return `<button class="action-btn btn-disabled" disabled>FULL</button>`;
    }
    if (lobby.status === 'ACTIVE') {
        return `<button class="action-btn btn-spectate" onclick="joinLobby('${lobby.id}')">SPECTATE</button>`;
    }
    return `<button class="action-btn btn-join" onclick="joinLobby('${lobby.id}')">JOIN</button>`;
}

window.joinLobby = function(lobbyId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
};

$('#btn-create-lobby-final').on('click', function() {
    playSound('click');

    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    if (selectedLoadouts.length === 0) {
        // Fallback to 'all' if none selected or show error
        selectedLoadouts.push('all');
    }

    const settings = {
        name: $('#create-name').val() || 'Custom Lobby',
        mapId: $('#create-map').val(),
        mode: $('#create-mode').val(),
        loadout: selectedLoadouts,
        roundTime: parseInt($('#create-round-time').val()),
        maxPlayers: parseInt($('#create-max-players').val()),
        respawnTime: parseInt($('#create-respawn-time').val()),
        killLimit: parseInt($('#create-kill-limit').val()),
        vehiclesAllowed: $('#create-vehicles').is(':checked'),
        friendlyFire: $('#create-friendly').is(':checked')
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
});

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#lobby-title').text(lobby.name.toUpperCase());
    $('#lobby-waiting-area').fadeIn(300);
    $('#btn-start-game').toggle(asHost);

    $('#lobby-info-summary').html(`
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODE: ${lobby.mode.toUpperCase()}</p>
        <p>TIME: ${lobby.roundTime} MIN</p>
        <p>KILL LIMIT: ${lobby.killLimit > 0 ? lobby.killLimit : 'NONE'}</p>
    `);
}

function renderPlayerList(players) {
    const $list = $('#player-list');
    $list.empty();

    players.forEach(p => {
        const readyClass = p.ready ? 'ready' : '';
        const kickBtn = (isHost && !p.isHost) ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : '';

        $list.append(`
            <div class="player-item ${readyClass}">
                <span>${p.name.toUpperCase()} ${p.isHost ? '(HOST)' : ''}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 10px; color: #aaa;">${p.team.toUpperCase()}</span>
                    ${kickBtn}
                </div>
            </div>
        `);
    });

    if (isHost) {
        $('#btn-start-game').prop('disabled', players.length < 2);
    }
}

window.kickPlayer = function(id) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
};

$('#btn-ready-toggle').on('click', function() {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/toggleReady`, JSON.stringify({}));
});

$('#btn-start-game').on('click', function() {
    playSound('start');
    $.post(`https://${GetParentResourceName()}/startGame`, JSON.stringify({}));
});

$('#btn-leave-lobby').on('click', function() {
    playSound('click');
    $('#lobby-waiting-area').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
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
        if (msg.trim()) {
            $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
            $(this).val('');
        }
    }
});

function addChatMessage(name, message) {
    const $container = $('#chat-messages');
    $container.append(`<div class="chat-msg"><span class="chat-name">${name}:</span> ${message}</div>`);
    $container.scrollTop($container[0].scrollHeight);
}

// HUD Functions
function updateHUD(data) {
    if (data.time) $('#hud-timer').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);

    if (data.mode === 'tdm') {
        $('#tdm-scores').show();
        if (data.scoreBlue !== undefined) $('.blue-score').text(data.scoreBlue);
        if (data.scoreRed !== undefined) $('.red-score').text(data.scoreRed);
    } else {
        $('#tdm-scores').hide();
    }
}

function updateHUDDetails(data) {
    if (data.health !== undefined) $('#hud-health-fill').css('width', `${data.health}%`);
    if (data.armor !== undefined) $('#hud-armor-fill').css('width', `${data.armor}%`);
    if (data.ammo !== undefined) $('#hud-ammo').text(data.ammo);
}

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-name').text(`${data.winnerName.toUpperCase()} ${locales['winner_suffix'] || 'WINS!'}`);

    let statsHtml = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        statsHtml += `<tr><td>${s.name.toUpperCase()}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    statsHtml += `</tbody></table>`;

    $('#match-stats-table').html(statsHtml);

    // Map Voting in Winner Screen
    const $voteGrid = $('#vote-grid');
    $voteGrid.empty();
    serverMaps.slice(0, 3).forEach(map => {
        $voteGrid.append(`<div class="vote-item" onclick="voteMap('${map.id}', this)">${map.label.toUpperCase()}</div>`);
    });

    $('#winner-screen').fadeIn(500);
}

window.voteMap = function(mapId, el) {
    playSound('click');
    $('.vote-item').removeClass('active');
    $(el).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
};

$('#btn-back-to-menu').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
});

$('#btn-back-to-lobby').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    $('#lobby-waiting-area').fadeIn(300);
    $.post(`https://${GetParentResourceName()}/closeWinnerScreen`, JSON.stringify({}));
});

// ESC to close
$(document).on('keyup', function(e) {
    if (e.which === 27) {
        $.post(`https://${GetParentResourceName()}/closeUI`, JSON.stringify({}));
    }
});

// Auto-Refresh
setInterval(() => {
    if ($('#app').is(':visible') && !$('#lobby-waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
