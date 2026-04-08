let Config = {};
let currentLobby = null;
let isHost = false;
let currentTab = 'ffa';
let activeFilters = { map: 'all', players: 'all' };

$(function() {
    // Tab Switching
    $('.tab-btn').click(function() {
        $('.tab-btn').removeClass('active');
        $(this).addClass('active');
        const tab = $(this).data('tab');
        currentTab = tab;

        $('.tab-content').removeClass('active');
        $(`#tab-${tab}-content`).addClass('active');

        if (tab === 'ffa' || tab === 'list') {
            fetchLobbies();
        }
    });

    // Slider Sync
    $('input[type="range"]').on('input', function() {
        const id = $(this).attr('id').replace('create-', '');
        $(`#val-${id}`).text($(this).val());
    });

    // Create Lobby Buttons
    $('#btn-create-submit').click(function() {
        const selectedLoadouts = [];
        $('.loadout-check:checked').each(function() {
            selectedLoadouts.push($(this).val());
        });

        const data = {
            name: $('#create-name').val() || 'Lobby',
            mapId: $('#create-map').val(),
            mode: $('#create-mode').val(),
            loadout: selectedLoadouts,
            roundTime: parseInt($('#create-time').val()),
            maxPlayers: parseInt($('#create-players').val()),
            respawnTime: parseInt($('#create-respawn').val()),
            killLimit: parseInt($('#create-kills').val()),
            vehiclesAllowed: $('#create-vehicles').is(':checked'),
            friendlyFire: $('#create-fire').is(':checked')
        };

        if (selectedLoadouts.length === 0) {
            // Default to 'all' if none selected
            data.loadout = ['all'];
        }

        $.post(`https://${GetParentResourceName()}/createLobby`, JSON.stringify(data));
    });

    $('#btn-create-cancel').click(function() {
        $('.tab-btn[data-tab="ffa"]').click();
    });

    // Filters
    $('#filter-map, #filter-players').change(function() {
        activeFilters.map = $('#filter-map').val();
        activeFilters.players = $('#filter-players').val();
        fetchLobbies();
    });

    // Lobby Actions
    $('#btn-ready').click(function() {
        $.post(`https://${GetParentResourceName()}/toggleReady`);
    });

    $('#btn-start').click(function() {
        $.post(`https://${GetParentResourceName()}/startGame`);
    });

    $('#btn-leave').click(function() {
        $('#waiting-area').fadeOut(300);
        $.post(`https://${GetParentResourceName()}/leaveLobby`);
    });

    // Chat
    $('#lobby-chat-input').keypress(function(e) {
        if (e.which == 13) {
            const msg = $(this).val();
            if (msg.trim() !== '') {
                $.post(`https://${GetParentResourceName()}/sendLobbyChat`, JSON.stringify({ message: msg }));
                $(this).val('');
            }
        }
    });

    // Team Selection
    $('.team-btn').click(function() {
        $('.team-btn').removeClass('active');
        $(this).addClass('active');
        $.post(`https://${GetParentResourceName()}/setTeam`, JSON.stringify({ team: $(this).data('team') }));
    });

    // Winner Actions
    $('#btn-win-lobby').click(function() {
        $('#winner-screen').fadeOut(300);
        $('#waiting-area').fadeIn(300);
        $.post(`https://${GetParentResourceName()}/closeWinnerScreen`);
    });

    $('#btn-win-menu').click(function() {
        $('#winner-screen').fadeOut(300);
        $.post(`https://${GetParentResourceName()}/leaveLobby`);
    });

    // Global Key Listener
    window.addEventListener('keyup', (e) => {
        if (e.key === 'Escape') {
            $.post(`https://${GetParentResourceName()}/closeUI`);
        }
    });
});

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
            renderLobbies(data.lobbies);
            break;
        case 'lobbyCreated':
        case 'lobbyJoined':
            currentLobby = data.lobby;
            isHost = (data.action === 'lobbyCreated');
            showWaitingArea(data.lobby);
            break;
        case 'updateLobbyPlayers':
            renderPlayers(data.players);
            break;
        case 'addChatMessage':
            addChatMessage(data.name, data.message);
            break;
        case 'gameStarting':
            $('#app').fadeOut(300);
            $('#waiting-area').fadeOut(300);
            break;
        case 'showHUD':
            $('#hud').fadeIn(300);
            if (data.isPersistent) {
                $('#hud-timer').hide();
            } else {
                $('#hud-timer').show();
            }
            break;
        case 'hideHUD':
            $('#hud').fadeOut(300);
            break;
        case 'updateHUD':
            if (data.time) $('#hud-timer').text(data.time);
            if (data.kills !== undefined) $('#hud-kills').text(data.kills);
            if (data.deaths !== undefined) $('#hud-deaths').text(data.deaths);
            if (data.mode === 'tdm') {
                $('#hud-team-scores').show();
                if (data.scoreBlue !== undefined) $('#score-blue').text(data.scoreBlue);
                if (data.scoreRed !== undefined) $('#score-red').text(data.scoreRed);
            } else {
                $('#hud-team-scores').hide();
            }
            break;
        case 'updateHUDDetails':
            $('#hud-health').css('width', data.health + '%');
            $('#hud-armor').css('width', data.armor + '%');
            $('#hud-ammo').text(data.ammo);
            break;
        case 'countdown':
            if (data.seconds > 0) {
                $('#countdown').text(data.seconds).show();
            } else {
                $('#countdown').hide();
            }
            break;
        case 'showWinner':
            showWinner(data);
            break;
    }
});

function setupInitialData(config, maps) {
    Config = config;
    setLocales(config.Locales[config.Locale]);

    // Setup Maps Select
    const $mapSelect = $('#create-map, #filter-map');
    $mapSelect.find('option:not([value="all"])').remove();
    maps.forEach(map => {
        $mapSelect.append(`<option value="${map.id}">${map.label}</option>`);
    });

    // Setup Loadout Grid
    const $loadoutGrid = $('#loadout-grid');
    $loadoutGrid.empty();
    for (const [key, loadout] of Object.entries(config.WeaponLoadouts)) {
        $loadoutGrid.append(`
            <label class="loadout-item">
                <input type="checkbox" class="loadout-check" value="${key}">
                <span>${key.toUpperCase()}</span>
            </label>
        `);
    }
}

function setLocales(locales) {
    for (const [key, text] of Object.entries(locales)) {
        $(`.l-${key}`).text(text);
    }
}

function fetchLobbies() {
    $.post(`https://${GetParentResourceName()}/fetchLobbies`, JSON.stringify({ tab: currentTab }));
}

function renderLobbies(lobbies) {
    const $ffaList = $('#ffa-lobby-list');
    const $openList = $('#open-lobby-list');

    if (currentTab === 'ffa') {
        $ffaList.empty();
        lobbies.forEach(lobby => {
            $ffaList.append(`
                <div class="ffa-card">
                    <img src="https://via.placeholder.com/300x150/1a1f2e/ffffff?text=${lobby.mapLabel}" class="ffa-img">
                    <div class="ffa-info">
                        <h3>${lobby.mapLabel}</h3>
                        <p>${lobby.playerCount} Spieler aktiv</p>
                        <button class="join-btn-quick" onclick="quickJoin('${lobby.mapId}')">SOFORT BEITRETEN</button>
                    </div>
                </div>
            `);
        });
    } else {
        $openList.empty();
        let filtered = lobbies;
        if (activeFilters.map !== 'all') filtered = filtered.filter(l => l.mapId === activeFilters.map);
        if (activeFilters.players === 'free') filtered = filtered.filter(l => l.playerCount < l.maxPlayers);

        filtered.forEach(lobby => {
            $openList.append(`
                <div class="lobby-item">
                    <div class="lobby-main-info">
                        <h4>${lobby.name}</h4>
                        <div class="lobby-stats-row">
                            <span><i class="fa-solid fa-user"></i> ${lobby.hostName}</span>
                            <span><i class="fa-solid fa-location-dot"></i> ${lobby.mapLabel}</span>
                            <span><i class="fa-solid fa-gamepad"></i> ${lobby.mode.toUpperCase()}</span>
                        </div>
                    </div>
                    <div class="lobby-meta">
                        <span>${lobby.playerCount}/${lobby.maxPlayers} Spieler</span>
                        <button class="join-btn" onclick="joinLobby('${lobby.id}')">BEITRETEN</button>
                    </div>
                </div>
            `);
        });
    }
}

function quickJoin(mapId) {
    $.post(`https://${GetParentResourceName()}/quickJoin`, JSON.stringify({ mapId }));
}

function joinLobby(lobbyId) {
    $.post(`https://${GetParentResourceName()}/joinLobby`, JSON.stringify({ lobbyId }));
}

function showWaitingArea(lobby) {
    $('#wait-lobby-name').text(lobby.name.toUpperCase());
    $('#wait-lobby-info').text(`Map: ${lobby.mapLabel} | Mode: ${lobby.mode.toUpperCase()}`);
    $('#lobby-chat-messages').empty();
    $('#waiting-area').fadeIn(300);

    if (isHost) {
        $('#btn-start').show();
    } else {
        $('#btn-start').hide();
    }
}

function renderPlayers(players) {
    const $list = $('#wait-player-list');
    $list.empty();
    players.forEach(p => {
        const isMe = false; // Could be tracked but not strictly needed for UI display
        $list.append(`
            <div class="player-entry ${p.ready ? 'ready' : ''} ${p.isHost ? 'host' : ''}">
                <span>${p.name.toUpperCase()}</span>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <small>${p.team.toUpperCase()}</small>
                    ${isHost && !p.isHost ? `<button class="kick-btn" onclick="kickPlayer('${p.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
                </div>
            </div>
        `);
    });

    if (isHost) {
        $('#btn-start').prop('disabled', players.length < 2);
    }
}

function kickPlayer(id) {
    $.post(`https://${GetParentResourceName()}/kickPlayer`, JSON.stringify({ id }));
}

function addChatMessage(name, message) {
    $('#lobby-chat-messages').append(`
        <div class="chat-msg"><b>${name}:</b> ${message}</div>
    `);
    const chat = document.getElementById('lobby-chat-messages');
    chat.scrollTop = chat.scrollHeight;
}

function showWinner(data) {
    $('#winner-announcement').html(`${data.winnerName.toUpperCase()} <span class="l-winner_suffix">${Config.Locales[Config.Locale].winner_suffix}</span>`);
    const $tbody = $('#winner-stats-table tbody');
    $tbody.empty();
    data.stats.forEach(s => {
        $tbody.append(`
            <tr>
                <td>${s.name}</td>
                <td>${s.kills}</td>
                <td>${s.deaths}</td>
                <td>${s.kd}</td>
            </tr>
        `);
    });
    $('#winner-screen').fadeIn(300);
}

// Auto Refresh
setInterval(() => {
    if ($('#app').is(':visible') && !$('#waiting-area').is(':visible') && !$('#winner-screen').is(':visible')) {
        fetchLobbies();
    }
}, 5000);
