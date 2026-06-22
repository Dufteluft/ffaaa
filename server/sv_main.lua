-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 2 Spieler erforderlich (oder 1 für Tests/Persistent)
    if lobby and (lobby.host == source or lobby.host == -1) then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Auto-Balance für TDM
        if lobby.mode == 'tdm' then
            local bluePlayers = {}
            local redPlayers = {}

            -- Bestehende Zuweisungen sammeln
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps.team == 'blue' then table.insert(bluePlayers, pid)
                elseif ps.team == 'red' then table.insert(redPlayers, pid) end
            end

            -- Restliche Spieler verteilen
            for _, pid in ipairs(lobby.players) do
                local ps = PlayerStates[pid]
                if ps.team == 'none' or ps.team == 'random' or ps.team == 'spectator' then
                    if #bluePlayers <= #redPlayers then
                        ps.team = 'blue'
                        table.insert(bluePlayers, pid)
                    else
                        ps.team = 'red'
                        table.insert(redPlayers, pid)
                    end
                end
            end
        end

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if lobby.mode ~= 'tdm' then ps.team = 'ffa' end

            TriggerClientEvent('ffa:gameStarting', pid, lobby)
            TriggerClientEvent('ffa:syncTeam', pid, ps.team)
        end

        StartGameTimer(lobbyId)
    end
end)

-- Funktion: Startet den Runden-Timer
function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

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

                -- Timer synchronisieren
                local mins = math.floor(lobby.timer / 60)
                local secs = lobby.timer % 60
                local timeStr = string.format('%02d:%02d', mins, secs)
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTimer', pid, timeStr)
                end
            end
        end
    end)
end

-- Funktion: Spiel beenden
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = _U('draw')
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

    -- Neustart für persistente Lobbys
    if lobby.isPersistent then
        Citizen.CreateThread(function()
            Citizen.Wait(10000) -- 10 Sek Winner-Screen
            if Lobbies[lobbyId] then
                lobby.status = 'playing'
                lobby.timer = lobby.roundTime * 60
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
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

-- Event: Spieler getötet
RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vs = PlayerStates[victim]
    if not vs then return end

    local lobby = Lobbies[vs.lobbyId]
    if not lobby then return end

    vs.deaths = vs.deaths + 1

    if killerId and killerId ~= -1 and killerId ~= victim then
        local ks = PlayerStates[killerId]
        if ks then
            ks.kills = ks.kills + 1

            if lobby.mode == 'tdm' then
                if ks.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif ks.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            if lobby.killLimit > 0 and ks.kills >= lobby.killLimit then
                EndGame(vs.lobbyId, 'Kill-Limit erreicht')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, vs.kills, vs.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

-- Event: Map Vote
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby then
            local map = Utils.GetMapById(data.mapId)
            if map then
                lobby.mapId = data.mapId
                lobby.mapLabel = map.label
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Nächste Map: ' .. map.label)
                end
            end
        end
    end
end)
