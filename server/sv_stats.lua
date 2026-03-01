-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    -- Nutzt oxmysql oder mysql-async für die Speicherung
    MySQL.Async.execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w', {
        ['@id'] = identifier,
        ['@k'] = kills,
        ['@d'] = deaths,
        ['@w'] = isWin and 1 or 0
    })
end

-- Event: Statistiken für UI abrufen (Optional für späteres Feature)
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL.Async.fetchAll('SELECT * FROM ffa_stats WHERE identifier = @id', {
        ['@id'] = identifier
    }, function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', src, result[1])
        end
    end)
end)
