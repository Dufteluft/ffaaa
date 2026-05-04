function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL.Async.execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w', {
        ['@id'] = identifier,
        ['@k'] = kills or 0,
        ['@d'] = deaths or 0,
        ['@w'] = isWin and 1 or 0
    })
end

RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL.Async.fetchAll('SELECT * FROM ffa_stats WHERE identifier = @id', {
        ['@id'] = identifier
    }, function(result)
        local stats = {kills = 0, deaths = 0, wins = 0, games_played = 0}
        if result and result[1] then
            stats = result[1]
        end
        TriggerClientEvent('ffa:receiveStats', xPlayer.source, stats)
    end)
end)
