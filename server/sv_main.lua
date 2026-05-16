-- Registrierung der Server-Events
RegisterServerEvent('ffa:startGame')
RegisterServerEvent('ffa:playerKilled')
RegisterServerEvent('ffa:voteMap')
RegisterServerEvent('ffa:closeWinnerScreen')

-- Event: Spielstart (nur durch Host)
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 2 Spieler erforderlich für Custom Lobbys
    if lobby and lobby.host == source and (#lobby.players >= 2 or lobby.isPersistent) then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0

        -- Spieler Teams zuweisen (Auto-Balance)
        local blueCount, redCount = 0, 0
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if pState.team == 'blue' then blueCount = blueCount + 1
            elseif pState.team == 'red' then redCount = redCount + 1 end
        end

        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if pState then
                pState.kills = 0
                pState.deaths = 0

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
        end

        -- Team-Synchronisation
        local teams = {}
        for _, pid in ipairs(lobby.players) do
            if PlayerStates[pid] then teams[pid] = PlayerStates[pid].team end
        end
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teams)
            TriggerClientEvent('ffa:updateTDMScore', pid, 0, 0)
        end

        if lobby.roundTime > 0 then
            StartGameTimer(lobbyId)
        end
    end
end)

-- Funktion: Startet den Runden-Timer
function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby or lobby.roundTime == 0 then break end

            lobby.timer = lobby.timer - 1

            if lobby.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
            end

            -- Timer mit Clients synchronisieren
            local timeStr = Utils.FormatTime(lobby.timer)
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
            end
        end
    end)
end

-- Funktion: Spiel beenden und Sieger ermitteln
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.status == 'ended' then return end

    lobby.status = 'ended'
    local winnerName = 'Niemand'
    local winnerTeam = 'none'

    -- Sieg-Logik
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
    else
        local maxKills = -1
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > maxKills then
                maxKills = ps.kills
                winnerName = ps.name
            end
        end
    end

    -- Statistiken sammeln und DB Update
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

            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    -- Clients informieren
    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats
        })
    end

    -- Map Voting Initialisierung
    lobby.votes = {}

    -- Automatischer Neustart für persistente Lobbies
    if lobby.isPersistent then
        Citizen.CreateThread(function()
            Citizen.Wait(15000)
            local lobby = Lobbies[lobbyId]
            if not lobby then return end

            local nextMap = lobby.mapId
            local maxVotes = -1
            local counts = {}
            for _, mId in pairs(lobby.votes) do
                counts[mId] = (counts[mId] or 0) + 1
                if counts[mId] > maxVotes then
                    maxVotes = counts[mId]
                    nextMap = mId
                end
            end

            lobby.mapId = nextMap
            lobby.mapLabel = Utils.GetMapById(nextMap).label
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
            if lobby.roundTime > 0 then StartGameTimer(lobbyId) end
        end)
    end
end

-- Event: Spieler wurde getötet
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local victimState = PlayerStates[victim]
    if not victimState then return end

    local lobby = Lobbies[victimState.lobbyId]
    if not lobby or lobby.status ~= 'playing' then return end

    victimState.deaths = victimState.deaths + 1

    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState then
            killerState.kills = killerState.kills + 1
            TriggerClientEvent('ffa:playSound', killerId, { sound = 'kill' })

            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(victimState.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

-- Event: Map Vote empfangen
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            lobby.votes[source] = data.mapId
        end
    end
end)

-- Event: Zurück zur Lobby nach Match
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.status = 'waiting'
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)
