ESX = exports['es_extended']:getSharedObject()

Lobbies = {}
PlayerStates = {}
TeamAssignments = {} -- Persistent team tracking during match

function GenerateLobbyId()
    local id
    repeat id = tostring(math.random(1000, 9999)) until not Lobbies[id]
    return id
end

function CreateLobby(playerId, s)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return nil end

    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(s.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = s.name,
        host = playerId,
        hostName = xPlayer.getName(),
        isPersistent = s.isPersistent or false,
        mapId = s.mapId,
        mapLabel = map.label,
        mode = s.mode,
        loadout = s.loadout,
        roundTime = s.roundTime,
        maxPlayers = s.maxPlayers,
        vehiclesAllowed = s.vehiclesAllowed,
        friendlyFire = s.friendlyFire,
        respawnTime = s.respawnTime,
        killLimit = s.killLimit,
        players = {},
        status = 'waiting',
        timer = s.roundTime * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    JoinLobby(playerId, lobbyId)
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

RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    end
end)

function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    SetPlayerRoutingBucket(playerId, state.oldBucket or 0)
    TriggerClientEvent('ffa:restoreState', playerId, state.oldCoords)

    if lobby then
        for i, id in ipairs(lobby.players) do
            if id == playerId then table.remove(lobby.players, i) break end
        end

        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 then
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xPlayer = ESX.GetPlayerFromId(lobby.host)
                lobby.hostName = xPlayer.getName()
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end

    PlayerStates[playerId] = nil
    TriggerClientEvent('ffa:leftLobby', playerId)
end

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function() LeaveLobby(source) end)

RegisterServerEvent('ffa:closeLobby')
AddEventHandler('ffa:closeLobby', function()
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] and Lobbies[state.lobbyId].host == source then
        local lobbyId = state.lobbyId
        local players = {table.unpack(Lobbies[lobbyId].players)}
        for _, pid in ipairs(players) do
            LeaveLobby(pid)
        end
    end
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            LeaveLobby(tonumber(targetId))
            TriggerClientEvent('esx:showNotification', targetId, 'Du wurdest aus der Lobby gekickt.')
        end
    end
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

RegisterServerEvent('ffa:updateSettings')
AddEventHandler('ffa:updateSettings', function(settings)
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] and Lobbies[state.lobbyId].host == source then
        local lobby = Lobbies[state.lobbyId]
        lobby.vehiclesAllowed = settings.vehiclesAllowed
        lobby.friendlyFire = settings.friendlyFire
        lobby.respawnTime = settings.respawnTime
        lobby.killLimit = settings.killLimit

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncSettings', pid, lobby)
        end
    end
end)

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local tab = data and data.tab or 'ffa'
    for id, lobby in pairs(Lobbies) do
        if (tab == 'ffa' and lobby.isPersistent) or (tab == 'list' and not lobby.isPersistent) then
            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = lobby.status == 'playing' and 'ACTIVE' or 'waiting',
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

MySQL.ready(function()
    for _, map in ipairs(Config.Maps) do
        local id = GenerateLobbyId()
        Lobbies[id] = {
            id = id, name = "FFA " .. map.label, host = -1, hostName = "SYSTEM",
            isPersistent = true, mapId = map.id, mapLabel = map.label, mode = 'ffa',
            loadout = 'all', roundTime = 0, maxPlayers = 32, vehiclesAllowed = false,
            friendlyFire = false, respawnTime = 3, killLimit = 0, players = {},
            status = 'playing', timer = 0, scoreBlue = 0, scoreRed = 0
        }
    end
end)

RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(mapId)
    local pid = source
    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            if JoinLobby(pid, id) then
                PlayerStates[pid].team = 'ffa'
                TriggerClientEvent('ffa:gameStarting', pid, Lobbies[id])
            end
            return
        end
    end
end)
