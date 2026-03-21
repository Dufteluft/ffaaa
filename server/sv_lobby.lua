ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys
PlayerStates = {} -- Speichert den Status jedes Spielers (Lobby-ID, Team, Kills, etc.)
MapVotes = {} -- Speichert Votes pro Lobby { [lobbyId] = { [mapId] = count } }

-- Hilfsfunktion zur Generierung einer eindeutigen Lobby-ID
function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

-- Funktion: Erstellt eine neue Lobby
function CreateLobby(playerId, settings)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return nil end

    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = settings.name,
        host = playerId,
        hostName = xPlayer.getName(),
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map.label,
        mode = settings.mode,
        loadout = settings.loadout, -- Erwartet ein Array von Keys
        roundTime = settings.roundTime,
        maxPlayers = settings.maxPlayers,
        vehiclesAllowed = settings.vehiclesAllowed,
        friendlyFire = settings.friendlyFire,
        respawnTime = settings.respawnTime,
        killLimit = settings.killLimit,
        players = {},
        status = 'waiting',
        timer = settings.roundTime * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. xPlayer.getName())
    JoinLobby(playerId, lobbyId)
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

-- Funktion: Spieler tritt einer Lobby bei
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then
        TriggerClientEvent('esx:showNotification', playerId, 'Die Lobby ist voll.')
        return false
    end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)

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
AddEventHandler('ffa:joinLobby', function(lobbyId)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
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
            MapVotes[lobbyId] = nil
        elseif #lobby.players > 0 then
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xPlayer = ESX.GetPlayerFromId(lobby.host)
                if xPlayer then lobby.hostName = xPlayer.getName() end
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end

    PlayerStates[playerId] = nil
    TriggerClientEvent('ffa:leftLobby', playerId)
end

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function() LeaveLobby(source) end)

-- Funktion: Aktualisiert die Spielerliste
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
        if lobby then
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
            end
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
    if state and data and data.team then
        state.team = data.team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Einstellungen aktualisieren (Host)
RegisterServerEvent('ffa:updateSettings')
AddEventHandler('ffa:updateSettings', function(settings)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            if settings.mapId then
                lobby.mapId = settings.mapId
                local map = Utils.GetMapById(settings.mapId)
                if map then lobby.mapLabel = map.label end
            end
            if settings.mode then lobby.mode = settings.mode end

            -- Sync an alle in der Lobby
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:syncLobbyData', pid, lobby)
            end
        end
    end
end)

-- Event: Lobbyliste für UI
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local filterTab = data and data.tab or 'ffa'

    for id, lobby in pairs(Lobbies) do
        local isMatch = (filterTab == 'ffa' and lobby.isPersistent) or (filterTab == 'list' and not lobby.isPersistent)
        if isMatch then
            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = (lobby.status == 'playing' and 'ACTIVE' or 'waiting'),
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Event: Lobby schließen (Host)
RegisterServerEvent('ffa:closeLobby')
AddEventHandler('ffa:closeLobby', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobbyId = state.lobbyId
        local lobby = Lobbies[lobbyId]
        if lobby and lobby.host == source then
            local players = {} -- Kopie
            for _, pid in ipairs(lobby.players) do table.insert(players, pid) end
            for _, pid in ipairs(players) do
                TriggerClientEvent('esx:showNotification', pid, 'Die Lobby wurde vom Host geschlossen.')
                LeaveLobby(pid)
            end
        end
    end
end)

-- Event: Map Voting
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId and data and data.mapId then
        local lobbyId = state.lobbyId
        if not MapVotes[lobbyId] then MapVotes[lobbyId] = {} end

        -- Reset previous vote of this player? (Simplification: just add)
        MapVotes[lobbyId][data.mapId] = (MapVotes[lobbyId][data.mapId] or 0) + 1

        local lobby = Lobbies[lobbyId]
        if lobby then
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateVotes', pid, MapVotes[lobbyId])
            end
        end
    end
end)

-- Schnell-Beitritt
RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(mapId)
    local playerId = source
    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            if JoinLobby(playerId, id) then
                PlayerStates[playerId].team = 'ffa'
                TriggerClientEvent('ffa:gameStarting', playerId, Lobbies[id])
            end
            return
        end
    end
end)

-- Kicken
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            LeaveLobby(tonumber(targetId))
            TriggerClientEvent('esx:showNotification', tonumber(targetId), 'Du wurdest gekickt.')
        end
    end
end)

AddEventHandler('playerDropped', function() LeaveLobby(source) end)

-- Init persistente Lobbys
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        local id = GenerateLobbyId()
        Lobbies[id] = {
            id = id, name = "FFA " .. map.label, host = -1, hostName = "SYSTEM",
            isPersistent = true, mapId = map.id, mapLabel = map.label,
            mode = 'ffa', loadout = {'all'}, roundTime = 15, maxPlayers = 32,
            vehiclesAllowed = false, friendlyFire = false, respawnTime = 3, killLimit = 0,
            players = {}, status = 'playing', timer = 15 * 60, scoreBlue = 0, scoreRed = 0
        }
        StartGameTimer(id)
    end
end)
