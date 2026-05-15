-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local winVal = isWin and 1 or 0

    -- Kompatibilität: Prüfen ob oxmysql oder mysql-async genutzt wird
    local query = 'INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE kills = kills + VALUES(kills), deaths = deaths + VALUES(deaths), games_played = games_played + 1, wins = wins + VALUES(wins)'

    if exports['oxmysql'] then
        exports.oxmysql:execute(query, { identifier, kills, deaths, winVal })
    else
        MySQL.Async.execute(query, { identifier, kills, deaths, winVal })
    end
end

-- Event: Statistiken für UI abrufen
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
