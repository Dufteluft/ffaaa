RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end
    local lobby = Lobbies[state.lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 1 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0

        local teams = {}
        local blueCount, redCount = 0, 0

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if ps.team == 'blue' then blueCount = blueCount + 1
                elseif ps.team == 'red' then redCount = redCount + 1 end
            else
                ps.team = 'ffa'
            end
        end

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if lobby.mode == 'tdm' and (ps.team ~= 'blue' and ps.team ~= 'red') then
                if blueCount <= redCount then ps.team = 'blue'; blueCount = blueCount + 1
                else ps.team = 'red'; redCount = redCount + 1 end
            end
            teams[pid] = ps.team
            TriggerClientEvent('ffa:syncTeam', pid, ps.team)
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:syncTeams', pid, teams) end
        StartGameTimer(state.lobbyId)
    end
end)

function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.roundTime == 0 then return end

    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local l = Lobbies[lobbyId]
            if not l then break end
            l.timer = l.timer - 1

            local mins = math.floor(l.timer / 60)
            local secs = l.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)

            for _, pid in ipairs(l.players) do TriggerClientEvent('ffa:updateTimer', pid, timeStr) end

            if l.timer <= 0 then EndGame(lobbyId, 'Zeit abgelaufen'); break end
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end
    lobby.status = 'ended'

    local winnerName = _U('draw')
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then winnerName = _U('team_blue'); winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then winnerName = _U('team_red'); winnerTeam = 'red' end
    else
        local maxKills = -1
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > maxKills then maxKills = ps.kills; winnerName = ps.name end
        end
    end

    local stats = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        if ps then
            table.insert(stats, {
                name = ps.name, kills = ps.kills, deaths = ps.deaths,
                kd = string.format("%.2f", ps.deaths > 0 and ps.kills/ps.deaths or ps.kills + 0.0)
            })
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        local isWin = (ps.name == winnerName) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
        UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        TriggerClientEvent('ffa:gameEnded', pid, { winnerName = winnerName, stats = stats })

        if lobby.isPersistent then
            Citizen.SetTimeout(10000, function()
                if PlayerStates[pid] and PlayerStates[pid].lobbyId == lobbyId then
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
            end)
        end
    end

    if lobby.isPersistent then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        StartGameTimer(lobbyId)
    end
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vs = PlayerStates[victim]
    if not vs then return end
    local lobby = Lobbies[vs.lobbyId]
    if not lobby then return end

    vs.deaths = vs.deaths + 1
    TriggerClientEvent('ffa:updateHUDStats', victim, vs.kills, vs.deaths)

    if killerId and killerId ~= -1 and killerId ~= victim then
        local ks = PlayerStates[killerId]
        if ks then
            ks.kills = ks.kills + 1
            TriggerClientEvent('ffa:playSound', killerId, 'kill')
            TriggerClientEvent('ffa:updateHUDStats', killerId, ks.kills, ks.deaths)

            if lobby.mode == 'tdm' then
                if ks.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif ks.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed) end
            end

            if lobby.killLimit > 0 and ks.kills >= lobby.killLimit then EndGame(vs.lobbyId, 'Kill-Limit erreicht') end
        end
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local ps = PlayerStates[source]
    if ps and not Lobbies[ps.lobbyId].isPersistent then
        local lobby = Lobbies[ps.lobbyId]
        lobby.mapId = mapId
        local map = Utils.GetMapById(mapId)
        if map then lobby.mapLabel = map.label end
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Map wurde zu ' .. lobby.mapLabel .. ' geändert.')
        end
    end
end)
