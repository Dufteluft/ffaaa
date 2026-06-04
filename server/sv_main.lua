RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local ps = PlayerStates[source]
    if not ps then return end

    local lobbyId = ps.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        local blue, red = 0, 0
        for _, pid in ipairs(lobby.players) do
            local pps = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pps.team == 'blue' then blue = blue + 1
                elseif pps.team == 'red' then red = red + 1 end
            end
        end

        for _, pid in ipairs(lobby.players) do
            local pps = PlayerStates[pid]
            if lobby.mode == 'tdm' and (pps.team == 'none' or pps.team == 'spectator') then
                if blue <= red then pps.team = 'blue'; blue = blue + 1
                else pps.team = 'red'; red = red + 1 end
            elseif lobby.mode == 'ffa' then
                pps.team = 'ffa'
            end
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[tostring(pid)] = PlayerStates[pid].team end
        for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:syncTeams', pid, teams) end

        StartGameTimer(lobbyId)
    end
end)

function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby then break end

            lobby.timer = lobby.timer - 1
            local mins, secs = math.floor(lobby.timer / 60), lobby.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
            end

            if lobby.timer <= 0 then
                EndGame(lobbyId, 'Time Up')
                break
            end
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winner = 'None'
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then winner = _U('team_blue'); winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then winner = _U('team_red'); winnerTeam = 'red'
        else winner = _U('draw') end
    else
        local max = -1
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > max then
                max = ps.kills
                winner = ps.name
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
            local isWin = (winner == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, { winnerName = winner, stats = stats })
    end

    -- Map Voting & Restart
    Citizen.CreateThread(function()
        Citizen.Wait(10000)
        if Lobbies[lobbyId] then
            local votes = Lobbies[lobbyId].votes
            local counts = {}
            for _, mapId in pairs(votes) do counts[mapId] = (counts[mapId] or 0) + 1 end

            local nextMap = lobby.mapId
            local maxVotes = -1
            for mid, count in pairs(counts) do
                if count > maxVotes then maxVotes = count; nextMap = mid end
            end

            lobby.mapId = nextMap
            lobby.mapLabel = Utils.GetMapById(nextMap).label
            lobby.status = 'playing'
            lobby.timer = lobby.roundTime * 60
            lobby.scoreBlue, lobby.scoreRed = 0, 0
            lobby.votes = {}

            for _, pid in ipairs(lobby.players) do
                PlayerStates[pid].kills, PlayerStates[pid].deaths = 0, 0
                TriggerClientEvent('ffa:gameStarting', pid, lobby)
            end
            StartGameTimer(lobbyId)
        end
    end)
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vs = PlayerStates[victim]
    if not vs then return end

    local lobby = Lobbies[vs.lobbyId]
    if not lobby then return end

    vs.deaths = vs.deaths + 1
    if killerId and killerId ~= -1 and killerId ~= victim then
        local ks = PlayerStates[killerId]
        if ks then
            ks.kills = ks.kills + 1
            if lobby.mode == 'tdm' then
                if ks.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif ks.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed) end
            end
            if lobby.killLimit > 0 and ks.kills >= lobby.killLimit then EndGame(vs.lobbyId, 'Kill Limit') end
            TriggerClientEvent('ffa:playSound', killerId, 'kill')
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, vs.kills, vs.deaths)
    if killerId and PlayerStates[killerId] then TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths) end
end)
