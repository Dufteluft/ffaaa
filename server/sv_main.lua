-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 2 Spieler erforderlich
    if lobby and lobby.host == source and #lobby.players >= 2 then
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
                if pState.team == 'none' or pState.team == 'random' then
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

-- Funktion: Startet den Runden-Timer
function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.roundTime == 0 then return end

    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local lobby = Lobbies[lobbyId]
            if not lobby then break end

            lobby.timer = lobby.timer - 1

            -- Timer mit Clients synchronisieren
            local mins = math.floor(lobby.timer / 60)
            local secs = lobby.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
            end

            if lobby.timer <= 0 then
                EndGame(lobbyId, _U('time_up'))
                break
            end
        end
    end)
end

-- Funktion: Spiel beenden
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'

    local winnerName = 'Niemand'
    local maxKills = -1
    local winnerTeam = 'none'

    -- Sieg-Logik
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

    -- Statistiken sammeln
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

    -- Clients informieren
    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats
        })

        -- DB-Statistiken aktualisieren
        local ps = PlayerStates[pid]
        if ps then
            local isWin = (winnerName == ps.name) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end

        -- Persistente Lobbys: Reset für Spieler nach 10 Sek
        if lobby.isPersistent then
            Citizen.CreateThread(function()
                Citizen.Wait(10000)
                if PlayerStates[pid] and PlayerStates[pid].lobbyId == lobbyId then
                    PlayerStates[pid].kills = 0
                    PlayerStates[pid].deaths = 0
                    TriggerClientEvent('ffa:gameStarting', pid, lobby)
                end
            end)
        end
    end

    -- Lobby State reset (für nicht persistente)
    if not lobby.isPersistent then
        lobby.status = 'waiting'
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps then
                ps.kills = 0
                ps.deaths = 0
            end
        end
    else
        -- Persistente Lobby reset
        lobby.status = 'playing'
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        StartGameTimer(lobbyId)
    end
end

-- Event: Spieler wurde getötet
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

            -- TDM Scoring
            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end

                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed)
                end
            end

            -- Kill-Limit Check
            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(lobbyId, _U('kill_limit_reached'))
            end
        end
    end

    -- HUD Stats Sync
    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

-- Event: Map Voting (simpel)
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local mapId = data and data.mapId
    local state = PlayerStates[source]
    if state and state.lobbyId and mapId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = mapId
            local map = Utils.GetMapById(mapId)
            if map then
                lobby.mapLabel = map.label
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', _U('map_changed', map.label))
                end
            end
        end
    end
end)
