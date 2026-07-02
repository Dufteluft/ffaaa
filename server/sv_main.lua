local function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end

RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local src = source
    local state = PlayerStates[src]
    if not state then return end

    local lobby = Lobbies[state.lobbyId]
    if lobby and lobby.host == src then
        -- Check if all players are ready
        local allReady = true
        for _, pid in ipairs(lobby.players) do
            if not PlayerStates[pid].ready then
                allReady = false
                break
            end
        end

        if allReady or lobby.isPersistent then
            lobby.status = 'playing'
            lobby.timer = lobby.roundTime * 60
            lobby.scoreBlue = 0
            lobby.scoreRed = 0

            -- Auto-Balance Teams for TDM
            if lobby.mode == 'tdm' then
                local blue, red = {}, {}
                for _, pid in ipairs(lobby.players) do
                    local ps = PlayerStates[pid]
                    if ps.team == 'blue' then table.insert(blue, pid)
                    elseif ps.team == 'red' then table.insert(red, pid)
                    else
                        if #blue <= #red then
                            ps.team = 'blue'
                            table.insert(blue, pid)
                        else
                            ps.team = 'red'
                            table.insert(red, pid)
                        end
                    end
                end
            else
                for _, pid in ipairs(lobby.players) do
                    PlayerStates[pid].team = 'ffa'
                end
            end

            for _, pid in ipairs(lobby.players) do
                TriggerClientEvent('ffa:gameStarting', pid, lobby)
                TriggerClientEvent('ffa:syncTeam', pid, PlayerStates[pid].team)
            end

            StartGameTimer(state.lobbyId)
        else
            TriggerClientEvent('esx:showNotification', src, 'Nicht alle Spieler sind bereit!')
        end
    end
end)

function StartGameTimer(lobbyId)
    local lobby = Lobbies[lobbyId]
    if not lobby then return end

    if lobby.roundTime == 0 then
        lobby.timer = 3600 -- 1 hour for persistent
    end

    Citizen.CreateThread(function()
        while Lobbies[lobbyId] and Lobbies[lobbyId].status == 'playing' do
            Citizen.Wait(1000)
            local l = Lobbies[lobbyId]
            if not l then break end

            if l.roundTime > 0 then
                l.timer = l.timer - 1
                if l.timer <= 0 then
                    EndGame(lobbyId, 'time')
                    break
                end

                local mins = math.floor(l.timer / 60)
                local secs = l.timer % 60
                local timeStr = string.format('%02d:%02d', mins, secs)
                for _, pid in ipairs(l.players) do
                    TriggerClientEvent('ffa:updateTimer', pid, timeStr)
                end
            end
        end
    end)
end

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
                kd = ps.deaths > 0 and string.format('%.2f', ps.kills/ps.deaths) or tostring(ps.kills)
            })

            local isWin = (ps.name == winnerName or ps.team == winnerTeam)
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a,b) return tonumber(a.kills) > tonumber(b.kills) end)

    for _, pid in ipairs(lobby.players) do
        TriggerClientEvent('ffa:gameEnded', pid, {
            winnerName = winnerName,
            stats = stats
        })
    end

    Citizen.Wait(10000)

    -- Restart or Back to waiting
    if Lobbies[lobbyId] then
        local l = Lobbies[lobbyId]
        l.status = 'waiting'
        l.scoreBlue = 0
        l.scoreRed = 0
        for _, pid in ipairs(l.players) do
            local ps = PlayerStates[pid]
            if ps then
                ps.kills = 0
                ps.deaths = 0
                if l.isPersistent then
                    TriggerClientEvent('ffa:gameStarting', pid, l)
                end
            end
        end
        if l.isPersistent then
            l.status = 'playing'
            l.timer = 3600
            StartGameTimer(lobbyId)
        end
    end
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vState = PlayerStates[victim]
    if not vState then return end

    local lobby = Lobbies[vState.lobbyId]
    if not lobby then return end

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
                EndGame(vState.lobbyId, 'limit')
            end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, vState.kills, vState.deaths)
    if killerId and killerId ~= -1 then
        TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths)
    end
end)

RegisterServerEvent('ffa:voteMap')
AddEventHandler('ffa:voteMap', function(data)
    local src = source
    local state = PlayerStates[src]
    if state then
        local lobby = Lobbies[state.lobbyId]
        if lobby and not lobby.isPersistent then
            lobby.mapId = data.mapId
            local map = Utils.GetMapById(data.mapId)
            lobby.mapLabel = map and map.label or 'Unknown'
        end
    end
end)
