-- Event: Spielstart
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 1 then
        -- Bei persistenten Lobbys erlauben wir Start ab 1, bei custom ab 2
        if not lobby.isPersistent and #lobby.players < 2 then
             return
        end

        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0

        -- Team Assignment mit Pre-Counting
        local teams = {}
        local blueCount, redCount = 0, 0

        -- Zuerst gewählte Teams zählen
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if pState.team == 'blue' then blueCount = blueCount + 1
            elseif pState.team == 'red' then redCount = redCount + 1 end
        end

        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pState.team == 'none' or pState.team == 'spectator' or pState.team == 'random' then
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
            teams[tostring(pid)] = pState.team
        end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teams)
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

            if lobby.roundTime > 0 then
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
    if not lobby or lobby.status == 'ended' then return end

    lobby.status = 'ended'
    local winnerName = "Unentschieden"
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = "Team Blau"
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = "Team Rot"
            winnerTeam = 'red'
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

            -- Stats speichern
            local isWin = (ps.name == winnerName) or (ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            stats = stats
        })

        -- Persistent Lobbies: Auto-Restart nach 15s
        if lobby.isPersistent then
            Citizen.CreateThread(function()
                Citizen.Wait(15000)
                if PlayerStates[pid] and PlayerStates[pid].lobbyId == lobbyId then
                    -- Neue Map basierend auf Votes
                    ProcessVotes(lobbyId)
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
            end)
        end
    end

    if lobby.isPersistent then
        Citizen.Wait(15000)
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        lobby.votes = {}
        StartGameTimer(lobbyId)
    end
end

function ProcessVotes(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby or not lobby.votes then return end

    local voteCounts = {}
    local maxVotes = -1
    local winnerMap = lobby.mapId

    for _, mapId in pairs(lobby.votes) do
        voteCounts[mapId] = (voteCounts[mapId] or 0) + 1
        if voteCounts[mapId] > maxVotes then
            maxVotes = voteCounts[mapId]
            winnerMap = mapId
        end
    end

    if winnerMap ~= lobby.mapId then
        lobby.mapId = winnerMap
        local map = Utils.GetMapById(winnerMap)
        lobby.mapLabel = map.label
    end
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victimId = source
    local victimState = PlayerStates[victimId]
    if not victimState then return end

    local lobby = Lobbies[victimState.lobbyId]
    if not lobby or lobby.status ~= 'playing' then return end

    victimState.deaths = victimState.deaths + 1

    if killerId and killerId ~= -1 and killerId ~= victimId then
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
                EndGame(victimState.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victimId, victimState.kills, victimState.deaths)
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
            lobby.votes[tostring(source)] = mapId
        end
    end
end)

RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            -- Zurück in Wartebereich
            lobby.status = 'waiting'
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)
