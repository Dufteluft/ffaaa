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

        -- Teams zuweisen (Auto-Balance für TDM)
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
        for _, pid in ipairs(lobby.players) do teams[pid] = PlayerStates[pid].team end
        for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:syncTeams', pid, teams) end

        StartGameTimer(lobbyId)
    end
end)

function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local l = Lobbies[lobbyId]
            if not l then break end

            l.timer = l.timer - 1
            if l.timer <= 0 then EndGame(lobbyId, 'Zeit abgelaufen') break end

            local mins = math.floor(l.timer / 60)
            local secs = l.timer % 60
            for _, pid in ipairs(l.players) do
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
        if lobby.scoreBlue > lobby.scoreRed then winnerName = _U('team_blue') winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then winnerName = _U('team_red') winnerTeam = 'red'
        else winnerName = 'Unentschieden' end
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
        end
    end
    table.sort(stats, function(a, b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, { winnerName = winnerName, reason = reason, stats = stats })
        local state = PlayerStates[pid]
        if state then
            local isWin = (winnerName == state.name) or (winnerTeam ~= 'none' and state.team == winnerTeam)
            UpdatePlayerStats(pid, state.kills, state.deaths, isWin)
        end
    end

    -- Map Voting Auswertung
    Citizen.CreateThread(function()
        Citizen.Wait(10000) -- Anzeigezeit Winner Screen
        local l = Lobbies[lobbyId]
        if not l then return end

        if MapVotes[lobbyId] then
            local nextMapId = nil
            local maxVotes = -1
            for mapId, count in pairs(MapVotes[lobbyId]) do
                if count > maxVotes then maxVotes = count nextMapId = mapId end
            end
            if nextMapId then
                l.mapId = nextMapId
                local map = Utils.GetMapById(nextMapId)
                if map then l.mapLabel = map.label end
            end
        end
        MapVotes[lobbyId] = nil

        -- Reset für nächste Runde (oder persistente Lobbys)
        l.status = 'waiting'
        l.scoreBlue = 0
        l.scoreRed = 0
        l.timer = l.roundTime * 60

        if l.isPersistent then
            l.status = 'playing'
            for _, pid in ipairs(l.players) do
                local ps = PlayerStates[pid]
                if ps then ps.kills = 0 ps.deaths = 0 TriggerClientEvent('ffa:gameStarting', pid, l) end
            end
            StartGameTimer(lobbyId)
        else
            for _, pid in ipairs(l.players) do
                local ps = PlayerStates[pid]
                if ps then ps.kills = 0 ps.deaths = 0 ps.ready = (pid == l.host) TriggerClientEvent('ffa:returnToLobby', pid, l) end
            end
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
            if lobby.mode == 'tdm' then
                if killerState.team == 'blue' then lobby.scoreBlue = lobby.scoreBlue + 1
                elseif killerState.team == 'red' then lobby.scoreRed = lobby.scoreRed + 1 end
                for _, pid in ipairs(lobby.players) do TriggerClientEvent('ffa:updateTDMScore', pid, lobby.scoreBlue, lobby.scoreRed) end
            end

            if lobby.killLimit > 0 and killerState.kills >= lobby.killLimit then EndGame(lobbyId, 'Kill-Limit erreicht') end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, victimState.kills, victimState.deaths)
    if killerId and killerId ~= -1 and PlayerStates[killerId] then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)
