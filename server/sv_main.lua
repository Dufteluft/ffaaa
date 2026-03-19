-- Event: Spielstart durch Host
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 2 Spieler erforderlich für eine Custom Lobby
    if lobby and lobby.host == source and #lobby.players >= 2 then
        lobby.status = 'ACTIVE'
        lobby.timer = lobby.roundTime * 60

        -- Teams zuweisen (Auto-Balance für TDM)
        local blueCount, redCount = 0, 0
        -- Zuerst bestehende Teamwünsche zählen
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps.team == 'blue' then blueCount = blueCount + 1
            elseif ps.team == 'red' then redCount = redCount + 1 end
        end

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if ps.team == 'none' or ps.team == 'random' or ps.team == 'spectator' then
                    if blueCount <= redCount then
                        ps.team = 'blue'
                        blueCount = blueCount + 1
                    else
                        ps.team = 'red'
                        redCount = redCount + 1
                    end
                end
            else
                ps.team = 'ffa' -- Jeder gegen Jeden
            end

            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        -- Synchronisation der Teams für alle Spieler
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

-- Funktion: Timer für laufende Runden
function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'ACTIVE' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby or not lobby.timer then break end

            lobby.timer = lobby.timer - 1

            if lobby.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
            end

            -- Zeit-Sync alle Sekunde an alle Spieler der Lobby
            for _, pid in ipairs(lobby.players) do
                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                TriggerClientEvent('ffa:updateTimer', pid, string.format('%02d:%02d', mins, secs))
            end
        end
    end)
end

-- Funktion: Spielende Logik
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ENDED'
    local winnerName = 'NIEMAND'
    local maxKills = -1
    local winnerTeam = 'none'

    -- Siegermittlung TDM
    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = _U('team_blue')
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = _U('team_red')
            winnerTeam = 'red'
        else
            winnerName = 'UNENTSCHIEDEN'
        end
    -- Siegermittlung FFA
    else
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > maxKills then
                maxKills = ps.kills
                winnerName = ps.name
            end
        end
    end

    -- Statistiken für den Winner-Screen
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

    -- Alle Spieler informieren
    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats
        })

        -- DB-Statistiken aktualisieren
        local ps = PlayerStates[pid]
        if ps then
            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    -- Bei persistenten Lobbys Reset und Neustart
    if lobby.isPersistent then
        Citizen.SetTimeout(15000, function()
            if Lobbies[lobbyId] then
                lobby.status = 'ACTIVE'
                lobby.timer = lobby.roundTime * 60
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                for _, pid in ipairs(lobby.players) do
                    if PlayerStates[pid] and PlayerStates[pid].lobbyId == lobbyId then
                        PlayerStates[pid].kills = 0
                        PlayerStates[pid].deaths = 0
                        TriggerClientEvent('ffa:gameStarting', pid, lobby)
                    end
                end
                StartGameTimer(lobbyId)
            end
        end)
    end
end

-- Event: Kill Registrierung
RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local psVictim = PlayerStates[victim]
    if not psVictim then return end

    local lobby = Lobbies[psVictim.lobbyId]
    if not lobby then return end

    psVictim.deaths = psVictim.deaths + 1

    -- Killer Statistiken
    if killerId and killerId ~= -1 and killerId ~= victim then
        local psKiller = PlayerStates[killerId]
        if psKiller then
            psKiller.kills = psKiller.kills + 1

            -- TDM Punktevergabe
            if lobby.mode == 'tdm' then
                if psKiller.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif psKiller.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            -- Sieg durch Kill-Limit
            if lobby.killLimit > 0 and psKiller.kills >= lobby.killLimit then
                EndGame(psVictim.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    -- HUD-Update an alle betroffenen
    TriggerClientEvent('ffa:updateHUDStats', victim, psVictim.kills, psVictim.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

-- Event: Map Voting am Rundenende
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local ps = PlayerStates[source]
    if ps and ps.lobbyId then
        local lobby = Lobbies[ps.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = mapId
            local map = Utils.GetMapById(mapId)
            if map then lobby.mapLabel = map.label end

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Die Map wurde auf ' .. lobby.mapLabel .. ' geändert.')
            end
        end
    end
end)
