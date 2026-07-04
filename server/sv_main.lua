-- Behandelt den Start eines Spiels (nur für Custom Lobbys relevant)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Prüfung: Nur der Host kann starten, mindestens 2 Spieler erforderlich
    if lobby and lobby.host == source and #lobby.players >= 2 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Auto-Balance Logik für den Team Deathmatch Modus
        if lobby.mode == 'tdm' then
            local bluePlayers = {}
            local redPlayers = {}
            local unassigned = {}

            -- Bestehende Zuweisungen zählen
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps.team == 'blue' then table.insert(bluePlayers, pid)
                elseif ps.team == 'red' then table.insert(redPlayers, pid)
                else table.insert(unassigned, pid) end
            end

            -- Nicht zugewiesene Spieler gleichmäßig verteilen
            for _, pid in ipairs(unassigned) do
                if #bluePlayers <= #redPlayers then
                    PlayerStates[pid].team = 'blue'
                    table.insert(bluePlayers, pid)
                else
                    PlayerStates[pid].team = 'red'
                    table.insert(redPlayers, pid)
                end
            end
        else
            -- Im FFA Modus sind alle im "ffa" Team
            for _, pid in ipairs(lobby.players) do
                PlayerStates[pid].team = 'ffa'
            end
        end

        -- Teams synchronisieren und Spiel für alle Teilnehmer starten
        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teams)
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        StartGameTimer(lobbyId)
    end
end)

-- Thread zur Verwaltung des Runden-Timers einer Lobby
function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby then break end

            lobby.timer = lobby.timer - 1
            -- Ende bei Zeitablauf
            if lobby.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
            end

            -- Synchronisierung des Timers mit allen Clients
            local timeStr = string.format("%02d:%02d", math.floor(lobby.timer / 60), lobby.timer % 60)
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
            end
        end
    end)
end

-- Beendet ein laufendes Spiel, wertet Sieger aus und informiert Spieler
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = "UNENTSCHIEDEN"

    -- Bestimmung des Gewinners basierend auf dem Modus (Team-Score oder Individual-Kills)
    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then winnerName = _U('team_blue')
        elseif lobby.scoreRed > lobby.scoreBlue then winnerName = _U('team_red') end
    else
        local topKills = -1
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > topKills then
                topKills = ps.kills
                winnerName = ps.name
            end
        end
    end

    -- Erfassung der Statistiken für das Scoreboard
    local stats = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        if ps then
            table.insert(stats, {
                name = ps.name,
                kills = ps.kills,
                deaths = ps.deaths,
                kd = (ps.deaths > 0) and string.format("%.2f", ps.kills / ps.deaths) or tostring(ps.kills .. ".00")
            })

            -- Datenbank-Update für den Spieler
            UpdatePlayerStats(pid, ps.kills, ps.deaths, (ps.name == winnerName))
        end
    end
    -- Sortierung der Statistiken nach Kills
    table.sort(stats, function(a, b) return tonumber(a.kills) > tonumber(b.kills) end)

    -- Senden des Sieger-Bildschirms an alle Teilnehmer
    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            stats = stats,
            reason = reason
        })
    end

    -- Logik für den automatischen Neustart von persistenten Lobbys (Tab 1)
    if lobby.isPersistent then
        Citizen.CreateThread(function()
            Citizen.Wait(10000) -- 10 Sekunden Pause für Scoreboard
            if Lobbies[lobbyId] then
                lobby.status = 'playing'
                lobby.timer = lobby.roundTime * 60
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                for _, pid in ipairs(lobby.players) do
                    local ps = PlayerStates[pid]
                    if ps then
                        ps.kills = 0
                        ps.deaths = 0
                        TriggerClientEvent('ffa:gameStarting', pid, lobby)
                    end
                end
                StartGameTimer(lobbyId)
            end
        end)
    end
end

-- Zentrales Event für Kills: Aktualisiert Statistiken und prüft Kill-Limits
RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victimId = source
    local victimState = PlayerStates[victimId]
    if not victimState then return end

    local lobby = Lobbies[victimState.lobbyId]
    if not lobby or lobby.status ~= 'playing' then return end

    victimState.deaths = victimState.deaths + 1

    -- Killer-Statistiken aktualisieren, falls der Killer ein Spieler war
    if killerId and killerId ~= -1 and killerId ~= victimId then
        local killerState = PlayerStates[killerId]
        if killerState then
            killerState.kills = killerState.kills + 1

            -- Team-Score-Aktualisierung für TDM
            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                else lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            -- Beenden, falls ein festgelegtes Kill-Limit erreicht wurde
            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(victimState.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    -- HUD-Update an Opfer und Killer senden
    TriggerClientEvent('ffa:updateHUDStats', victimId, victimState.kills, victimState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

-- Speichert die Map-Wahl eines Spielers für das Map-Voting
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] then
        local lobby = Lobbies[state.lobbyId]
        if not lobby.isPersistent then
            lobby.mapId = data.mapId
            lobby.mapLabel = Utils.GetMapById(data.mapId).label
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Nächste Map wurde gewählt: ' .. lobby.mapLabel)
            end
        end
    end
end)

-- Behandelt das Schließen des Sieger-Bildschirms und bereitet die Lobby auf Neustart vor
RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state and Lobbies[state.lobbyId] then
        local lobby = Lobbies[state.lobbyId]
        if not lobby.isPersistent then
            lobby.status = 'waiting'
            lobby.scoreBlue = 0
            lobby.scoreRed = 0
            state.kills = 0
            state.deaths = 0
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)
