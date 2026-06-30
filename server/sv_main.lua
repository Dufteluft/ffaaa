RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 1 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        local blueCount, redCount = 0, 0
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if pState.team == 'blue' then blueCount = blueCount + 1
            elseif pState.team == 'red' then redCount = redCount + 1 end
        end

        local teams = {}
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pState.team == 'none' or pState.team == 'random' then
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
            teams[pid] = pState.team
        end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
            TriggerClientEvent('ffa:syncTeams', pid, teams)
        end

        StartGameTimer(lobbyId)
    end
end)

function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby then break end

            if lobby.roundTime > 0 then
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
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = _U('draw')
    local maxKills = -1
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = _U('team_blue') .. " " .. _U('wins_suffix')
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = _U('team_red') .. " " .. _U('wins_suffix')
            winnerTeam = 'red'
        end
    else
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > maxKills then
                maxKills = ps.kills
                winnerName = ps.name .. " " .. _U('wins_suffix')
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
            stats = stats
        })

        local ps = PlayerStates[pid]
        if ps then
            local isWin = (winnerTeam ~= 'none' and ps.team == winnerTeam) or (lobby.mode == 'ffa' and ps.name .. " " .. _U('wins_suffix') == winnerName)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    -- Auto-Restart logic for persistent or wait 10s for custom
    Citizen.CreateThread(function()
        Citizen.Wait(10000)
        local lobby = Lobbies[lobbyId]
        if not lobby then return end

        if lobby.isPersistent then
            lobby.status = 'playing'
            lobby.timer = 3600
            lobby.scoreBlue = 0
            lobby.scoreRed = 0
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0
                    ps.deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                    TriggerClientEvent('ffa:syncTeams', pid, {})
                end
            end
            StartGameTimer(lobbyId)
        else
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
            UpdateLobbyPlayers(lobbyId)
        end
    end)
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local victimState = PlayerStates[victim]
    if not victimState then return end

    local lobbyId = victimState.lobbyId
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.status ~= 'playing' then return end

    victimState.deaths = victimState.deaths + 1
    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)

    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState and killerState.lobbyId == lobbyId then
            killerState.kills = killerState.kills + 1

            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            TriggerClientEvent('ffa:updateHUDStats', killerId, killerState.kills, killerState.deaths)

            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(lobbyId, 'Kill-Limit erreicht')
            end
        end
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = mapId
            lobby.mapLabel = Utils.GetMapById(mapId).label
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, _U('system'), 'MAP CHANGED TO ' .. lobby.mapLabel)
                TriggerClientEvent('ffa:syncSettings', pid, lobby)
            end
        end
    end
end)
