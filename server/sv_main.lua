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

        -- Teams zuweisen (Auto-Balance)
        local blueCount, redCount = 0, 0
        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if ps.team == 'blue' then blueCount = blueCount + 1
            elseif ps.team == 'red' then redCount = redCount + 1 end
        end

        for _, pid in ipairs(lobby.players) do
            local ps = PlayerStates[pid]
            if lobby.mode == 'tdm' then
                if ps.team == 'none' or ps.team == 'random' or ps.team == 'spectator' then
                    if blueCount <= redCount then
                        ps.team = 'blue'; blueCount = blueCount + 1
                    else
                        ps.team = 'red'; redCount = redCount + 1
                    end
                end
            else
                ps.team = 'ffa'
            end
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        -- Team-Sync für Relationship Groups
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

            -- Timer Sync
            local mins = math.floor(lobby.timer / 60)
            local secs = lobby.timer % 60
            local timeStr = string.format('%02d:%02d', mins, secs)
            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, timeStr)
            end
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    lobby.status = 'ended'
    local winnerName = 'Niemand'
    local maxKills = -1
    local winnerTeam = 'none'

    if lobby.mode == 'tdm' then
        if lobby.scoreBlue > lobby.scoreRed then winnerName = 'Team Blau'; winnerTeam = 'blue'
        elseif lobby.scoreRed > lobby.scoreBlue then winnerName = 'Team Rot'; winnerTeam = 'red'
        else winnerName = 'Unentschieden' end
    else
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

            -- DB Update
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

    if lobby.isPersistent then
        lobby.timer = lobby.roundTime * 60
        lobby.status = 'playing'
        lobby.scoreBlue = 0
        lobby.scoreRed = 0
        StartGameTimer(lobbyId)
    end
end

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

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local mapId = type(data) == 'table' and data.mapId or data
    local state = PlayerStates[source]
    if state and state.lobbyId then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = mapId
            local map = Utils.GetMapById(mapId)
            if map then
                lobby.mapLabel = map.label
                for _, pid in ipairs(lobby.players) do
                    TriggerClientEvent('ffa:addChatMessage', pid, 'SYSTEM', 'Map wurde auf ' .. map.label .. ' geändert.')
                end
            end
        end
    end
end)

RegisterServerEvent('ffa:closeWinnerScreen')
AddEventHandler('ffa:closeWinnerScreen', function()
    local state = PlayerStates[source]
    if state then
        state.kills = 0
        state.deaths = 0
        -- Spieler bleibt in der Lobby (Wartebereich)
    end
end)
