-- Event: Spielstart
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 2 then
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
                if ps.team == 'none' or ps.team == 'random' or ps.team == 'spectator' then
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
            TriggerClientEvent('ffa:syncTeam', pid, ps.team) -- Team-Sync für den Client
        end

        StartGameTimer(lobbyId)
    end
end)

-- Funktion: Runden-Timer
function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local l = Lobbies[lobbyId]
            if not l then break end

            l.timer = l.timer - 1

            if l.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
            end

            for _, pid in ipairs(l.players) do
                local mins = math.floor(l.timer / 60)
                local secs = l.timer % 60
                TriggerClientEvent('ffa:updateHUD', pid, { time = string.format('%02d:%02d', mins, secs) })
            end
        end
    end)
end

-- Funktion: Spiel beenden
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'

    local winnerName = _U('random')
    local maxKills = -1
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
        end
    else
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
            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    -- Nach 10 Sekunden zurück in den Wartebereich (oder Restart bei persistent)
    Citizen.CreateThread(function()
        Citizen.Wait(10000)
        local l = Lobbies[lobbyId]
        if not l then return end

        if l.isPersistent then
            l.status = 'playing'
            l.timer = 3600
            l.scoreBlue = 0
            l.scoreRed = 0
            for _, pid in ipairs(l.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0
                    ps.deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, l)
                end
            end
            StartGameTimer(lobbyId)
        else
            l.status = 'waiting'
            l.scoreBlue = 0
            l.scoreRed = 0
            for _, pid in ipairs(l.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0
                    ps.deaths = 0
                    ps.ready = (pid == l.host)
                end
            end
            UpdateLobbyPlayers(lobbyId)
        end
    end)
end

-- Kill Events
RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vState = PlayerStates[victim]
    if not vState then return end

    local lobbyId = vState.lobbyId
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    vState.deaths = vState.deaths + 1

    if killerId and killerId ~= -1 and killerId ~= victim then
        local kState = PlayerStates[killerId]
        if kState then
            kState.kills = kState.kills + 1
            if lobby.mode == 'tdm' then
                if kState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                else lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateHUD', pid, { scoreBlue = lobby.scoreBlue, scoreRed = lobby.scoreRed })
                end
            end

            if lobby.killLimit > 0 and kState.kills >= lobby.killLimit then
                EndGame(lobbyId, 'Kill-Limit reached')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUD', victim, { kills = vState.kills, deaths = vState.deaths })
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUD', killerId, { kills = PlayerStates[killerId].kills, deaths = PlayerStates[killerId].deaths })
    end
end)

-- Map Vote (nach Rundenende)
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = data.mapId
            local map = Utils.GetMapById(data.mapId)
            if map then
                lobby.mapLabel = map.label
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, _U('system'), 'Map changed to ' .. map.label)
                    TriggerClientEvent('ffa:syncSettings', pid, lobby)
                end
            end
        end
    end
end)
