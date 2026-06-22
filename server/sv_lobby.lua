ESX = exports['es_extended']:getSharedObject()

Lobbies = {}
PlayerStates = {}

function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end

function GenerateLobbyId()
    local id
    repeat id = tostring(math.random(1000, 9999)) until not Lobbies[id]
    return id
end

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
        mode = s.mode,
        loadout = s.loadout,
        roundTime = s.roundTime,
        maxPlayers = s.maxPlayers,
        respawnTime = s.respawnTime or 5,
        killLimit = s.killLimit or 0,
        vehiclesAllowed = s.vehiclesAllowed or false,
        friendlyFire = s.friendlyFire or false,
        players = {},
        status = 'waiting',
        timer = s.roundTime * 60,
        scoreBlue = 0,
        scoreRed = 0
    }

    JoinLobby(playerId, id)
    return id
end

RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local id = CreateLobby(source, settings)
    if id then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[id])
    end
end)

function JoinLobby(playerId, id)
    local lobby = Lobbies[id]
    if not lobby or #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)
    local ped = GetPlayerPed(playerId)

    PlayerStates[playerId] = {
        lobbyId = id,
        team = 'none',
        ready = (playerId == lobby.host or lobby.host == -1),
        kills = 0,
        deaths = 0,
        name = xPlayer.getName(),
        oldCoords = GetEntityCoords(ped),
        oldBucket = GetPlayerRoutingBucket(playerId)
    }

    SetPlayerRoutingBucket(playerId, tonumber(id))

    UpdateLobbyPlayers(id)
    return true
end

RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(id, mapId)
    local targetId = id
    if not Lobbies[id] and mapId then
        -- Suche persistente Lobby
        for lid, l in pairs(Lobbies) do
            if l.isPersistent and l.mapId == mapId then
                targetId = lid
                break
            end
        end
    end

    if JoinLobby(source, targetId) then
        local lobby = Lobbies[targetId]
        TriggerClientEvent('ffa:lobbyJoined', source, lobby)

        -- Sofort-Start für persistente Lobbies
        if lobby.isPersistent then
            PlayerStates[source].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', source, lobby)
            TriggerClientEvent('ffa:syncTeam', source, 'ffa')
        end
    end
end)

function LeaveLobby(playerId)
    local ps = PlayerStates[playerId]
    if not ps or not ps.lobbyId then return end

    local id = ps.lobbyId
    local lobby = Lobbies[id]

    SetPlayerRoutingBucket(playerId, ps.oldBucket or 0)
    TriggerClientEvent('ffa:restoreState', playerId, ps.oldCoords)

    if lobby then
        for i, pid in ipairs(lobby.players) do
            if pid == playerId then
                table.remove(lobby.players, i)
                break
            end
        end

        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[id] = nil
        elseif #lobby.players > 0 then
            if playerId == lobby.host then
                lobby.host = lobby.players[1]
                local xP = ESX.GetPlayerFromId(lobby.host)
                lobby.hostName = xP and xP.getName() or "Unknown"
            end
            UpdateLobbyPlayers(id)
        end
    end

    PlayerStates[playerId] = nil
    TriggerClientEvent('ffa:leftLobby', playerId)
end

RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function() LeaveLobby(source) end)

RegisterServerEvent('ffa:closeLobby')
AddEventHandler('ffa:closeLobby', function()
    local ps = PlayerStates[source]
    if ps and ps.lobbyId then
        local lobby = Lobbies[ps.lobbyId]
        if lobby and lobby.host == source then
            local players = {table.unpack(lobby.players)}
            for _, pid in ipairs(players) do
                LeaveLobby(pid)
            end
            Lobbies[ps.lobbyId] = nil
        end
    end
end)

function UpdateLobbyPlayers(id)
    local lobby = Lobbies[id]
    if not lobby then return end

    local info = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        table.insert(info, {
            id = pid,
            name = ps.name,
            team = ps.team,
            ready = ps.ready,
            isHost = (pid == lobby.host)
        })
    end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:updateLobbyPlayers', pid, info)
    end
end

RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local tab = data and data.tab or 'ffa'

    for id, l in pairs(Lobbies) do
        local match = (tab == 'ffa' and l.isPersistent) or (tab == 'list' and not l.isPersistent)
        if match then
            table.insert(list, {
                id = id,
                name = l.name,
                hostName = l.hostName,
                playerCount = #l.players,
                maxPlayers = l.maxPlayers,
                mapLabel = l.mapLabel,
                mapId = l.mapId,
                mode = l.mode,
                status = l.status == 'playing' and 'ACTIVE' or 'WAITING'
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

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

RegisterServerEvent('ffa:saveSettings')
AddEventHandler('ffa:saveSettings', function(s)
    local ps = PlayerStates[source]
    if ps and ps.lobbyId then
        local lobby = Lobbies[ps.lobbyId]
        if lobby and lobby.host == source then
            lobby.name = s.name or lobby.name
            lobby.mapId = s.mapId or lobby.mapId
            lobby.mode = s.mode or lobby.mode
            lobby.loadout = s.loadout or lobby.loadout
            lobby.roundTime = s.roundTime or lobby.roundTime
            lobby.maxPlayers = s.maxPlayers or lobby.maxPlayers
            lobby.respawnTime = s.respawnTime or lobby.respawnTime
            lobby.killLimit = s.killLimit or lobby.killLimit
            lobby.vehiclesAllowed = s.vehiclesAllowed
            lobby.friendlyFire = s.friendlyFire

            local map = Utils.GetMapById(lobby.mapId)
            lobby.mapLabel = map.label

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:syncSettings', pid, lobby)
            end
        end
    end
end)

AddEventHandler('playerDropped', function() LeaveLobby(source) end)

-- Init Persistent Lobbies
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        local id = GenerateLobbyId()
        Lobbies[id] = {
            id = id,
            name = "FFA " .. map.label,
            host = -1,
            hostName = "SYSTEM",
            isPersistent = true,
            mapId = map.id,
            mapLabel = map.label,
            mode = 'ffa',
            loadout = 'all',
            roundTime = 30,
            maxPlayers = 32,
            respawnTime = 3,
            killLimit = 0,
            vehiclesAllowed = false,
            friendlyFire = false,
            players = {},
            status = 'playing',
            timer = 30 * 60,
            scoreBlue = 0,
            scoreRed = 0
        }
        StartGameTimer(id)
        Utils.Print('Persistente Lobby: ' .. map.label)
    end
end)

-- Cleanup empty custom lobbies
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(60000)
        for id, lobby in pairs(Lobbies) do
            if not lobby.isPersistent and #lobby.players == 0 then
                Lobbies[id] = nil
            end
        end
    end
end)
