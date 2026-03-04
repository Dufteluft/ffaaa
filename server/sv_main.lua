-- Event: Spielstart (nur durch Host)
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    -- Mindestens 1 Spieler zum Testen, sonst 2
    if lobby and lobby.host == source and #lobby.players >= 1 then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Teams zuweisen
        local blueCount, redCount = 0, 0
        if lobby.mode == 'tdm' then
            for _, pid in ipairs(lobby.players) do
                local pState = PlayerStates[pid]
                if pState.team == 'blue' then blueCount = blueCount + 1
                elseif pState.team == 'red' then redCount = redCount + 1 end
            end
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

        -- Sync Teams
        local teams = {}
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end
        for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:syncTeams', pid, teams) end

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
            local currentLobby = Lobbies[lobbyId]
            if not currentLobby then break end

            currentLobby.timer = currentLobby.timer - 1

            if currentLobby.timer <= 0 then
                EndGame(lobbyId, 'Zeit abgelaufen')
                break
            end

            -- Timer sync
            local mins = math.floor(currentLobby.timer / 60)
            local secs = currentLobby.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)
            for _, pid in ipairs(currentLobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
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

    -- Stats sammeln
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

    -- Informieren und Speichern
    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            reason = reason,
            stats = stats
        })

        local state = PlayerStates[pid]
        if state then
            local isWin = (winnerName == state.name) or (winnerTeam ~= 'none' and state.team == winnerTeam)
            UpdatePlayerStats(pid, state.kills, state.deaths, isWin)
        end
    end

    -- Persistente Lobbys neu starten
    if lobby.isPersistent then
        Citizen.CreateThread(function()
            Citizen.Wait(10000)
            if Lobbies[lobbyId] then
                lobby.status = 'playing'
                lobby.scoreBlue = 0
                lobby.scoreRed = 0
                for _, pid in ipairs(lobby.players) do
                    if PlayerStates[pid] and PlayerStates[pid].lobbyId == lobbyId then
                        PlayerStates[pid].kills = 0
                        PlayerStates[pid].deaths = 0
                        TriggerClientEvent('ffa:gameStarting', pid, lobby)
                    end
                end
                StartGameTimer(lobbyId)
            end
        end)
    else
        -- Custom Lobbys in den Wartemodus versetzen (Spieler können zurückkehren)
        lobby.status = 'waiting'
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        for _, pid in ipairs(lobby.players) do
            if PlayerStates[pid] then
                PlayerStates[pid].kills = 0
                PlayerStates[pid].deaths = 0
                PlayerStates[pid].ready = (pid == lobby.host)
            end
        end
        UpdateLobbyPlayers(lobbyId)
    end
end

-- Event: Rückkehr zur Lobby-Wartefläche
RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if not state or not state.lobbyId then return end

    local lobby = Lobbies[state.lobbyId]
    if lobby and not lobby.isPersistent then
        -- Teleportiere zurück zur Ausgangsposition (Ende des Spielmodus)
        TriggerClientEvent('ffa:restoreState', source, state.oldCoords)

        -- Da restoreState das NUI schließt, müssen wir die Lobby-UI wieder öffnen
        Citizen.Wait(1500)
        TriggerClientEvent('ffa:lobbyJoined', source, lobby)
        UpdateLobbyPlayers(state.lobbyId)
    end
end)

-- Event: Kill
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
