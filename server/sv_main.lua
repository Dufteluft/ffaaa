-- Event: Spielstart
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 2 Spieler erforderlich für Custom Lobbies
    if lobby and lobby.host == source and (#lobby.players >= 2 or lobby.isPersistent) then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0

        -- Teams zuweisen
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

            pState.kills = 0
            pState.deaths = 0
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        -- Team-Sync
        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end
        for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:syncTeams', pid, teams) end

        if lobby.roundTime > 0 then StartGameTimer(lobbyId) end
    end
end)

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

            for _, pid in ipairs(lobby.players) do
                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                TriggerClientEvent('ffa:updateTimer', pid, string.format('%02d:%02d', mins, secs))
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
        TriggerClientEvent('ffa:gameEnded', pid, { winnerName = winnerName, stats = stats })
        local ps = PlayerStates[pid]
        if ps then
            local isWin = (winnerName == ps.name) or (ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    -- Map Voting Transition (nach 10 Sek)
    Citizen.CreateThread(function()
        Citizen.Wait(10000)
        local lobby = Lobbies[lobbyId]
        if not lobby then return end

        -- Map mit den meisten Votes finden
        local voteCounts = {}
        for _, mapId in pairs(lobby.votes) do
            voteCounts[mapId] = (voteCounts[mapId] or 0) + 1
        end

        local winnerMap = lobby.mapId
        local maxVotes = 0
        for mapId, count in pairs(voteCounts) do
            if count > maxVotes then maxVotes = count; winnerMap = mapId end
        end

        lobby.mapId = winnerMap
        local mapData = Utils.GetMapById(winnerMap)
        lobby.mapLabel = mapData.label
        lobby.votes = {}

        if lobby.isPersistent then
            lobby.status = 'playing'
            lobby.timer = lobby.roundTime * 60
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0; ps.deaths = 0; ps.team = 'ffa'
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
            end
            if lobby.roundTime > 0 then StartGameTimer(lobbyId) end
        else
            lobby.status = 'waiting'
            UpdateLobbyPlayers(lobbyId)
        end
    end)
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local victimState = PlayerStates[victim]
    if not victimState then return end

    local lobby = Lobbies[victimState.lobbyId]
    if not lobby or lobby.status ~= 'playing' then return end

    victimState.deaths = victimState.deaths + 1
    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)

    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState then
            killerState.kills = killerState.kills + 1
            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed) end
            end
            TriggerClientEvent('ffa:updateHUDStats', killerId, killerState.kills, killerState.deaths)
            TriggerClientEvent('ffa:playSound', killerId, { sound = 'kill' })

            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then EndGame(victimState.lobbyId, 'Limit erreicht') end
        end
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then lobby.votes[source] = data.mapId end
    end
end)

RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and lobby.status == 'waiting' then
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)
