ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys
PlayerStates = {} -- Speichert den Status jedes Spielers

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
        loadout = settings.loadout,
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

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' (ID: ' .. lobbyId .. ')')

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
    lobbyId = tostring(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    -- Alten Status bereinigen bevor wir beitreten
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
AddEventHandler('ffa:joinLobby', function(data)
    local lobbyId = tostring(type(data) == 'table' and data.lobbyId or data)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    end
end)

-- Funktion: Lobby verlassen
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = tostring(state.lobbyId)
    local lobby = Lobbies[lobbyId]

    SetPlayerRoutingBucket(playerId, state.oldBucket or 0)
    TriggerClientEvent('ffa:restoreState', playerId, state.oldCoords)

    if lobby then
        -- Erst aus der Liste entfernen
        for i, id in ipairs(lobby.players) do
            if id == playerId then
                table.remove(lobby.players, i)
                break
            end
        end

        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 then
            -- Host-Übergabe
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
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
end)

-- Funktion: Aktualisiert die Spielerliste für alle in der Lobby
function UpdateLobbyPlayers(lobbyId)
    lobbyId = tostring(lobbyId)
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

-- Event: Lobby-Chat
RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[tostring(state.lobbyId)]
        if lobby then
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, state.name, data.message)
            end
        end
    end
end)

RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(data)
    local team = type(data) == 'table' and data.team or data
    local state = PlayerStates[source]
    if state then
        state.team = team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Lobbyliste für UI
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local filterTab = data and data.tab or 'ffa'
    local filterMap = data and data.mapId or 'all'
    local filterPlayers = data and data.playerFilter or 'all'

    for id, lobby in pairs(Lobbies) do
        local isMatch = false
        if filterTab == 'ffa' then
            if lobby.isPersistent then isMatch = true end
        else
            if not lobby.isPersistent then isMatch = true end
        end

        if isMatch then
            if filterMap ~= 'all' and lobby.mapId ~= filterMap then isMatch = false end
            if filterPlayers == 'not-full' and #lobby.players >= lobby.maxPlayers then isMatch = false end
        end

        if isMatch then
            table.insert(list, {
                id = tostring(id),
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = (lobby.status == 'playing') and 'ACTIVE' or 'waiting',
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)

-- Init persistente Lobbys
MySQL.ready(function()
    for _, map in ipairs(Config.Maps) do
        local lobbyId = GenerateLobbyId()
        Lobbies[lobbyId] = {
            id = lobbyId,
            name = "FFA " .. map.label,
            host = -1,
            hostName = "SYSTEM",
            isPersistent = true,
            mapId = map.id,
            mapLabel = map.label,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 0,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            players = {},
            status = 'playing',
            timer = 0,
            scoreBlue = 0,
            scoreRed = 0
        }
    end
end)

-- Event: Schneller Beitritt
RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(data)
    local mapId = type(data) == 'table' and data.mapId or data
    local targetLobbyId = nil

    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            targetLobbyId = id
            break
        end
    end

    if targetLobbyId then
        if JoinLobby(source, targetLobbyId) then
            PlayerStates[source].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', source, Lobbies[targetLobbyId])
        end
    end
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local targetId = tonumber(type(data) == 'table' and data.id or data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[tostring(state.lobbyId)]
        if lobby and lobby.host == source then
            LeaveLobby(targetId)
        end
    end
end)
