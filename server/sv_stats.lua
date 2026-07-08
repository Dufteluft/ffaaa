-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
-- Speichert Kills, Tode, gespielte Runden und Siege.
-- Nutzt INSERT ... ON DUPLICATE KEY UPDATE für maximale Performance.
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    -- MySQL.Async.execute (MySQL-Async) oder MySQL.update (oxmysql)
    MySQL.Async.execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w', {
        ['@id'] = identifier,
        ['@k'] = kills,
        ['@d'] = deaths,
        ['@w'] = isWin and 1 or 0
    }, function(rowsChanged)
        if rowsChanged > 0 then
            -- Utils.Print('Statistiken aktualisiert für ' .. xPlayer.getName())
        end
    end)
end

-- Event: Statistiken für das UI abrufen
-- Ermöglicht es Spielern, ihre eigenen Statistiken im Hauptmenü zu sehen (falls implementiert).
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL.Async.fetchAll('SELECT * FROM ffa_stats WHERE identifier = @id', {
        ['@id'] = identifier
    }, function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', xPlayer.source, result[1])
        end
    end)
end)
