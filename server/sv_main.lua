-- Spielstart
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 2 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Auto-Balance Teams für TDM
        if lobby.mode == 'tdm' then
            local bluePlayers = {}
            local redPlayers = {}
            local neutralPlayers = {}

            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps.team == 'blue' then table.insert(bluePlayers, pid)
                elseif ps.team == 'red' then table.insert(redPlayers, pid)
                else table.insert(neutralPlayers, pid) end
            end

            for _, pid in ipairs(neutralPlayers) do
                if #bluePlayers <= #redPlayers then
                    PlayerStates[pid].team = 'blue'
                    table.insert(bluePlayers, pid)
                else
                    PlayerStates[pid].team = 'red'
                    table.insert(redPlayers, pid)
                end
            end
        end

        local teams = {}
        for _, pid in ipairs(lobby.players) do
            if lobby.mode == 'ffa' then PlayerStates[pid].team = 'ffa' end
            teams[pid] = PlayerStates[pid].team
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teams)
        end

        StartGameTimer(lobbyId)
    else
        TriggerClientEvent('esx:showNotification', source, _U('not_enough_players'))
    end
end)

function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            local lobby = Lobbies[lobbyId]
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
            Wait(1000)
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

            local isWin = (ps.name == winnerName) or (ps.team == winnerTeam and winnerTeam ~= 'none')
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

    -- Voting oder Reset
    Citizen.CreateThread(function()
        -- Map Voting Auswertung
        lobby.votes = lobby.votes or {}
        local voteCounts = {}
        local topMap = lobby.mapId
        local maxVotes = -1

        Wait(10000)

        for _, mapId in pairs(lobby.votes) do
            voteCounts[mapId] = (voteCounts[mapId] or 0) + 1
            if voteCounts[mapId] > maxVotes then
                maxVotes = voteCounts[mapId]
                topMap = mapId
            end
        end

        if topMap ~= lobby.mapId then
            lobby.mapId = topMap
            local map = Utils.GetMapById(topMap)
            if map then lobby.mapLabel = map.label end
        end
        lobby.votes = {}

        if Lobbies[lobbyId] then
            if lobby.isPersistent then
                lobby.status = 'playing'
                lobby.timer = lobby.roundTime * 60
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                for _, pid in ipairs(lobby.players) do
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
                StartGameTimer(lobbyId)
            else
                -- Custom Lobbys zurück in den Wartebereich
                lobby.status = 'waiting'
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                for _, pid in ipairs(lobby.players) do
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    PlayerStates[pid].ready = (pid == lobby.host)
                    TriggerClientEvent('ffa:lobbyJoined', pid, lobby)
                end
            end
        end
    end)
end

-- Kill handling
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            lobby.votes = lobby.votes or {}
            lobby.votes[source] = mapId
        end
    end
end)

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local victimState = PlayerStates[victim]
    if not victimState then return end

    local lobby = Lobbies[victimState.lobbyId]
    if not lobby then return end

    victimState.deaths = victimState.deaths + 1
    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)

    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState then
            killerState.kills = killerState.kills + 1
            TriggerClientEvent('ffa:updateHUDStats', killerId, killerState.kills, killerState.deaths)

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
end)
