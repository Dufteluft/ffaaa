let currentLobby = null;
let isHost = false;
let myPlayerId = null;
let currentTab = 'ffa';
let serverMaps = [];
let serverConfig = {};
let activeVotes = {};

// UI Initialisierung
$(document).ready(function() {
    // Tab Switching
    $('.tab-btn').click(function() {
        const tab = $(this).data('tab');
        if (tab === currentTab) return;

        $('.tab-btn').removeClass('active');
        $(this).addClass('active');

        $('.tab-content').removeClass('active');
        currentTab = tab;

        if (tab === 'create') {
            $('#create-lobby-view').addClass('active');
        } else {
            $('#lobby-list-view').addClass('active');
            // FFA Tab zeigt persistente Lobbys, List Tab zeigt Custom Lobbys
            fetchLobbies();
        }
    });

    // Slider Values
    $('#create-time').on('input', function() { $('#val-time').text($(this).val()); });
    $('#create-maxplayers').on('input', function() { $('#val-players').text($(this).val()); });
    $('#create-respawn').on('input', function() { $('#val-respawn').text($(this).val()); });
    $('#create-killlimit').on('input', function() { $('#val-kills').text($(this).val() == 0 ? 'AUS' : $(this).val()); });

    // Create Lobby Button
    $('#btn-submit-create').click(function() {
        const loadouts = [];
        $('#create-loadouts input:checked').each(function() {
            loadouts.push($(this).val());
        });

        const data = {
            name: $('#create-name').val() || 'FFA LOBBY',
            mapId: $('#create-map').val(),
            mode: $('#create-mode').val(),
            loadouts: loadouts,
            roundTime: parseInt($('#create-time').val()),
            maxPlayers: parseInt($('#create-maxplayers').val()),
            vehiclesAllowed: $('#create-vehicles').is(':checked'),
            friendlyFire: $('#create-ff').is(':checked'),
            respawnTime: parseInt($('#create-respawn').val()),
            killLimit: parseInt($('#create-killlimit').val())
        };

        if (loadouts.length === 0) {
            // Falls nichts gewählt, Standard 'all'
            data.loadouts = ['all'];
        }

        $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(data));
    });

    $('#btn-cancel-create').click(function() {
        $('.tab-btn[data-tab="ffa"]').click();
    });

    // Lobby Actions
    $('#btn-ready').click(function() {
        $.post(`https://${GetParentResourceName()}/toggleReady`, JSON.stringify({}));
    });

    $('#btn-start').click(function() {
        $.post(`https://${GetParentResourceName()}/startGame`, JSON.stringify({}));
    });

    $('#btn-leave').click(function() {
        $('#lobby-waiting-area').fadeOut(200);
        $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
    });

    $('#btn-close-lobby').click(function() {
        $.post(`https://${GetParentResourceName()}/closeLobby`, JSON.stringify({}));
    });

    $('.team-btn').click(function() {
        const team = $(this).data('team');
        $('.team-btn').removeClass('active');
        $(this).addClass('active');
        $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: team }));
    });

    $('#chat-input').keypress(function(e) {
        if (e.which == 13) {
            const msg = $(this).val();
            if (msg.trim().length > 0) {
                $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
                $(this).val('');
            }
        }
    });

    $('#btn-exit-to-menu').click(function() {
        $('#winner-screen').fadeOut(200);
        $.post(`https://${GetParentResourceName()}/leaveLobby`, JSON.stringify({}));
    });

    $('#filter-maps, #filter-players').change(function() {
        fetchLobbies();
    });
});

// NUI Listener
window.addEventListener('message', function(event) {
    const data = event.data;

    switch(data.action) {
        case 'open':
            $('#app').fadeIn(300).css('display', 'flex');
            setupInitialData(data.config, data.maps);
            if (data.isInGame) {
                // Wenn im Spiel, nichts tun oder spezielles Menü?
            } else {
                fetchLobbies();
            }
            break;
        case 'close':
            $('#app').fadeOut(200);
            break;
        case 'updateLobbies':
            renderLobbyList(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            $('#lobby-waiting-area').fadeIn(300).css('display', 'flex');
            setupWaitingArea(data.lobby);
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
            $('#hud-tdm-score').toggle(data.mode === 'tdm');
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
        case 'countdown':
            handleCountdown(data.seconds);
            break;
        case 'showWinner':
            showWinnerScreen(data);
            break;
        case 'syncVotes':
            updateVotes(data.votes);
            break;
    }
});

function setupInitialData(config, maps) {
    serverConfig = config;
    serverMaps = maps;

    // Lokalisierung anwenden
    if (config.Locales && config.Locale) {
        const lang = config.Locales[config.Locale];
        for (let key in lang) {
            $(`#loc-${key.replace(/_/g, '-')}`).text(lang[key]);
            $(`#loc-${key.replace(/_/g, '-')}-2`).text(lang[key]); // Dubletten für HUD etc.
        }
    }

    // Maps in Dropdowns
    $('#filter-maps, #create-map').empty();
    $('#filter-maps').append('<option value="all">ALLE MAPS</option>');
    maps.forEach(map => {
        const html = `<option value="${map.id}">${map.label.toUpperCase()}</option>`;
        $('#filter-maps').append(html);
        $('#create-map').append(html);
    });

    // Loadouts Multi-Select
    $('#create-loadouts').empty();
    for (let key in config.WeaponLoadouts) {
        const loadout = config.WeaponLoadouts[key];
        const html = `
            <label class="loadout-checkbox">
                <input type="checkbox" value="${key}" ${key === 'all' ? 'checked' : ''}>
                ${loadout.label}
            </label>
        `;
        $('#create-loadouts').append(html);
    }
}

function fetchLobbies() {
    const filters = {
        tab: currentTab,
        map: $('#filter-maps').val(),
        freeOnly: $('#filter-players').val() === 'free'
    };
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify(filters));
}

function renderLobbyList(lobbies) {
    const container = $('#lobby-list-container');
    container.empty();

    if (lobbies.length === 0) {
        container.append('<p style="text-align:center; color: #666; margin-top: 50px;">KEINE LOBBYS GEFUNDEN</p>');
        return;
    }

    lobbies.forEach(lobby => {
        const isFull = lobby.playerCount >= lobby.maxPlayers;
        const statusClass = lobby.status === 'ACTIVE' ? 'status-active' : 'status-waiting';
        const btnText = lobby.status === 'ACTIVE' ? 'ZUSCHAUEN' : 'BEITRETEN';

        const html = `
            <div class="lobby-item">
                <div class="lobby-map-preview">
                    <img src="assets/${lobby.mapId}.png" onerror="this.src='https://via.placeholder.com/120x70/222/fff?text=${lobby.mapLabel}'">
                </div>
                <div class="lobby-info-main">
                    <div class="match-type">${lobby.name}</div>
                    <div class="map-name-row">
                        <i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel} • ${lobby.mode.toUpperCase()}
                    </div>
                </div>
                <div class="player-count-badge">${lobby.playerCount} / ${lobby.maxPlayers}</div>
                <div class="status-badge ${statusClass}">${lobby.status}</div>
                <button class="btn-join" ${isFull ? 'disabled' : ''} onclick="joinLobby('${lobby.id}')">
                    ${isFull ? 'VOLL' : btnText}
                </button>
            </div>
        `;
        container.append(html);
    });
}

function joinLobby(id) {
    if (currentTab === 'ffa') {
        $.post(`https://${GetParentResourceName()}/quickJoin`, JSON.stringify({ lobbyId: id }));
    } else {
        $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId: id }));
    }
}

function setupWaitingArea(lobby) {
    currentLobby = lobby;
    $('#waiting-lobby-name').text(lobby.name.toUpperCase());
    $('#waiting-lobby-id').text(lobby.id);

    $('#waiting-info-summary').html(`
        <p>MAP: ${lobby.mapLabel}</p>
        <p>MODUS: ${lobby.mode.toUpperCase()}</p>
        <p>ZEIT: ${lobby.roundTime} MIN</p>
        <p>LIMIT: ${lobby.killLimit == 0 ? 'KEINS' : lobby.killLimit}</p>
    `);

    $('#team-selector-box').toggle(lobby.mode === 'tdm');
    $('#btn-start, #btn-close-lobby').hide();
    $('#chat-messages').empty();
}

function renderPlayerList(players) {
    const container = $('#waiting-player-list');
    container.empty();

    let amIHost = false;

    players.forEach(p => {
        if (p.isMe) {
            myPlayerId = p.id;
            if (p.isHost) amIHost = true;
        }

        const readyClass = p.ready ? 'ready' : '';
        const hostClass = p.isHost ? 'host' : '';
        const teamInfo = p.team !== 'none' ? ` • ${p.team.toUpperCase()}` : '';

        const html = `
            <div class="player-item ${readyClass} ${hostClass}">
                <div class="p-main">
                    <strong>${p.name.toUpperCase()}</strong>
                    <span style="font-size: 10px; opacity: 0.7;">${p.isHost ? '(HOST)' : ''}${teamInfo}</span>
                </div>
                ${amIHost && !p.isMe ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-user-minus"></i></button>` : ''}
            </div>
        `;
        container.append(html);
    });

    if (amIHost) {
        $('#btn-start, #btn-close-lobby').show();
        const canStart = players.length >= 1; // Für Test auf 1, real auf 2
        $('#btn-start').prop('disabled', !canStart);
    }
}

function kickPlayer(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id: id }));
}

function addChatMessage(name, msg) {
    const container = $('#chat-messages');
    container.append(`<div class="chat-msg"><span class="name">${name}:</span> ${msg}</div>`);
    container.scrollTop(container[0].scrollHeight);
}

function updateHUD(data) {
    if (data.time) $('#hud-timer').text(data.time);
    if (data.kills !== undefined) $('#hud-kills').text(data.kills);
    if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);

    if (data.scoreBlue !== undefined) $('.score-blue').text(data.scoreBlue);
    if (data.scoreRed !== undefined) $('.score-red').text(data.scoreRed);
}

function updateHUDDetails(data) {
    if (data.health !== undefined) $('#hud-health-bar').css('width', data.health + '%');
    if (data.armor !== undefined) $('#hud-armor-bar').css('width', data.armor + '%');
    if (data.ammo !== undefined) $('#hud-ammo').text(data.ammo);
}

function handleCountdown(seconds) {
    if (seconds > 0) {
        $('#countdown-display').text(seconds).show();
    } else {
        $('#countdown-display').fadeOut(500);
    }
}

function showWinnerScreen(data) {
    $('#winner-screen').fadeIn(400).css('display', 'flex');
    $('#winner-announcement').html(`${data.winnerName.toUpperCase()} <span id="loc-winner-suffix">${serverConfig.Locales[serverConfig.Locale].winner_suffix}</span>`);

    const tbody = $('#match-stats-table tbody');
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
    const voteGrid = $('#map-voting-grid');
    voteGrid.empty();
    serverMaps.forEach(map => {
        voteGrid.append(`
            <div class="vote-item" onclick="voteMap('${map.id}')" id="vote-${map.id}">
                ${map.label.toUpperCase()}
                <span class="vote-count" id="vcount-${map.id}">0</span>
            </div>
        `);
    });
}

function voteMap(mapId) {
    $('.vote-item').removeClass('active');
    $(`#vote-${mapId}`).addClass('active');
    $.post(`https://${GetParentResourceName()}/voteMap`, JSON.stringify({ mapId: mapId }));
}

function updateVotes(votes) {
    $('.vote-count').text('0');
    for (let mapId in votes) {
        $(`#vcount-${mapId}`).text(votes[mapId]);
    }
}

// Global für Buttons in dynamischem HTML
window.joinLobby = joinLobby;
window.kickPlayer = kickPlayer;

// Close on Escape
window.addEventListener('keyup', function(e) {
    if (e.key === 'Escape') {
        $.post(`https://${GetParentResourceName()}/closeUI`, JSON.stringify({}));
    }
});
