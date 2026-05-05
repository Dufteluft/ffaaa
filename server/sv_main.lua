-- server/sv_main.lua

RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state or not state.lobbyId then return end

    local lobby = Lobbies[state.lobbyId]
    if lobby and lobby.host == source and #lobby.players >= 2 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

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

        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end
        for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:syncTeams', pid, teams) end

        StartGameTimer(state.lobbyId)
    end
end)

function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby or lobby.roundTime == 0 then break end

            lobby.timer = lobby.timer - 1
            local mins, secs = math.floor(lobby.timer / 60), lobby.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
            end

            if lobby.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
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
        if lobby.scoreBlue > lobby.scoreRed then winnerName, winnerTeam = _U('team_blue'), 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then winnerName, winnerTeam = _U('team_red'), 'red'
        else winnerName = 'Unentschieden' end
    else
        local maxKills = -1
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > maxKills then
                maxKills, winnerName = ps.kills, ps.name
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
        TriggerClientEvent('ffa:gameEnded', pid, { winnerName = winnerName, stats = stats })
        local ps = PlayerStates[pid]
        if ps then
            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    if lobby.isPersistent then
        Citizen.Wait(10000)
        if Lobbies[lobbyId] then
            lobby.status = 'playing'
            lobby.scoreBlue, lobby.scoreRed = 0, 0
            for _, pid in ipairs(lobby.players) do
                if PlayerStates[pid] then
                    PlayerStates[pid].kills, PlayerStates[pid].deaths = 0, 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
            end
            StartGameTimer(lobbyId)
        end
    end
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vState = PlayerStates[victim]
    if not vState or not vState.lobbyId then return end

    local lobby = Lobbies[vState.lobbyId]
    if not lobby then return end

    vState.deaths = vState.deaths + 1
    if killerId and killerId ~= -1 and killerId ~= victim then
        local kState = PlayerStates[killerId]
        if kState then
            kState.kills = kState.kills + 1
            if lobby.mode == 'tdm' then
                if kState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif kState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed) end
            end
            if lobby.killLimit > 0 and kState.kills >= lobby.killLimit then EndGame(vState.lobbyId, 'Kill-Limit erreicht') end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, vState.kills, vState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = data.mapId
            local map = Utils.GetMapById(data.mapId)
            if map then lobby.mapLabel = map.label end
            for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Map: ' .. lobby.mapLabel) end
        end
    end
end)

RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            state.kills, state.deaths = 0, 0
            state.ready = (source == lobby.host)
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)
