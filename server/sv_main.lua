-- Event: Spielstart
RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local state = PlayerStates[source]
    if not state then return end

    local lobbyId = state.lobbyId
    local lobby = Lobbies[lobbyId]

    if lobby and lobby.host == source and (#lobby.players >= 2 or lobby.isPersistent) then
        lobby.status = 'playing'
        lobby.timer = lobby.roundTime * 60

        -- Teams zuweisen
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

        -- Team-Sync
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

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:updateTimer', pid, Utils.FormatTime(lobby.timer))
            end
        end
    end)
end

function EndGame(lobbyId, reason)
    local lobby = Lobbies[lobbyId]
    if not lobby or lobby.status == 'ended' then return end

    lobby.status = 'ended'
    local winnerName = 'Unbekannt'
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

    local stats = {}
    for _, pid in ipairs(lobby.players) do
        local ps = PlayerStates[pid]
        if ps then
            table.insert(stats, {
                name = ps.name,
                kills = ps.kills,
                deaths = ps.deaths,
                kd = string.format("%.2f", ps.deaths > 0 and ps.kills/ps.deaths or ps.kills + 0.0)
            })

            -- DB Stats
            local isWin = (ps.name == winnerName) or (ps.team == winnerTeam and winnerTeam ~= 'none')
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a,b) return a.kills > b.kills end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, { winnerName = winnerName, stats = stats })
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
                else lobby.scoreRed = lobby.scoreRed + 1 end
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

-- Persistente Lobbies initialisieren
MySQL.ready(function()
    Citizen.Wait(1000)
    for _, map in ipairs(Config.Maps) do
        CreateLobby(-1, {
            name = "FFA " .. map.label,
            mapId = map.id,
            mode = 'ffa',
            loadouts = {'all'},
            roundTime = 0,
            maxPlayers = 32,
            vehiclesAllowed = false,
            friendlyFire = false,
            respawnTime = 3,
            killLimit = 0,
            isPersistent = true
        })
    end
end)
