ESX = exports['es_extended']:getSharedObject()

Lobbies = {} -- Speichert alle aktiven Lobbys (Custom und Persistent)
PlayerStates = {} -- Speichert den Status jedes Spielers (Lobby-ID, Team, Kills, Tode, etc.)

-- Hilfsfunktion: Generiert eine eindeutige 4-stellige Lobby-ID
function GenerateLobbyId()
    local id
    repeat
        id = tostring(math.random(1000, 9999))
    until not Lobbies[id]
    return id
end

-- Hilfsfunktion: Server-seitige Übersetzung basierend auf config.lua
function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end

-- Funktion: Erstellt eine neue Lobby intern
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

    Utils.Print('Lobby erstellt: ' .. settings.name .. ' von ' .. xPlayer.getName())

    JoinLobby(playerId, lobbyId)
    return lobbyId
end

-- Event: Lobby erstellen (via NUI Tab 2)
RegisterServerEvent('ffa:createLobby')
AddEventHandler('ffa:createLobby', function(settings)
    local lobbyId = CreateLobby(source, settings)
    if lobbyId then
        TriggerClientEvent('ffa:lobbyCreated', source, Lobbies[lobbyId])
    end
end)

-- Event: Einstellungen synchronisieren (Wenn Host im Wartebereich Dinge ändert)
RegisterServerEvent('ffa:syncSettings')
AddEventHandler('ffa:syncSettings', function(settings)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            lobby.name = settings.name or lobby.name
            lobby.mapId = settings.mapId or lobby.mapId
            local map = Utils.GetMapById(lobby.mapId)
            lobby.mapLabel = map.label
            lobby.mode = settings.mode or lobby.mode
            lobby.loadout = settings.loadout or lobby.loadout
            lobby.roundTime = settings.roundTime or lobby.roundTime
            lobby.maxPlayers = settings.maxPlayers or lobby.maxPlayers
            lobby.vehiclesAllowed = settings.vehiclesAllowed
            lobby.friendlyFire = settings.friendlyFire
            lobby.respawnTime = settings.respawnTime or lobby.respawnTime
            lobby.killLimit = settings.killLimit or lobby.killLimit

            -- Alle Teilnehmer über die neuen Settings informieren
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:syncSettings', pid, lobby)
            end
        end
    end
end)

-- Funktion: Spieler einer Lobby hinzufügen und State initialisieren
function JoinLobby(playerId, lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return false end
    if #lobby.players >= lobby.maxPlayers then return false end

    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return false end

    -- Verlässt alte Lobby, falls vorhanden
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

    -- Setzt Routing Bucket zur Instanziierung (verhindert Ghosting/Interaktion mit anderen)
    SetPlayerRoutingBucket(playerId, tonumber(lobbyId) or math.random(100, 999))

    UpdateLobbyPlayers(lobbyId)
    return true
end

-- Event: Lobby beitreten (Tab 3)
RegisterServerEvent('ffa:joinLobby')
AddEventHandler('ffa:joinLobby', function(lobbyId)
    if JoinLobby(source, lobbyId) then
        TriggerClientEvent('ffa:lobbyJoined', source, Lobbies[lobbyId])
    end
end)

-- Funktion: Spieler aus Lobby entfernen und State zurücksetzen
function LeaveLobby(playerId)
    local state = PlayerStates[playerId]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Routing Bucket und Position wiederherstellen
    SetPlayerRoutingBucket(playerId, state.oldBucket or 0)
    TriggerClientEvent('ffa:restoreState', playerId, state.oldCoords)

    if lobby then
        for i, id in ipairs(lobby.players) do
            if id == playerId then
                table.remove(lobby.players, i)
                break
            end
        end

        -- Löscht Lobby, wenn sie leer ist (außer persistente Lobbys)
        if #lobby.players == 0 and not lobby.isPersistent then
            Lobbies[lobbyId] = nil
        elseif #lobby.players > 0 then
            -- Übergibt Host an nächsten Spieler, falls der Host geht
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

-- Event: Lobby verlassen (Button im UI)
RegisterServerEvent('ffa:leaveLobby')
AddEventHandler('ffa:leaveLobby', function()
    LeaveLobby(source)
end)

-- Event: Lobby schließen (durch Host)
RegisterServerEvent('ffa:closeLobby')
AddEventHandler('ffa:closeLobby', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source and not lobby.isPersistent then
            -- Alle Spieler aus der Lobby werfen
            local players = {}
            for _, pid in ipairs(lobby.players) do
                table.insert(players, pid)
            end

            for _, pid in ipairs(players) do
                LeaveLobby(pid)
                TriggerClientEvent('esx:showNotification', pid, 'Die Lobby wurde vom Host geschlossen.')
            end

            Lobbies[state.lobbyId] = nil
        end
    end
end)

-- Funktion: Aktualisiert die Spielerliste für alle Clients in der Lobby
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

-- Event: Lobby-Chat Nachricht verteilen
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

-- Event: Bereit-Status im Wartebereich umschalten
RegisterServerEvent('ffa:toggleReady')
AddEventHandler('ffa:toggleReady', function()
    local state = PlayerStates[source]
    if state then
        state.ready = not state.ready
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Teamwahl im Wartebereich
RegisterServerEvent('ffa:setTeam')
AddEventHandler('ffa:setTeam', function(team)
    local state = PlayerStates[source]
    if state then
        state.team = team
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Liste der verfügbaren Lobbys für Tab 1 & 3 senden
RegisterServerEvent('ffa:fetchLobbies')
AddEventHandler('ffa:fetchLobbies', function(data)
    local list = {}
    local filterTab = (data and data.tab) or 'ffa'

    for id, lobby in pairs(Lobbies) do
        local isMatch = false
        if filterTab == 'ffa' then
            -- Tab 1 zeigt nur persistente System-Lobbys
            if lobby.isPersistent then isMatch = true end
        else
            -- Tab 3 zeigt von Spielern erstellte Lobbys
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
                mapId = lobby.mapId,
                mode = lobby.mode,
                status = lobby.status == 'playing' and 'ACTIVE' or 'WAITING',
                isPersistent = lobby.isPersistent
            })
        end
    end
    TriggerClientEvent('ffa:updateLobbies', source, list)
end)

-- Handhabt Spieler-Disconnections
AddEventHandler('playerDropped', function()
    LeaveLobby(source)
end)

-- Event: Schneller Beitritt (Tab 1 / Vordefinierte Maps)
RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(mapId)
    local playerId = source
    local targetLobbyId = nil

    -- Sucht passende persistente Lobby
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
            -- Überspringt Wartebereich für FFA Lobbys
            TriggerClientEvent('ffa:gameStarting', playerId, lobby)
            TriggerClientEvent('ffa:syncTeams', playerId, { [playerId] = 'ffa' })
        end
    end
end)

-- Event: Kickt einen Spieler aus einer Custom-Lobby (Nur Host)
RegisterServerEvent('ffa:kickPlayer')
AddEventHandler('ffa:kickPlayer', function(targetId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == source then
            LeaveLobby(targetId)
            TriggerClientEvent('esx:showNotification', targetId, 'Du wurdest aus der Lobby gekickt.')
        end
    end
end)

-- Automatische Initialisierung der persistenten Lobbys beim Server-Start
MySQL.ready(function()
    Citizen.Wait(1000)
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
        StartGameTimer(lobbyId)
        Utils.Print('Persistente FFA Lobby initialisiert: ' .. map.label)
    end
end)
