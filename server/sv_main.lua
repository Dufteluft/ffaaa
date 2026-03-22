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

        -- Auto-Balance und Team-Zuweisung
        local bluePlayers, redPlayers = {}, {}
        local unassigned = {}

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            ps.kills = 0
            ps.deaths = 0

            if lobby.mode == 'tdm' then
                if ps.team == 'blue' then table.insert(bluePlayers, pid)
                elseif ps.team == 'red' then table.insert(redPlayers, pid)
                else table.insert(unassigned, pid) end
            else
                ps.team = 'ffa'
            end
        end

        if lobby.mode == 'tdm' then
            for _, pid in ipairs(unassigned) do
                if #bluePlayers <= #redPlayers then
                    PlayerStates[pid].team = 'blue'
                    table.insert(bluePlayers, pid)
                else
                    PlayerStates[pid].team = 'red'
                    table.insert(redPlayers, pid)
                end
            end
        end

        -- Team-Synchronisation
        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end

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

            if lobby.timer > 0 then
                lobby.timer = lobby.timer - 1
                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                local timeStr = string.format('%02d:%02d', mins, secs)

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTimer', pid, timeStr)
                end

                if lobby.timer <= 0 then
                    EndGame(lobbyId, 'Zeit abgelaufen')
                    break
                end
            end
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = 'Unentschieden'
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = _U('team_blue')
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = _U('team_red')
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

            local isWin = (winnerName == ps.name) or (ps.team == winnerTeam and winnerTeam ~= 'none')
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

    -- Neustart-Logik
    Citizen.CreateThread(function()
        Citizen.Wait(10000)
        local l = Lobbies[lobbyId]
        if not l then return end

        if l.isPersistent then
            l.status = 'playing'
            l.timer = l.roundTime * 60
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
            for _, pid in ipairs(l.players) do
                local ps = PlayerStates[pid]
                if ps then
                    ps.kills = 0
                    ps.deaths = 0
                    ps.ready = (pid == l.host)
                    TriggerClientEvent('ffa:restoreState', pid) -- Bring back to lobby
                    TriggerClientEvent('ffa:lobbyJoined', pid, l)
                end
            end
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

    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState then
            -- Anti-Teamkill (Extra Schutz falls Native versagt)
            if lobby.mode == 'tdm' and not lobby.friendlyFire and killerState.team == victimState.team then
                return
            end

            killerState.kills = killerState.kills + 1
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
        if lobby and not lobby.isPersistent then
            lobby.mapId = mapId
            local map = Utils.GetMapById(mapId)
            if map then
                lobby.mapLabel = map.label
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Die Map für die nächste Runde ist ' .. map.label)
                end
            end
        end
    end
end)
