-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 2 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0

        -- Team Balancing
        local bluePlayers = {}
        local redPlayers = {}

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            ps.kills = 0
            ps.deaths = 0

            if lobby.mode == 'tdm' then
                if ps.team == 'blue' then table.insert(bluePlayers, pid)
                elseif ps.team == 'red' then table.insert(redPlayers, pid)
                else
                    -- Auto-assign random
                    if #bluePlayers <= #redPlayers then
                        ps.team = 'blue'
                        table.insert(bluePlayers, pid)
                    else
                        ps.team = 'red'
                        table.insert(redPlayers, pid)
                    end
                end
            else
                ps.team = 'ffa'
            end

            TriggerClientEvent('ffa:gameStarting', pid, lobby)
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

            if lobby.timer > 0 then
                lobby.timer = lobby.timer - 1

                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                local timeStr = string.format('%02d:%02d', mins, secs)

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTimer', pid, timeStr)
                end
            else
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
            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    -- Match Transition Logic
    Citizen.CreateThread(function()
        Citizen.Wait(10000) -- 10 Sekunden Ergebnis-Anzeige

        local nextLobby = Lobbies[lobbyId]
        if not nextLobby then return end

        -- Map Voting Ergebnis
        local votedMapId = nextLobby.mapId
        local maxVotes = -1
        for mapId, count in pairs(nextLobby.votes) do
            if count > maxVotes then
                maxVotes = count
                votedMapId = mapId
            end
        end

        nextLobby.mapId = votedMapId
        local mapData = Utils.GetMapById(votedMapId)
        nextLobby.mapLabel = mapData and mapData.label or nextLobby.mapLabel
        nextLobby.votes = {}

        if nextLobby.isPersistent then
            nextLobby.status = 'playing'
            nextLobby.timer = nextLobby.roundTime * 60
            nextLobby.scoreBlue = 0
            nextLobby.scoreRed = 0

            for _, pid in ipairs(nextLobby.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0
                    ps.deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, nextLobby)
                end
            end
            StartGameTimer(lobbyId)
        else
            nextLobby.status = 'waiting'
            for _, pid in ipairs(nextLobby.players) do
                TriggerClientEvent('ffa:resetLobby', pid, nextLobby)
            end
        end
    end)
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vState = PlayerStates[victim]
    if not vState then return end

    local lobby = Lobbies[vState.lobbyId]
    if not lobby or lobby.status ~= 'playing' then return end

    vState.deaths = vState.deaths + 1

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
                EndGame(vState.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, vState.kills, vState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            lobby.votes[mapId] = (lobby.votes[mapId] or 0) + 1
        end
    end
end)
