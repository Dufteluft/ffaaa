ESX = exports['es_extended']:getSharedObject()

Lobbies = {}
PlayerStates = {}

function GenerateLobbyId()
    local id
    repeat id = tostring(math.random(1000, 9999)) until not Lobbies[id]
    return id
end

function CreateLobby(playerId, settings)
    local xPlayer = ESX.GetPlayerFromId(playerId)
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

    if playerId ~= -1 then
        JoinLobby(playerId, lobbyId)
    end
    return lobbyId
end

RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby or #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if PlayerStates[playerId] then LeaveLobby(playerId) end

    table.insert(lobby.players, playerId)
    PlayerStates[playerId] = {
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = xPlayer and xPlayer.getName() or "Unbekannt",
        oldCoords = GetEntityCoords(GetPlayerPed(playerId)),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))
    UpdateLobbyPlayers(lobbyId)
    return true
end

RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    end
end)

function LeaveLobby(playerId, shouldClose)
    local state = PlayerStates[playerId]
    if not state then return end

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

        if shouldClose and lobby.host == playerId then
            for _, pid in ipairs(lobby.players) do
                LeaveLobby(pid)
            end
            Lobbies[lobbyId] = nil
        elseif #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 then
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xPlayer = ESX.GetPlayerFromId(lobby.host)
                lobby.hostName = xPlayer and xPlayer.getName() or "SYSTEM"
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end

    PlayerStates[playerId] = nil
    TriggerClientEvent('ffa:leftLobby', playerId)
end

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function(data)
    LeaveLobby(source, data and data.close)
end)

function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local playersInfo = {}
    for _, pid in ipairs(lobby.players) do
        local state = PlayerStates[pid]
        table.insert(playersInfo, {
            id = pid,
            name = state.name,
            team = state.team,
            ready = state.ready,
            isHost = (pid == lobby.host)
        })
    end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:updateLobbyPlayers', pid, playersInfo)
    end
end

RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local state = PlayerStates[source]
    if state then
        local lobby = Lobbies[state.lobbyId]
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
AddEventHandler('ffa:setTeam', function(team)
    local state = PlayerStates[source]
    if state then
        state.team = team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    for id, lobby in pairs(Lobbies) do
        local isMatch = (data.tab == 'ffa' and lobby.isPersistent) or (data.tab == 'list' and not lobby.isPersistent)
        if isMatch then
            table.insert(list, {
                id = id,
                name = lobby.name,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(data)
    local mapId = data.mapId
    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            if JoinLobby(source, id) then
                PlayerStates[source].team = 'ffa'
                TriggerClientEvent('ffa:gameStarting', source, lobby)
            end
            return
        end
    end
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(data)
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] and Lobbies[state.lobbyId].host == source then
        LeaveLobby(tonumber(data.id))
    end
end)

AddEventHandler('playerDropped', function() LeaveLobby(source) end)

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
            roundTime = 60,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            players = {},
            status = 'playing',
            timer = 3600,
            scoreBlue = 0,
            scoreRed = 0
        }
    end
end)
