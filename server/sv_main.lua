-- Server-side Main Logic

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

        SyncLobbyTeams(lobbyId)
        StartGameTimer(lobbyId)
    end
end)

function SyncLobbyTeams(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    local teams = {}
    for _, pid in ipairs(lobby.players) do
        teams[pid] = PlayerStates[pid].team
    end

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:syncTeams', pid, teams)
    end
end

function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby then break end

            if not lobby.isPersistent then
                lobby.timer = lobby.timer - 1
                if lobby.timer <= 0 then
                    EndGame(lobbyId, 'Zeit abgelaufen')
                    break
                end

                local timeStr = Utils.FormatTime(lobby.timer)
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
            winnerName = _U('draw')
            winnerTeam = 'none'
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
                kd = string.format("%.2f", ps.deaths > 0 and ps.kills/ps.deaths or ps.kills)
            })

            -- Update DB Stats
            local isWin = (winnerName == ps.name) or (ps.team == winnerTeam and winnerTeam ~= 'none')
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            stats = stats
        })
    end
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local victimState = PlayerStates[victim]
    if not victimState then return end

    local lobbyId = victimState.lobbyId
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    victimState.deaths = victimState.deaths + 1
    TriggerClientEvent('ffa:playSound', victim, 'death')

    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState then
            killerState.kills = killerState.kills + 1
            TriggerClientEvent('ffa:playSound', killerId, 'kill')

            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)
