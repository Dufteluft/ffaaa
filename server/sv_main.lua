-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 1 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60
        lobby.scoreBlue = 0
        lobby.scoreRed = 0

        -- Team Zuweisung & Balancing
        local bluePlayers, redPlayers = {}, {}
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pState.team == 'blue' then table.insert(bluePlayers, pid)
                elseif pState.team == 'red' then table.insert(redPlayers, pid)
                else -- Zufall/None
                    if #bluePlayers <= #redPlayers then
                        pState.team = 'blue'
                        table.insert(bluePlayers, pid)
                    else
                        pState.team = 'red'
                        table.insert(redPlayers, pid)
                    end
                end
            else
                pState.team = 'ffa'
            end

            pState.kills = 0
            pState.deaths = 0
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        -- Teams synchronisieren
        local teamAssignments = {}
        for _, pid in ipairs(lobby.players) do
            teamAssignments[pid] = PlayerStates[pid].team
        end
        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teamAssignments)
        end

        StartGameTimer(lobbyId)
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
            Citizen.Wait(1000)
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.status == 'ended' then return end

    lobby.status = 'ended'

    local winnerName = 'none'
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = _U('team_blue')
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = _U('team_red')
            winnerTeam = 'red'
        else
            winnerName = 'none' -- Draw
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

            -- DB Stats
            local isWin = (ps.name == winnerName) or (ps.team == winnerTeam and winnerTeam ~= 'none')
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            stats = stats,
            isPersistent = lobby.isPersistent
        })
    end

    -- Neustart für persistente Lobbys
    if lobby.isPersistent then
        Citizen.SetTimeout(10000, function()
            if Lobbies[lobbyId] then
                lobby.status = 'playing'
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                lobby.timer = lobby.roundTime * 60

                for _, pid in ipairs(lobby.players) do
                    local ps = PlayerStates[pid]
                    if ps then
                        ps.kills = 0
                        ps.deaths = 0
                        TriggerClientEvent('ffa:gameStarting', pid, lobby)
                    end
                end
                StartGameTimer(lobbyId)
            end
        end)
    end
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vState = PlayerStates[victim]
    if not vState then return end

    local lobby = Lobbies[vState.lobbyId]
    if not lobby or lobby.status ~= 'playing' then return end

    vState.deaths = vState.deaths + 1
    TriggerClientEvent('ffa:updateHUDStats', victim, vState.kills, vState.deaths)

    if killerId and killerId ~= -1 and killerId ~= victim then
        local kState = PlayerStates[killerId]
        if kState and kState.lobbyId == vState.lobbyId then
            kState.kills = kState.kills + 1

            if lobby.mode == 'tdm' then
                if kState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif kState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            TriggerClientEvent('ffa:updateHUDStats', killerId, kState.kills, kState.deaths)
            TriggerClientEvent('ffa:playSound', killerId, { sound = 'kill' })

            if lobby.killLimit > 0 and kState.kills >= lobby.killLimit then
                EndGame(vState.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            local map = Utils.GetMapById(data.mapId)
            if map then
                lobby.mapId = map.id
                lobby.mapLabel = map.label
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Nächste Map: ' .. map.label)
                end
            end
        end
    end
end)

RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    -- Client-seitig wird nur die UI geschlossen, Server muss nichts tun außer evtl. Status-Check
end)
