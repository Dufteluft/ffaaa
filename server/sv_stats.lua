function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL.Async.execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w', {
        ['@id'] = identifier,
        ['@k'] = kills,
        ['@d'] = deaths,
        ['@w'] = isWin and 1 or 0
    })
end

RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    MySQL.Async.fetchAll('SELECT * FROM ffa_stats WHERE identifier = @id', {
        ['@id'] = xPlayer.getIdentifier()
    }, function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', src, {
                kills = result[1].kills,
                deaths = result[1].deaths,
                wins = result[1].wins,
                games = result[1].games_played
            })
        else
            TriggerClientEvent('ffa:receiveStats', src, { kills = 0, deaths = 0, wins = 0, games = 0 })
        end
    end)
end)
