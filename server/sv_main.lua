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

        -- Auto-Balance für TDM
        if lobby.mode == 'tdm' then
            local blueCount, redCount = 0, 0
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps.team == 'blue' then blueCount = blueCount + 1
                elseif ps.team == 'red' then redCount = redCount + 1 end
            end

            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps.team ~= 'blue' and ps.team ~= 'red' and ps.team ~= 'spectator' then
                    if blueCount <= redCount then
                        ps.team = 'blue'
                        blueCount = blueCount + 1
                    else
                        ps.team = 'red'
                        redCount = redCount + 1
                    end
                end
            end
        else
            for _, pid in ipairs(lobby.players) do
                PlayerStates[pid].team = 'ffa'
            end
        end

        local teams = {}
        for _, pid in ipairs(lobby.players) do
            teams[tostring(pid)] = PlayerStates[pid].team
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teams)
        end

        StartGameTimer(lobbyId)
    end
end)

function StartGameTimer(lobbyId)
    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            local lobby = Lobbies[lobbyId]
            if not lobby or lobby.roundTime == 0 then break end

            Citizen.Wait(1000)
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
    if not lobby or lobby.status == 'ended' then return end

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

            local isWin = (winnerName == ps.name) or (ps.team == winnerTeam)
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
        if lobby and not lobby.isPersistent then
            lobby.nextMapId = mapId
            local map = Utils.GetMapById(mapId)
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Vote für Map: ' .. map.label)
            end
        end
    end
end)

RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            -- Wenn nächste Map gewählt wurde, diese setzen
            if lobby.nextMapId then
                lobby.mapId = lobby.nextMapId
                local map = Utils.GetMapById(lobby.mapId)
                lobby.mapLabel = map.label
                lobby.nextMapId = nil
            end

            lobby.status = 'waiting'
            lobby.scoreBlue = 0
            lobby.scoreRed = 0

            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                ps.kills = 0
                ps.deaths = 0
                ps.ready = (pid == lobby.host)
            end

            UpdateLobbyPlayers(state.lobbyId)
        end
    end
end)
