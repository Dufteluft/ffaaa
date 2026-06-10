ESX = exports['es_extended']:getSharedObject()
Lobbies = {}
PlayerStates = {}

function GenerateLobbyId()
    local id
    repeat id = tostring(math.random(1000, 9999)) until not Lobbies[id]
    return id
end

function CreateLobby(playerId, settings)
    local xPlayer = (playerId ~= -1) and ESX.GetPlayerFromId(playerId) or nil
    local lobbyId = GenerateLobbyId()
    local map = Utils.GetMapById(settings.mapId)

    Lobbies[lobbyId] = {
        id = lobbyId,
        name = settings.name,
        host = playerId,
        hostName = xPlayer and xPlayer.getName() or "SYSTEM",
        isPersistent = settings.isPersistent or false,
        mapId = settings.mapId,
        mapLabel = map and map.label or "Unknown",
        mode = settings.mode or 'ffa',
        loadout = settings.loadout or 'all',
        roundTime = settings.roundTime or Config.DefaultSettings.roundTime,
        maxPlayers = settings.maxPlayers or Config.DefaultSettings.maxPlayers,
        vehiclesAllowed = settings.vehiclesAllowed or false,
        friendlyFire = settings.friendlyFire or false,
        respawnTime = settings.respawnTime or 5,
        killLimit = settings.killLimit or 0,
        players = {},
        status = 'waiting',
        timer = (settings.roundTime or 15) * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    if playerId ~= -1 then JoinLobby(playerId, lobbyId) end
    return lobbyId
end

RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId]) end
end)

function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby or #lobby.players >= lobby.maxPlayers then return false end
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    if PlayerStates[playerId] then LeaveLobby(playerId) end

    table.insert(lobby.players, playerId)
    PlayerStates[playerId] = {
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(GetPlayerPed(playerId)),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))
    UpdateLobbyPlayers(lobbyId)
    return true
end

RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId, mapId)
    local targetId = lobbyId
    if not targetId and mapId then
        for id, l in pairs(Lobbies) do
            if l.mapId == mapId and l.isPersistent then targetId = id; break end
        end
    end

    if targetId and JoinLobby(source, targetId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[targetId])
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
            if id == playerId then table.remove(lobby.players, i); break end
        end

        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 and playerId == lobby.host then
            lobby.host = lobby.players[1]
            local nextHost = ESX.GetPlayerFromId(lobby.host)
            lobby.hostName = nextHost and nextHost.getName() or "Unknown"
            UpdateLobbyPlayers(lobbyId)
        else
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
        for _, pid in ipairs(players) do LeaveLobby(pid) end
        Lobbies[lobbyId] = nil
    end
end)

RegisterServerEvent('ffa:updateSettings')
AddEventHandler('ffa:updateSettings', function(settings)
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] and Lobbies[state.lobbyId].host == source then
        local lobby = Lobbies[state.lobbyId]
        lobby.roundTime = settings.roundTime
        lobby.maxPlayers = settings.maxPlayers
        lobby.respawnTime = settings.respawnTime
        lobby.killLimit = settings.killLimit
        lobby.vehiclesAllowed = settings.vehiclesAllowed
        lobby.friendlyFire = settings.friendlyFire

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:updateLobbySettings', pid, lobby)
        end
    end
end)

function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end
    local info = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        table.insert(info, { id = pid, name = ps.name, team = ps.team, ready = ps.ready, isHost = (pid == lobby.host) })
    end
    for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:updateLobbyPlayers', pid, info) end
end

RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local ps = PlayerStates[source]
    if ps then ps.ready = not ps.ready; UpdateLobbyPlayers(ps.lobbyId) end
end)

RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local ps = PlayerStates[source]
    if ps then ps.team = team; UpdateLobbyPlayers(ps.lobbyId) end
end)

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local tab = data and data.tab or 'ffa'
    for id, l in pairs(Lobbies) do
        local match = (tab == 'ffa' and l.isPersistent) or (tab == 'list' and not l.isPersistent)
        if match then
            table.insert(list, {
                id = id, name = l.name, hostName = l.hostName, playerCount = #l.players,
                maxPlayers = l.maxPlayers, mapLabel = l.mapLabel, mapId = l.mapId, mode = l.mode,
                status = l.status == 'playing' and 'ACTIVE' or 'WAITING'
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local ps = PlayerStates[source]
    if ps then
        for _, pid in ipairs(Lobbies[ps.lobbyId].players) do
            TriggerClientEvent('ffa:addChatMessage', pid, ps.name, data.message)
        end
    end
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local ps = PlayerStates[source]
    if ps and Lobbies[ps.lobbyId].host == source then LeaveLobby(tonumber(targetId)) end
end)

MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        local lobbyId = CreateLobby(-1, {
            name = "FFA " .. map.label, mapId = map.id, isPersistent = true,
            mode = 'ffa', loadout = 'all', roundTime = 0, maxPlayers = 32
        })
        Lobbies[lobbyId].status = 'playing'
    end
end)
