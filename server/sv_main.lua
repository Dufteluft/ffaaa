-- Event: Spielstart
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

        -- Auto-Balance für TDM
        local blueCount, redCount = 0, 0
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps.team == 'blue' then blueCount = blueCount + 1
            elseif ps.team == 'red' then redCount = redCount + 1 end
        end

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if ps.team == 'none' or ps.team == 'random' then
                    if blueCount <= redCount then
                        ps.team = 'blue'
                        blueCount = blueCount + 1
                    else
                        ps.team = 'red'
                        redCount = redCount + 1
                    end
                end
            else
                ps.team = 'ffa'
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

        if lobby.roundTime > 0 then
            StartGameTimer(lobbyId)
        end
    end
end)

-- Funktion: Runden-Timer
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

            local mins = math.floor(lobby.timer / 60)
            local secs = lobby.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
            end
        end
    end)
end

-- Funktion: Spiel beenden
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'

    local winnerName = 'Niemand'
    local winnerTeam = 'none'

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

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats
        })

        local ps = PlayerStates[pid]
        if ps then
            local isWin = (ps.name == winnerName) or (ps.team == winnerTeam and winnerTeam ~= 'none')
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    -- Persistente Lobbys neu starten
    if lobby.isPersistent then
        Citizen.SetTimeout(10000, function()
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
                if lobby.roundTime > 0 then StartGameTimer(lobbyId) end
            end
        end)
    end
end

-- Event: Spieler getötet
RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vs = PlayerStates[victim]
    if not vs then return end

    local lobbyId = vs.lobbyId
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    vs.deaths = vs.deaths + 1
    TriggerClientEvent('ffa:updateHUDStats', victim, vs.kills, vs.deaths)

    if killerId and killerId ~= -1 and killerId ~= victim then
        local ks = PlayerStates[killerId]
        if ks then
            ks.kills = ks.kills + 1
            TriggerClientEvent('ffa:playSound', killerId, {sound = 'kill'})
            TriggerClientEvent('ffa:updateHUDStats', killerId, ks.kills, ks.deaths)

            if lobby.mode == 'tdm' then
                if ks.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif ks.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            if lobby.killLimit > 0 and ks.kills >= lobby.killLimit then
                EndGame(lobbyId, 'Kill-Limit erreicht')
            end
        end
    end
end)

-- Event: Winner Screen geschlossen
RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local src = source
    local ps = PlayerStates[src]
    if ps then
        ps.kills = 0
        ps.deaths = 0
        local lobby = Lobbies[ps.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.status = 'waiting'
            UpdateLobbyPlayers(ps.lobbyId)
        end
    end
end)

-- Event: Map Voting
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local src = source
    local ps = PlayerStates[src]
    if ps and ps.lobbyId then
        local lobby = Lobbies[ps.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = data.mapId
            local map = Utils.GetMapById(data.mapId)
            if map then lobby.mapLabel = map.label end

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Die Map für die nächste Runde wurde auf ' .. lobby.mapLabel .. ' geändert.')
            end
        end
    end
end)
