ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys
PlayerStates = {} -- Speichert den Status jedes Spielers (Lobby-ID, Team, Kills, etc.)

-- Hilfsfunktion zur Generierung einer eindeutigen Lobby-ID
function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

-- Event: Lobby erstellen
function CreateLobby(playerId, settings)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer and playerId ~= -1 then return nil end

    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = settings.name,
        host = playerId,
        hostName = xPlayer and xPlayer.getName() or "SYSTEM",
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map.label,
        mode = settings.mode,
        loadout = settings.loadout,
        loadouts = settings.loadouts or {settings.loadout},
        roundTime = settings.roundTime or 15,
        maxPlayers = settings.maxPlayers or 16,
        vehiclesAllowed = settings.vehiclesAllowed or false,
        friendlyFire = settings.friendlyFire or false,
        respawnTime = settings.respawnTime or 5,
        killLimit = settings.killLimit or 30,
        players = {},
        status = 'waiting',
        timer = (settings.roundTime or 15) * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. (xPlayer and xPlayer.getName() or "SYSTEM"))

    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
    end
    return lobbyId
end

-- Event: Lobby erstellen (via NUI)
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Event: Einstellungen aktualisieren (Host-only)
RegisterServerEvent('ffa:updateSettings')
AddEventHandler('ffa:updateSettings', function(settings)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            lobby.name = settings.name
            lobby.mapId = settings.mapId
            local map = Utils.GetMapById(settings.mapId)
            lobby.mapLabel = map.label
            lobby.mode = settings.mode
            lobby.loadout = settings.loadout
            lobby.loadouts = settings.loadouts
            lobby.roundTime = settings.roundTime
            lobby.maxPlayers = settings.maxPlayers
            lobby.vehiclesAllowed = settings.vehiclesAllowed
            lobby.friendlyFire = settings.friendlyFire
            lobby.respawnTime = settings.respawnTime
            lobby.killLimit = settings.killLimit

            -- Allen Spielern in der Lobby die neuen Daten schicken
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:lobbyJoined', pid, lobby)
            end
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)

-- Funktion: Spieler tritt einer Lobby bei
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    -- Prüfen, ob der Spieler bereits in einer Lobby ist
    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)

    -- Speichere aktuellen Status des Spielers
    local ped = GetPlayerPed(playerId)
    PlayerStates[playerId] = {
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))

    UpdateLobbyPlayers(lobbyId)
    return true
end

-- Event: Lobby beitreten
RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(data)
    local lobbyId = data.lobbyId
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    else
        TriggerClientEvent('esx:showNotification', source, 'Lobby ist voll oder existiert nicht.')
    end
end)

-- Funktion: Lobby verlassen
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    SetPlayerRoutingBucket(playerId, state.oldBucket or 0)
    TriggerClientEvent('ffa:restoreState', playerId, state.oldCoords)

    if lobby then
        for i, id in ipairs(lobby.players) do
            if id == playerId then
                table.remove(lobby.players, i)
                break
            end
        end

        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 then
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xPlayer = ESX.GetPlayerFromId(lobby.host)
                if xPlayer then
                    lobby.hostName = xPlayer.getName()
                end
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end

    PlayerStates[playerId] = nil
    TriggerClientEvent('ffa:leftLobby', playerId)
end

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
end)

-- Event: Lobby schließen (Host-only)
RegisterServerEvent('ffa:closeLobby')
AddEventHandler('ffa:closeLobby', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source and not lobby.isPersistent then
            local players = {}
            for _, pid in ipairs(lobby.players) do table.insert(players, pid) end
            for _, pid in ipairs(players) do
                LeaveLobby(pid)
            end
        end
    end
end)

-- Funktion: Aktualisiert die Spielerliste für alle in der Lobby
function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local playersInfo = {}
    for _, pid in ipairs(lobby.players) do
        local state = PlayerStates[pid]
        if state then
            table.insert(playersInfo, {
                id = pid,
                name = state.name,
                team = state.team,
                ready = state.ready,
                isHost = (pid == lobby.host)
            })
        end
    end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:updateLobbyPlayers', pid, playersInfo)
    end
end

-- Event: Lobby-Chat senden
RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
        end
    end
end)

-- Event: Bereit-Status umschalten
RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Team setzen
RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(data)
    local state = PlayerStates[source]
    if state then
        state.team = data.team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Lobbyliste für UI abrufen
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local filterTab = data and data.tab or 'ffa'

    for id, lobby in pairs(Lobbies) do
        local isMatch = false
        if filterTab == 'ffa' then
            if lobby.isPersistent then isMatch = true end
        else
            if not lobby.isPersistent then isMatch = true end
        end

        -- Filter: Nur Lobbys mit freien Plätzen
        if isMatch and #lobby.players < lobby.maxPlayers then
            local displayStatus = 'WAITING'
            if lobby.status == 'playing' then displayStatus = 'ACTIVE' end

            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = displayStatus,
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Wenn Spieler den Server verlässt
AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)

-- Automatische Initialisierung der persistenten Lobbys beim Server-Start
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        CreateLobby(-1, {
            name = "FFA " .. map.label,
            mapId = map.id,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 0,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            isPersistent = true
        })
        -- Persistent Lobbies sofort auf 'playing' setzen
        for id, lobby in pairs(Lobbies) do
            if lobby.mapId == map.id and lobby.isPersistent then
                lobby.status = 'playing'
            end
        end
    end
end)

-- Event: Schneller Beitritt (Tab 1)
RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(data)
    local mapId = data.mapId
    local playerId = source
    local targetLobbyId = nil

    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            targetLobbyId = id
            break
        end
    end

    if targetLobbyId then
        if JoinLobby(playerId, targetLobbyId) then
            local lobby = Lobbies[targetLobbyId]
            PlayerStates[playerId].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', playerId, lobby)
        end
    end
end)

-- Event: Spieler aus Lobby kicken
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            local targetId = tonumber(data.id)
            LeaveLobby(targetId)
            TriggerClientEvent('esx:showNotification', targetId, 'Du wurdest aus der Lobby gekickt.')
        end
    end
end)

-- Event: Scoreboard abrufen
RegisterServerEvent('ffa:requestScoreboard')
AddEventHandler('ffa:requestScoreboard', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            local stats = {}
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps then
                    table.insert(stats, {
                        name = ps.name,
                        kills = ps.kills,
                        deaths = ps.deaths,
                        kd = string.format("%.2f", (ps.deaths > 0) and (ps.kills / ps.deaths) or (ps.kills + 0.0))
                    })
                end
            end
            table.sort(stats, function(a, b) return a.kills > b.kills end)
            TriggerClientEvent('ffa:receiveScoreboard', source, stats)
        end
    end
end)
