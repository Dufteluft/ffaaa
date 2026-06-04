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
        scoreRed = 0,
        votes = {}
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
    PlayerStates[playerId] = {
        lobbyId = lobbyId,
        team = 'none',
        ready = (playerId == lobby.host or lobby.isPersistent),
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
                local nextHost = ESX.GetPlayerFromId(lobby.host)
                if nextHost then lobby.hostName = nextHost.getName() end
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

RegisterServerEvent('ffa:closeLobby')
AddEventHandler('ffa:closeLobby', function()
    local ps = PlayerStates[source]
    if ps and Lobbies[ps.lobbyId] and Lobbies[ps.lobbyId].host == source then
        local lobbyId = ps.lobbyId
        local players = {table.unpack(Lobbies[lobbyId].players)}
        for _, pid in ipairs(players) do
            LeaveLobby(pid)
            TriggerClientEvent('esx:showNotification', pid, 'Die Lobby wurde vom Host geschlossen.')
        end
        Lobbies[lobbyId] = nil
    end
end)

function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local playersInfo = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        if ps then
            table.insert(playersInfo, {
                id = pid,
                name = ps.name,
                team = ps.team,
                ready = ps.ready,
                isHost = (pid == lobby.host)
            })
        end
    end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:updateLobbyPlayers', pid, playersInfo)
    end
end

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local tab = data and data.tab or 'ffa'

    for id, lobby in pairs(Lobbies) do
        local show = false
        if tab == 'ffa' and lobby.isPersistent then show = true
        elseif tab == 'list' and not lobby.isPersistent then show = true end

        if show then
            table.insert(list, {
                id = id,
                name = lobby.name,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = lobby.status:upper()
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(mapId)
    local playerId = source
    local targetId = nil
    for id, l in pairs(Lobbies) do
        if l.isPersistent and l.mapId == mapId then
            targetId = id
            break
        end
    end

    if targetId and JoinLobby(playerId, targetId) then
        PlayerStates[playerId].team = 'ffa'
        TriggerClientEvent('ffa:lobbyJoined', playerId, Lobbies[targetId])
        TriggerClientEvent('ffa:gameStarting', playerId, Lobbies[targetId])
    end
end)

RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local ps = PlayerStates[source]
    if ps then
        ps.ready = not ps.ready
        UpdateLobbyPlayers(ps.lobbyId)
    end
end)

RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local ps = PlayerStates[source]
    if ps then
        ps.team = team
        UpdateLobbyPlayers(ps.lobbyId)
    end
end)

RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local ps = PlayerStates[source]
    if ps then
        local lobby = Lobbies[ps.lobbyId]
        if lobby then
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, ps.name, data.message)
            end
        end
    end
end)

RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local ps = PlayerStates[source]
    if ps and Lobbies[ps.lobbyId] and Lobbies[ps.lobbyId].host == source then
        LeaveLobby(tonumber(targetId))
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local ps = PlayerStates[source]
    if ps and Lobbies[ps.lobbyId] then
        local lobby = Lobbies[ps.lobbyId]
        lobby.votes[source] = data.mapId
    end
end)

-- Init Persistente Lobbys
MySQL.ready(function()
    for _, map in ipairs(Config.Maps) do
        local lid = GenerateLobbyId()
        Lobbies[lid] = {
            id = lid,
            name = "FFA " .. map.label,
            host = -1,
            hostName = "SYSTEM",
            isPersistent = true,
            mapId = map.id,
            mapLabel = map.label,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 15,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            players = {},
            status = 'playing',
            timer = 15 * 60,
            scoreBlue = 0,
            scoreRed = 0,
            votes = {}
        }
        StartGameTimer(lid)
    end
end)
