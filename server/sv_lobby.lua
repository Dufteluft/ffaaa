ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Datenbank aller aktiven Lobbys
PlayerStates = {} -- Datenbank aller Spieler in Lobbys (Team, Kills, Tode, etc.)

-- Hilfsfunktion: Eindeutige Lobby-ID generieren
function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

-- Funktion: Eine neue Lobby erstellen
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
        loadout = settings.loadout, -- Kann Array von Keys sein
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

-- Event: Lobby Erstellung (via NUI)
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Funktion: Spieler einer Lobby beitreten lassen
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    -- Bestehende Lobby verlassen
    if PlayerStates[playerId] and PlayerStates[playerId].lobbyId then
        LeaveLobby(playerId)
    end

    table.insert(lobby.players, playerId)

    -- Spielerstatus speichern (für spätere Wiederherstellung)
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

    -- Instanziierung via Routing Bucket (verhindert Spieler-Interaktion zwischen Lobbys)
    SetPlayerRoutingBucket(playerId, tonumber(lobbyId))

    UpdateLobbyPlayers(lobbyId)
    return true
end

-- Event: Lobby Beitritt
RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    else
        TriggerClientEvent('esx:showNotification', source, '~r~Beitritt fehlgeschlagen: Lobby voll oder nicht existent.')
    end
end)

-- Funktion: Lobby verlassen
function LeaveLobby(playerId)
    local ps = PlayerStates[playerId]
    if not ps or not ps.lobbyId then return end

    local lobbyId = ps.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Routing Bucket wiederherstellen
    SetPlayerRoutingBucket(playerId, ps.oldBucket or 0)

    -- Client Status wiederherstellen (Position, Waffen)
    TriggerClientEvent('ffa:restoreState', playerId, ps.oldCoords)

    if lobby then
        for i, id in ipairs(lobby.players) do
            if id == playerId then
                table.remove(lobby.players, i)
                break
            end
        end

        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil -- Leere Custom Lobby löschen
        elseif #lobby.players > 0 then
            -- Neuen Host bestimmen falls der Host geht
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

-- Event: Lobby verlassen (via NUI oder Befehl)
RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
end)

-- Funktion: Synchronisation der Spielerliste in der Lobby
function UpdateLobbyPlayers(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local playersInfo = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        table.insert(playersInfo, {
            id = pid,
            name = ps.name,
            team = ps.team,
            ready = ps.ready,
            isHost = (pid == lobby.host)
        })
    end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:updateLobbyPlayers', pid, playersInfo)
    end
end

-- Event: Lobby Chat Handling
RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local ps = PlayerStates[source]
    if ps and ps.lobbyId then
        local lobby = Lobbies[ps.lobbyId]
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:addChatMessage', pid, ps.name, data.message)
        end
    end
end)

-- Event: Bereit-Status umschalten
RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local ps = PlayerStates[source]
    if ps then
        ps.ready = not ps.ready
        UpdateLobbyPlayers(ps.lobbyId)
    end
end)

-- Event: Teamzuweisung
RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local ps = PlayerStates[source]
    if ps then
        ps.team = team
        UpdateLobbyPlayers(ps.lobbyId)
    end
end)

-- Event: Lobbyliste für UI abrufen (mit Tab-Filter)
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

        if isMatch then
            table.insert(list, {
                id = id,
                name = lobby.name,
                hostName = lobby.hostName,
                playerCount = #lobby.players,
                maxPlayers = lobby.maxPlayers,
                mapLabel = lobby.mapLabel,
                mode = lobby.mode,
                status = (lobby.status == 'ACTIVE' and 'ACTIVE' or 'waiting'),
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Behandlung bei Serververbindungstrennung
AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)

-- Automatische Initialisierung persistenter FFA Lobbys beim Serverstart
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        local lobbyId = GenerateLobbyId()
        Lobbies[lobbyId] = {
            id = lobbyId,
            name = "FFA " .. map.label,
            host = -1, -- System
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
            status = 'ACTIVE',
            timer = 15 * 60,
            scoreBlue = 0,
            scoreRed = 0
        }
        Utils.Print('Persistente FFA Lobby bereit: ' .. map.label)
        StartGameTimer(lobbyId) -- Direkt Timer starten
    end
end)

-- Event: Spieler aus Lobby kicken (Nur für Host)
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local sid = source
    local psHost = PlayerStates[sid]
    if psHost and psHost.lobbyId then
        local lobby = Lobbies[psHost.lobbyId]
        if lobby and lobby.host == sid then
            LeaveLobby(tonumber(targetId))
            TriggerClientEvent('esx:showNotification', targetId, 'Du wurdest vom Host gekickt.')
        end
    end
end)
