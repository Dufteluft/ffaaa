-- Spielstart Event
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and #lobby.players >= 1 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Teamzuweisung (Auto-Balance für TDM)
        local blueCount, redCount = 0, 0
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pState.team == 'none' or pState.team == 'random' then
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

            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        -- Synchronisiere Teams
        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end
        for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:syncTeams', pid, teams) end

        StartGameTimer(lobbyId)
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

            -- Zeit-Sync
            local mins = math.floor(lobby.timer / 60)
            local secs = lobby.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateHUD', pid, { time = timeStr })
            end
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = 'Unbekannt'
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then winnerName = 'TEAM BLAU'; winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then winnerName = 'TEAM ROT'; winnerTeam = 'red'
        else winnerName = 'UNENTSCHIEDEN' end
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

            -- DB Stats Update
            local isWin = (winnerName == ps.name) or (ps.team == winnerTeam)
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

    -- Lobby zurücksetzen oder löschen nach Zeit
    Citizen.CreateThread(function()
        Citizen.Wait(10000)
        if Lobbies[lobbyId] then
            if Lobbies[lobbyId].isPersistent then
                Lobbies[lobbyId].status = 'playing'
                Lobbies[lobbyId].timer = Lobbies[lobbyId].roundTime * 60
                Lobbies[lobbyId].scoreBlue = 0
                Lobbies[lobbyId].scoreRed = 0
                for _, pid in ipairs(Lobbies[lobbyId].players) do
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, Lobbies[lobbyId])
                end
                StartGameTimer(lobbyId)
            else
                -- Nicht-persistente Lobbys werden wieder in den Warteraum geschickt
                Lobbies[lobbyId].status = 'waiting'
                for _, pid in ipairs(Lobbies[lobbyId].players) do
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    TriggerClientEvent('ffa:lobbyJoined', pid, Lobbies[lobbyId])
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
    if not lobby then return end

    victimState.deaths = victimState.deaths + 1

    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState then
            killerState.kills = killerState.kills + 1

            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateHUD', pid, { scoreBlue = lobby.scoreBlue, scoreRed = lobby.scoreRed })
                end
            end

            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(victimState.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUD', victim, { kills = victimState.kills, deaths = victimState.deaths })
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUD', killerId, { kills = PlayerStates[killerId].kills, deaths = PlayerStates[killerId].deaths })
    end
end)
