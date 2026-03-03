-- sv_main.lua: Handelt den eigentlichen Spielablauf (Timer, Kills, Teams, Ende)

RegisterServerEvent('ffa:startGame')
AddEventHandler('ffa:startGame', function()
    local src = source
    local ps = PlayerStates[src]
    if not ps then return end

    local lobby = Lobbies[ps.lobbyId]
    if lobby and lobby.host == src then
        lobby.status = 'playing'

        -- Team Auto-Balance (TDM)
        if lobby.mode == 'tdm' then
            local b, r = 0, 0
            for _, pid in ipairs(lobby.players) do
                local p = PlayerStates[pid]
                if p.team == 'blue' then b = b + 1
                elseif p.team == 'red' then r = r + 1 end
            end

            for _, pid in ipairs(lobby.players) do
                local p = PlayerStates[pid]
                if p.team ~= 'blue' and p.team ~= 'red' then
                    if b <= r then p.team = 'blue'; b = b + 1 else p.team = 'red'; r = r + 1 end
                end
            end
        end

        for _, pid in ipairs(lobby.players) do
            TriggerClientEvent('ffa:gameStarting', pid, lobby)
        end

        StartGameTimer(ps.lobbyId)
    end
end)

function StartGameTimer(id)
    Citizen.CreateThread(function()
        while Lobbies[id] and Lobbies[id].status == 'playing' and Lobbies[id].timer > 0 do
            Citizen.Wait(1000)
            local l = Lobbies[id]
            if not l then break end
            l.timer = l.timer - 1

            local timeStr = string.format("%02d:%02d", math.floor(l.timer/60), l.timer%60)
            for _, pid in ipairs(l.players) do TriggerClientEvent('ffa:updateTimer', pid, timeStr) end

            if l.timer <= 0 then EndGame(id, 'Zeit abgelaufen') end
        end
    end)
end

function EndGame(id, reason)
    local l = Lobbies[id]
    if not l then return end
    l.status = 'ended'

    local winner = "UNENTSCHIEDEN"
    if l.mode == 'tdm' then
        if l.scoreBlue > l.scoreRed then winner = "TEAM BLAU" elseif l.scoreRed > l.scoreBlue then winner = "TEAM ROT" end
    else
        local topKills, topName = -1, "Niemand"
        for _, pid in ipairs(l.players) do
            local ps = PlayerStates[pid]
            if ps and ps.kills > topKills then topKills = ps.kills; topName = ps.name end
        end
        winner = topName
    end

    local stats = {}
    for _, pid in ipairs(l.players) do
        local ps = PlayerStates[pid]
        if ps then
            table.insert(stats, { name = ps.name, kills = ps.kills, deaths = ps.deaths, kd = string.format("%.2f", (ps.deaths > 0 and ps.kills/ps.deaths or ps.kills)) })
            local isWin = (l.mode == 'ffa' and ps.name == winner) or (l.mode == 'tdm' and ((ps.team == 'blue' and winner == "TEAM BLAU") or (ps.team == 'red' and winner == "TEAM ROT")))
            UpdatePlayerStats(pid, ps.kills, ps.deaths, isWin)
        end
    end
    table.sort(stats, function(a,b) return a.kills > b.kills end)

    for _, pid in ipairs(l.players) do
        TriggerClientEvent('ffa:gameEnded', pid, { winnerName = winner, stats = stats })
    end
end

RegisterServerEvent('ffa:playerKilled')
AddEventHandler('ffa:playerKilled', function(killerId)
    local victim = source
    local vState = PlayerStates[victim]
    if not vState then return end

    local l = Lobbies[vState.lobbyId]
    if not l then return end

    vState.deaths = vState.deaths + 1

    if killerId and killerId ~= -1 and killerId ~= victim then
        local kState = PlayerStates[killerId]
        if kState then
            kState.kills = kState.kills + 1
            if l.mode == 'tdm' then
                if kState.team == 'blue' then l.scoreBlue = l.scoreBlue + 1 else l.scoreRed = l.scoreRed + 1 end
                for _, pid in ipairs(l.players) do TriggerClientEvent('ffa:updateTDMScore', pid, l.scoreBlue, l.scoreRed) end
            end

            if l.killLimit > 0 and kState.kills >= l.killLimit then EndGame(vState.lobbyId, 'Kill-Limit erreicht') end
        end
    end

    TriggerClientEvent('ffa:updateHUDStats', victim, vState.kills, vState.deaths)
    if killerId and killerId ~= -1 then TriggerClientEvent('ffa:updateHUDStats', killerId, PlayerStates[killerId].kills, PlayerStates[killerId].deaths) end
end)

RegisterServerEvent('ffa:sendLobbyChat')
AddEventHandler('ffa:sendLobbyChat', function(data)
    local ps = PlayerStates[source]
    if ps then
        local l = Lobbies[ps.lobbyId]
        if l then for _, pid in ipairs(l.players) do TriggerClientEvent('ffa:addChatMessage', pid, ps.name, data.message) end end
    end
end)
