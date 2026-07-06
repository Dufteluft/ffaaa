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

        local teams = {}
        local blueCount, redCount = 0, 0

        -- Auto-Balance
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
                elseif pState.team == 'blue' then blueCount = blueCount + 1
                elseif pState.team == 'red' then redCount = redCount + 1 end
            else
                pState.team = 'ffa'
            end
            teams[tostring(pid)] = pState.team
        end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
            TriggerClientEvent('ffa:syncTeams', pid, teams)
        end

        StartGameTimer(lobbyId)
    end
end)

-- Runden-Timer
function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

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

            for _, pid in ipairs(lobby.players) do
                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                TriggerClientEvent('ffa:updateTimer', pid, string.format('%02d:%02d', mins, secs))
            end
        end
    end)
end

-- Spiel beenden
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = 'Niemand'
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = 'TEAM BLAU'
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = 'TEAM ROT'
            winnerTeam = 'red'
        else
            winnerName = 'UNENTSCHIEDEN'
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
            stats = stats
        })

        local ps = PlayerStates[pid]
        if ps then
            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end

    -- Persistent Lobby Neustart
    if lobby.isPersistent then
        Citizen.CreateThread(function()
            Citizen.Wait(10000)
            if Lobbies[lobbyId] then
                lobby.status = 'playing'
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                lobby.timer = 3600
                for _, pid in ipairs(lobby.players) do
                    local ps = PlayerStates[pid]
                    if ps then
                        ps.kills, ps.deaths = 0, 0
                        TriggerClientEvent('ffa:gameStarting', pid, lobby)
                    end
                end
                StartGameTimer(lobbyId)
            end
        end)
    else
        -- Custom Lobby Reset nach 10s
        Citizen.CreateThread(function()
            Citizen.Wait(10000)
            if Lobbies[lobbyId] then
                lobby.status = 'waiting'
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                for _, pid in ipairs(lobby.players) do
                    local ps = PlayerStates[pid]
                    if ps then
                        ps.kills, ps.deaths = 0, 0
                        ps.ready = (pid == lobby.host)
                    end
                end
                UpdateLobbyPlayers(lobbyId)
            end
        end)
    end
end

-- Kill Event
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

-- Map Vote
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
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', string.format('Die Map wurde auf %s geändert.', map.label))
                    TriggerClientEvent('ffa:syncSettings', pid, lobby)
                end
            end
        end
    end
end)
