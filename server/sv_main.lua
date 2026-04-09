RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 1 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0

        local blueCount, redCount = 0, 0
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pState.team == 'none' or pState.team == 'spectator' then
                    if blueCount <= redCount then pState.team = 'blue'; blueCount = blueCount + 1
                    else pState.team = 'red'; redCount = redCount + 1 end
                elseif pState.team == 'blue' then blueCount = blueCount + 1
                elseif pState.team == 'red' then redCount = redCount + 1 end
            else
                pState.team = 'ffa'
            end
            pState.kills = 0
            pState.deaths = 0
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end
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

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = 'Niemand'
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then winnerName = _U('team_blue'); winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then winnerName = _U('team_red'); winnerTeam = 'red'
        else winnerName = 'Unentschieden' end
    else
        local maxKills = -1
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > maxKills then
                maxKills = ps.kills; winnerName = ps.name
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
            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    local voteMaps = {}
    for i=1, 3 do table.insert(voteMaps, Config.Maps[math.random(#Config.Maps)]) end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats,
            voteMaps = voteMaps
        })
    end

    -- Map Voting Session
    lobby.votes = {}
    Citizen.SetTimeout(10000, function()
        if Lobbies[lobbyId] then
            local nextMapId = lobby.mapId
            local maxVotes = -1
            local voteCounts = {}
            for pid, mapId in pairs(lobby.votes) do
                voteCounts[mapId] = (voteCounts[mapId] or 0) + 1
                if voteCounts[mapId] > maxVotes then
                    maxVotes = voteCounts[mapId]; nextMapId = mapId
                end
            end

            lobby.mapId = nextMapId
            local mData = Utils.GetMapById(nextMapId)
            lobby.mapLabel = mData.label

            if lobby.isPersistent then
                lobby.status = 'playing'
                lobby.timer = 1200
                for _, pid in ipairs(lobby.players) do
                    local ps = PlayerStates[pid]
                    ps.kills = 0; ps.deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
                StartGameTimer(lobbyId)
            else
                lobby.status = 'waiting'
                for _, pid in ipairs(lobby.players) do
                    local ps = PlayerStates[pid]
                    ps.ready = (pid == lobby.host)
                end
                UpdateLobbyPlayers(lobbyId)
            end
        end
    end)
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local victimState = PlayerStates[victim]
    if not victimState then return end

    local lobby = Lobbies[victimState.lobbyId]
    if not lobby then return end

    victimState.deaths = victimState.deaths + 1
    if killerId and killerId ~= -1 and killerId ~= victim then
        local kState = PlayerStates[killerId]
        if kState then
            kState.kills = kState.kills + 1
            if lobby.mode == 'tdm' then
                if kState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif kState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end
            if lobby.killLimit > 0 and kState.kills >= lobby.killLimit then
                EndGame(victimState.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then lobby.votes[source] = mapId end
    end
end)
