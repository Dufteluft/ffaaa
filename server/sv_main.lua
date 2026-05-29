-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 2 Spieler erforderlich für Custom Lobbys
    if lobby and lobby.host == source and (#lobby.players >= 2 or lobby.isPersistent) then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Spieler Teams zuweisen (Auto-Balance)
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

        -- Team-Synchronisation
        local teams = {}
        for _, pid in ipairs(lobby.players) do
            teams[pid] = PlayerStates[pid].team
        end
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teams)
        end

        StartGameTimer(lobbyId)
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

            if l.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
            end

            for _, pid in ipairs(l.players) do
                local mins = math.floor(l.timer / 60)
                local secs = l.timer % 60
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
            local state = PlayerStates[pid]
            if state and state.kills > maxKills then
                maxKills = state.kills
                winnerName = state.name
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

            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats
        })
    end

    -- Map Voting Tally nach 10 Sekunden
    Citizen.CreateThread(function()
        Citizen.Wait(10000)
        local l = Lobbies[lobbyId]
        if not l then return end

        local votes = {}
        local maxVotes = 0
        local nextMap = l.mapId

        for pid, mapId in pairs(l.votes) do
            votes[mapId] = (votes[mapId] or 0) + 1
            if votes[mapId] > maxVotes then
                maxVotes = votes[mapId]
                nextMap = mapId
            end
        end

        l.mapId = nextMap
        local map = Utils.GetMapById(nextMap)
        l.mapLabel = map.label
        l.votes = {}

        if l.isPersistent then
            l.status = 'playing'
            l.scoreBlue = 0
            l.scoreRed = 0
            l.timer = l.roundTime * 60

            for _, pid in ipairs(l.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0
                    ps.deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, l)
                end
            end
            StartGameTimer(lobbyId)
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
    if not lobby then return end

    victimState.deaths = victimState.deaths + 1

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

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(mapId)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            lobby.votes[source] = mapId
        end
    end
end)

RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            -- Optional: Reset player state for next round in waiting area
            state.kills = 0
            state.deaths = 0
            state.ready = (source == lobby.host)
            lobby.status = 'waiting'
            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)
