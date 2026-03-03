ESX = exports['es_extended']:getSharedObject()

Lobbies = {}
PlayerStates = {}

function GenerateLobbyId()
    local id
    repeat id = tostring(math.random(1000, 9999)) until not Lobbies[id]
    return id
end

-- Lobby Erstellung
function CreateLobby(playerId, s)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return nil end

    local id = GenerateLobbyId()
    local map = Utils.GetMapById(s.mapId)

    Lobbies[id] = {
        id = id,
        name = s.name,
        host = playerId,
        hostName = xPlayer.getName(),
        isPersistent = s.isPersistent or false,
        mapId = s.mapId,
        mapLabel = map.label,
        mode = s.mode or 'ffa',
        loadout = s.loadout or 'all',
        roundTime = s.roundTime or 15,
        maxPlayers = s.maxPlayers or 16,
        respawnTime = s.respawnTime or 5,
        killLimit = s.killLimit or 30,
        vehiclesAllowed = s.vehiclesAllowed or false,
        friendlyFire = s.friendlyFire or false,
        players = {},
        status = 'waiting',
        timer = (s.roundTime or 15) * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    JoinLobby(playerId, id)
    return id
end

RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local id = CreateLobby(source, settings)
    if id then TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[id]) end
end)

-- Lobby Beitritt
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
AddEventHandler('ffa:joinLobby', function(id)
    if JoinLobby(source, id) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[id])
    end
end)

-- Lobby Verlassen
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
AddEventHandler('ffa:leaveLobby', function() LeaveLobby(source) end)

-- Hilfsfunktionen
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

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local tab = data and data.tab or 'ffa'
    for id, l in pairs(Lobbies) do
        local valid = (tab == 'ffa' and l.isPersistent) or (tab == 'list' and not l.isPersistent)
        if valid then
            table.insert(list, {
                id = id, name = l.name, hostName = l.hostName, playerCount = #l.players,
                maxPlayers = l.maxPlayers, mapLabel = l.mapLabel, mode = l.mode, status = (l.status == 'playing' and 'ACTIVE' or 'OFFEN')
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Team & Bereit Status
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

-- Initialisierung persistenter Lobbys
MySQL.ready(function()
    for _, map in ipairs(Config.Maps) do
        local id = GenerateLobbyId()
        Lobbies[id] = {
            id = id, name = "FFA " .. map.label, host = -1, hostName = "SYSTEM",
            isPersistent = true, mapId = map.id, mapLabel = map.label, mode = 'ffa',
            loadout = 'all', roundTime = 0, maxPlayers = 32, respawnTime = 3,
            killLimit = 0, players = {}, status = 'playing', timer = 0, scoreBlue = 0, scoreRed = 0
        }
    end
end)

-- Kicken
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] and Lobbies[state.lobbyId].host == source then
        LeaveLobby(targetId)
    end
end)
