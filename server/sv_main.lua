-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 2 Spieler erforderlich (hier 1 für Tests)
    if lobby and lobby.host == source and #lobby.players >= 1 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        lobby.votes = {}

        -- Spieler Teams zuweisen (Auto-Balance)
        local blueCount, redCount = 0, 0
        -- Zuerst bestehende Wünsche zählen
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

            pState.kills = 0
            pState.deaths = 0
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        -- Team-Synchronisation für alle Spieler in der Lobby
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
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.roundTime == 0 then return end -- Kein Timer für unendliche Lobbys

    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby then break end

            lobby.timer = lobby.timer - 1

            if lobby.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
            end

            -- Timer mit Clients synchronisieren
            for _, pid in ipairs(lobby.players) do
                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                TriggerClientEvent('ffa:updateTimer', pid, string.format('%02d:%02d', mins, secs))
            end
        end
    end)
end

-- Funktion: Spiel beenden und Sieger ermitteln
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'

    local winnerName = 'Niemand'
    local maxKills = -1
    local winnerTeam = 'none'

    -- Sieg-Logik für TDM
    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = _U('team_blue')
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = _U('team_red')
            winnerTeam = 'red'
        else
            winnerName = 'Unentschieden'
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
                if PlayerStates[pid] and PlayerStates[pid].lobbyId == lobbyId then
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
        StartGameTimer(lobbyId)
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
        if killerState then
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

-- Event: Map Voting
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobbyId = state.lobbyId
        local lobby = Lobbies[lobbyId]
        if lobby and lobby.status == 'ended' then
            if not lobby.votes then lobby.votes = {} end
            lobby.votes[source] = mapId

            -- Vote-Counts berechnen
            local counts = {}
            for pid, mid in pairs(lobby.votes) do
                counts[mid] = (counts[mid] or 0) + 1
            end

            -- An alle Clients senden (optional für UI-Sync)
            for _, pid in ipairs(lobby.players) do
                -- TriggerClientEvent('ffa:updateVotes', pid, counts)
            end
        end
    end
end)

-- Event: UI schließt Winner Screen / Weiter Button
RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local src = source
    local state = PlayerStates[src]
    if not state or not state.lobbyId then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.status ~= 'ended' then return end

    -- Wenn Host klickt, wird die Map basierend auf Votes geändert und Lobby zurückgesetzt
    if lobby.host == src then
        local counts = {}
        local winnerMap = lobby.mapId
        local maxVotes = 0

        if lobby.votes then
            for pid, mid in pairs(lobby.votes) do
                counts[mid] = (counts[mid] or 0) + 1
                if counts[mid] > maxVotes then
                    maxVotes = counts[mid]
                    winnerMap = mid
                end
            end
        end

        local map = Utils.GetMapById(winnerMap)
        lobby.mapId = winnerMap
        lobby.mapLabel = map.label
        lobby.status = 'waiting'
        lobby.votes = {}

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps then
                ps.ready = (pid == lobby.host)
                ps.kills = 0
                ps.deaths = 0
            end
        end
        UpdateLobbyPlayers(lobbyId)
    end
end)
