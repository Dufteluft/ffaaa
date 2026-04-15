let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let serverConfig = {};
let serverMaps = [];

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

// NUI Message Listener
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
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            $('#app').hide();
            $('#lobby-waiting-area').hide();
            break;
        case 'showHUD':
            $('#game-hud').fadeIn(500);
            $('#hud-tdm-scores').toggle(data.isPersistent === false); // Persistent is usually FFA
            break;
        case 'hideHUD':
            $('#game-hud').fadeOut(500);
            break;
        case 'updateHUD':
            updateHUD(data);
            break;
        case 'updateHUDDetails':
            $('#hud-health-bar').css('width', data.health + '%');
            $('#hud-armor-bar').css('width', data.armor + '%');
            $('#hud-ammo').text(data.ammo);
            break;
        case 'countdown':
            if (data.seconds > 0) {
                $('#hud-countdown').text(data.seconds).show();
            } else {
                $('#hud-countdown').hide();
            }
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;
    const lang = config.Locales[config.Locale];

    // Apply translations
    $('[id^="loc-"]').each(function() {
        const key = this.id.replace('loc-', '');
        if (lang[key]) $(this).text(lang[key]);
    });

    // Populate Maps
    const $mapFilter = $('#filter-maps').empty().append('<option value="all">ALL MAPS</option>');
    const $mapSelect = $('#create-map-select').empty();

    maps.forEach(map => {
        $mapFilter.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
        $mapSelect.append(`<option value="${map.id}">${map.label.toUpperCase()}</option>`);
    });

    // Populate Loadouts
    const $loadoutGrid = $('#loadout-grid').empty();
    for (const key in config.WeaponLoadouts) {
        $loadoutGrid.append(`
            <label class="loadout-item">
                <input type="checkbox" name="loadout" value="${key}">
                <span>${config.WeaponLoadouts[key][0].label}</span>
            </label>
        `);
    }
}

function switchTab(tab) {
    currentTab = tab;
    $('.tab-btn').removeClass('active');
    $(`.tab-btn[data-tab="${tab}"]`).addClass('active');
    $('.tab-content').removeClass('active');

    if (tab === 'ffa' || tab === 'list') {
        $('#tab-browser').addClass('active');
        fetchLobbies();
    } else {
        $(`#tab-${tab}`).addClass('active');
    }
}

$('.tab-btn').on('click', function() {
    playSound('click');
    switchTab($(this).data('tab'));
});

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbyList(lobbies) {
    const $container = $('#lobby-list-container').empty();

    lobbies.forEach(lobby => {
        const item = `
            <div class="lobby-item">
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.name}</div>
                    <div class="map-name-row">${lobby.mapLabel} | ${lobby.mode.toUpperCase()}</div>
                </div>
                <div class="lobby-players">${lobby.playerCount}/${lobby.maxPlayers}</div>
                <div class="lobby-status">${lobby.status}</div>
                <button class="action-btn ${lobby.status === 'ACTIVE' ? 'btn-spectate' : 'btn-join'}"
                    onclick="joinLobby('${lobby.id}')">${lobby.status === 'ACTIVE' ? 'SPECTATE' : 'JOIN'}</button>
            </div>
        `;
        $container.append(item);
    });
}

function joinLobby(lobbyId) {
    playSound('click');
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
}

function createLobby() {
    playSound('click');
    const selectedLoadouts = [];
    $('input[name="loadout"]:checked').each(function() {
        selectedLoadouts.push($(this).val());
    });

    const settings = {
        name: $('#create-lobby-name').val() || 'Custom Lobby',
        mapId: $('#create-map-select').val(),
        mode: $('#create-mode-select').val(),
        loadout: selectedLoadouts.length > 0 ? selectedLoadouts : 'pistol',
        roundTime: parseInt($('#create-round-time').val()),
        maxPlayers: parseInt($('#create-max-players').val()),
        vehiclesAllowed: $('#create-vehicles').is(':checked'),
        friendlyFire: $('#create-friendly-fire').is(':checked'),
        respawnTime: parseInt($('#create-respawn-time').val()),
        killLimit: parseInt($('#create-kill-limit').val())
    };

    $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(settings));
}

function showLobbyArea(lobby, asHost) {
    currentLobby = lobby;
    isHost = asHost;
    playSound('join');

    $('#waiting-lobby-name').text(lobby.name);
    $('#lobby-info-summary').html(`
        <p>Map: ${lobby.mapLabel}</p>
        <p>Mode: ${lobby.mode.toUpperCase()}</p>
        <p>Kill Limit: ${lobby.killLimit}</p>
    `);

    $('#btn-start-game').toggle(asHost);
    $('#team-selection').toggle(lobby.mode === 'tdm');
    $('#lobby-waiting-area').fadeIn(300);
}

function renderPlayerList(players) {
    const $list = $('#player-list').empty();
    players.forEach(p => {
        $list.append(`
            <div class="player-item ${p.ready ? 'ready' : ''}">
                <span>${p.name} ${p.isHost ? '<i class="fa-solid fa-crown" style="color: gold;"></i>' : ''}</span>
                <span>${p.team !== 'none' ? p.team.toUpperCase() : ''}</span>
                ${isHost && !p.isHost ? `<button onclick="kickPlayer('${p.id}')">KICK</button>` : ''}
            </div>
        `);
    });
}

function updateHUD(data) {
    if (data.time) $('#hud-timer').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
    if (data.scoreBlue !== undefined) $('.score-blue').text(data.scoreBlue);
    if (data.scoreRed !== undefined) $('.score-red').text(data.scoreRed);
}

function showWinnerScreen(data) {
    playSound('win');
    $('#winner-announcement').html(`${data.winnerName} <span id="loc-winner-suffix">WINS!</span>`);

    let table = `<table><thead><tr><th>NAME</th><th>KILLS</th><th>DEATHS</th><th>K/D</th></tr></thead><tbody>`;
    data.stats.forEach(s => {
        table += `<tr><td>${s.name}</td><td>${s.kills}</td><td>${s.deaths}</td><td>${s.kd}</td></tr>`;
    });
    table += `</tbody></table>`;
    $('#match-stats-table').html(table);

    const $voting = $('#map-voting-container').empty();
    if (serverMaps && serverMaps.length > 0) {
        serverMaps.slice(0, 3).forEach(map => {
            $voting.append(`<button class="map-vote-btn" onclick="voteMap('${map.id}')">${map.label}</button>`);
        });
    }

    $('#winner-screen').fadeIn(500);
}

function voteMap(mapId) {
    playSound('click');
    $('.map-vote-btn').removeClass('voted');
    $(`.map-vote-btn[onclick="voteMap('${mapId}')"]`).addClass('voted');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId }));
}

// Event handlers
$('#btn-winner-back').on('click', function() {
    playSound('click');
    $('#winner-screen').fadeOut(300);
    if (currentLobby && currentLobby.isPersistent) {
        // Stay in game
    } else {
        $.post(`https://${GetParentResourceName()}/leaveLobby`);
    }
});

// Slider values sync
$('input[type="range"]').on('input', function() {
    $(`#val-${this.id.replace('create-', '')}`).text(this.value);
});

// ESC key to close
$(document).on('keyup', function(e) {
    if (e.key === "Escape") {
        $.post(`https://${GetParentResourceName()}/closeUI`);
    }
});

function toggleReady() { playSound('click'); $.post(`https://${GetParentResourceName()}/toggleReady`); }
function startGame() { playSound('click'); $.post(`https://${GetParentResourceName()}/startGame`); }
function leaveLobby() {
    playSound('click');
    $('#lobby-waiting-area').hide();
    $.post(`https://${GetParentResourceName()}/leaveLobby`);
}
function kickPlayer(id) { $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id })); }
function addChatMessage(name, msg) {
    $('#chat-messages').append(`<div><strong>${name}:</strong> ${msg}</div>`);
    $('#chat-messages').scrollTop($('#chat-messages')[0].scrollHeight);
}

$('.team-btn').on('click', function() {
    const team = $(this).data('team');
    $('.team-btn').removeClass('active');
    $(this).addClass('active');
    $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team }));
});

$('#chat-input').on('keypress', function(e) {
    if (e.which === 13 && $(this).val().trim() !== "") {
        $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: $(this).val() }));
        $(this).val('');
    }
});
