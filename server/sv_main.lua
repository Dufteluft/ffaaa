-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local sourceId = source
    local state = PlayerStates[sourceId]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == sourceId and #lobby.players >= 2 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Spieler Teams zuweisen (Auto-Balance)
        local blueTeam = {}
        local redTeam = {}
        local unassigned = {}

        -- Zuerst bestehende Wünsche und Team-Listen sortieren
        for _, pid in ipairs(lobby.players) do
            local pState = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if pState.team == 'blue' then
                    table.insert(blueTeam, pid)
                elseif pState.team == 'red' then
                    table.insert(redTeam, pid)
                else
                    table.insert(unassigned, pid)
                end
            else
                pState.team = 'ffa'
            end
        end

        -- TDM Auto-Balance für Unentschlossene/Zufällige
        if lobby.mode == 'tdm' then
            for _, pid in ipairs(unassigned) do
                if #blueTeam <= #redTeam then
                    PlayerStates[pid].team = 'blue'
                    table.insert(blueTeam, pid)
                else
                    PlayerStates[pid].team = 'red'
                    table.insert(redTeam, pid)
                end
            end

            -- Falls Teams extrem ungleich sind (z.B. alle wollten Blau), umverteilen
            while math.abs(#blueTeam - #redTeam) > 1 do
                if #blueTeam > #redTeam then
                    local pid = table.remove(blueTeam)
                    PlayerStates[pid].team = 'red'
                    table.insert(redTeam, pid)
                else
                    local pid = table.remove(redTeam)
                    PlayerStates[pid].team = 'blue'
                    table.insert(blueTeam, pid)
                end
            end
        end

        -- Alle Spieler informieren und Teams synchronisieren
        local teamMappings = {}
        for _, pid in ipairs(lobby.players) do
            teamMappings[pid] = PlayerStates[pid].team
        end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:syncTeams', pid, teamMappings)
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        StartGameTimer(lobbyId)
    else
        TriggerClientEvent('esx:showNotification', sourceId, 'Mindestens 2 Spieler erforderlich!')
    end
end)
-- Funktion: Startet den Runden-Timer
function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby or (lobby.roundTime == 0 and not lobby.isPersistent) then return end

    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local currentLobby = Lobbies[lobbyId]
            if not currentLobby then break end

            if currentLobby.roundTime > 0 then
                currentLobby.timer = currentLobby.timer - 1

                if currentLobby.timer <= 0 then
                    EndGame(lobbyId, 'Zeit abgelaufen')
                    break
                end

                -- Timer mit Clients synchronisieren
                local mins = math.floor(currentLobby.timer / 60)
                local secs = currentLobby.timer % 60
                local timeStr = string.format('%02d:%02d', mins, secs)

                for _, pid in ipairs(currentLobby.players) do
                    TriggerClientEvent('ffa:updateTimer', pid, timeStr)
                end
            end

            -- Score Sync (Intervallmäßig oder Event-basiert, hier Intervall für Sicherheit)
            if currentLobby.mode == 'tdm' then
                for _, pid in ipairs(currentLobby.players) do
                    TriggerClientEvent('ffa:updateTDMScore', pid, currentLobby.scoreBlue, currentLobby.scoreRed)
                end
            end
        end
    end)
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

    -- Killer-Statistiken aktualisieren
    if killerId and killerId ~= -1 and killerId ~= victim then
        local killerState = PlayerStates[killerId]
        if killerState then
            killerState.kills = killerState.kills + 1

            -- TDM Score-Sync
            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
            end

            -- Kill-Limit Prüfung
            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then
                EndGame(lobbyId, 'Kill-Limit erreicht')
            end

            -- Individuelles HUD Update
            TriggerClientEvent('ffa:updateHUDStats', killerId, killerState.kills, killerState.deaths)
            TriggerClientEvent('ffa:playSound', killerId, 'kill')
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)
end)
-- Funktion: Spiel beenden und Sieger ermitteln
function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.status == 'ended' then return end

    lobby.status = 'ended'

    local winnerName = _U('draw')
    local winnerTeam = 'none'

    -- Sieg-Logik für TDM
    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then
            winnerName = _U('team_blue')
            winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then
            winnerName = _U('team_red')
            winnerTeam = 'red'
        end
    -- Sieg-Logik für FFA
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

            -- DB-Statistiken aktualisieren
            local isWin = (ps.name == winnerName) or (winnerTeam ~= 'none' and ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
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
    end

    -- Persistent Lobby Restart Logic
    if lobby.isPersistent then
        Citizen.SetTimeout(10000, function()
            local currentLobby = Lobbies[lobbyId]
            if currentLobby then
                currentLobby.status = 'playing'
                currentLobby.timer = currentLobby.roundTime * 60
                currentLobby.scoreBlue = 0
                currentLobby.scoreRed = 0

                for _, pid in ipairs(currentLobby.players) do
                    local ps = PlayerStates[pid]
                    if ps then
                        ps.kills = 0
                        ps.deaths = 0
                        TriggerClientEvent('ffa:gameStarting', pid, currentLobby)
                    end
                end
                StartGameTimer(lobbyId)
            end
        end)
    end
end

-- Event: Map Voting
RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local sourceId = source
    local state = PlayerStates[sourceId]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = data.mapId
            local map = Utils.GetMapById(data.mapId)
            if map then
                lobby.mapLabel = map.label
                -- Chat Nachricht
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Die Map wurde auf ' .. lobby.mapLabel .. ' geändert.')
                end
            end
        end
    end
end)
