-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local src = source
    local state = PlayerStates[src]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == src then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Spieler Teams zuweisen (Auto-Balance)
        local blueCount, redCount = 0, 0
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if pState.team == 'blue' then blueCount = blueCount + 1
            elseif pState.team == 'red' then redCount = redCount + 1 end
        end

        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pState.team == 'none' or pState.team == 'random' or pState.team == 'spectator' then
                    if blueCount <= redCount then
                        pState.team = 'blue'
                        blueCount = blueCount + 1
                    else
                        pState.team = 'red'
                        redCount = redCount + 1
                    end
                end
            else
                pState.team = 'ffa'
            end

            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        -- Team-Synchronisation
        local teams = {}
        for _, pid in ipairs(lobby.players) do
            teams[pid] = PlayerStates[pid].team
        end
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teams)
        end

        StartGameTimer(lobbyId)
    end
end)

-- Funktion: Startet den Runden-Timer
function StartGameTimer(lobbyId)
    local lobbyIdStr = tostring(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyIdStr] and Lobbies[lobbyIdStr].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyIdStr]
            if not lobby then break end

            if lobby.timer > 0 then
                lobby.timer = lobby.timer - 1

                -- Timer mit Clients synchronisieren
                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                local timeStr = string.format('%02d:%02d', mins, secs)

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTimer', pid, timeStr)
                end
            else
                EndGame(lobbyIdStr, 'Zeit abgelaufen')
                break
            end
        end
    end)
end

-- Funktion: Spiel beenden und Sieger ermitteln
function EndGame(lobbyId, reason)
    local lobbyIdStr = tostring(lobbyId)
    local lobby = Lobbies[lobbyIdStr]
    if not lobby then return end

    lobby.status = 'ended'

    local winnerName = 'NIEMAND'
    local maxKills = -1
    local winnerTeam = 'none'

    -- Sieg-Logik für TDM
    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = 'TEAM BLAU'
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = 'TEAM ROT'
            winnerTeam = 'red'
        else
            winnerName = 'UNENTSCHIEDEN'
        end
    -- Sieg-Logik für FFA
    else
        for _, pid in ipairs(lobby.players) do
            local state = PlayerStates[pid]
            if state and state.kills > maxKills then
                maxKills = state.kills
                winnerName = state.name
            end
        end
    end

    -- Statistiken sammeln
    local stats = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        if ps then
            table.insert(stats, {
                name = ps.name,
                kills = ps.kills,
                deaths = ps.deaths,
                kd = string.format("%.2f", (ps.deaths > 0) and (ps.kills / ps.deaths) or (ps.kills + 0.0))
            })
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    -- Statistiken speichern und Clients informieren
    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats
        })

        -- DB-Statistiken aktualisieren
        local state = PlayerStates[pid]
        if state then
            local isWin = (winnerName == state.name) or (winnerTeam ~= 'none' and state.team == winnerTeam)
            UpdatePlayerStats(pid, state.kills, state.deaths, isWin)
        end

        -- Wenn persistente Lobby, starte für Spieler nach kurzem Delay neu
        if lobby.isPersistent then
            Citizen.CreateThread(function()
                Citizen.Wait(10000) -- 10 Sekunden Anzeigezeit
                if PlayerStates[pid] and PlayerStates[pid].lobbyId == lobbyIdStr then
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
            end)
        end
    end

    if lobby.isPersistent then
        lobby.timer = lobby.roundTime * 60
        lobby.status = 'playing'
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        StartGameTimer(lobbyIdStr)
    end
end

-- Event: Spieler wurde getötet
RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local victimState = PlayerStates[victim]
    if not victimState then return end

    local lobbyId = victimState.lobbyId
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    victimState.deaths = victimState.deaths + 1

    -- Killer-Statistiken aktualisieren
    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState and killerState.lobbyId == lobbyId then
            killerState.kills = killerState.kills + 1

            -- TDM Score-Sync
            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            -- Kill-Limit Prüfung
            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    -- HUD-Update an alle betroffenen Spieler
    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

-- Event: Map Voting / Selection
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local mapId = type(data) == 'table' and data.mapId or data
    local src = source
    local state = PlayerStates[src]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = mapId
            local map = Utils.GetMapById(mapId)
            if map then lobby.mapLabel = map.label end

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Map wurde geändert auf: ' .. lobby.mapLabel)
            end
        end
    end
end)

-- Reset Lobby for another round
RegisterServerEvent('ffa:resetLobby')
AddEventHandler('ffa:resetLobby', function()
    local src = source
    local state = PlayerStates[src]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.host == src then
            lobby.status = 'waiting'
            lobby.scoreBlue = 0
            lobby.scoreRed = 0
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0
                    ps.deaths = 0
                    ps.ready = (pid == lobby.host)
                end
            end
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)

-- Initialisierung der persistenten Lobbys beim Server-Start
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
            timer = 60 * 60,
            scoreBlue = 0,
            scoreRed = 0
        }
        Utils.Print('Persistente FFA Lobby initialisiert: ' .. map.label)
    end
end)

-- Schneller Beitritt (Tab 1)
RegisterServerEvent('ffa:quickJoin')
AddEventHandler('ffa:quickJoin', function(data)
    local mapId = type(data) == 'table' and data.mapId or data
    local src = source
    local targetLobbyId = nil

    for id, lobby in pairs(Lobbies) do
        if lobby.mapId == mapId and lobby.isPersistent then
            targetLobbyId = id
            break
        end
    end

    if targetLobbyId then
        if JoinLobby(src, targetLobbyId) then
            local lobby = Lobbies[targetLobbyId]
            PlayerStates[src].team = 'ffa'
            TriggerClientEvent('ffa:gameStarting', src, lobby)
        end
    end
end)
