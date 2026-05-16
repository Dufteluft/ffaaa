-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local winVal = isWin and 1 or 0

    -- Kompatibilitätsschicht für MySQL-Async / OxMySQL
    local MySQLQuery = 'INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w'
    local params = {
        ['@id'] = identifier,
        ['@k'] = kills,
        ['@d'] = deaths,
        ['@w'] = winVal
    }

    if exports['oxmysql'] then
        exports['oxmysql']:execute(MySQLQuery, params)
    else
        MySQL.Async.execute(MySQLQuery, params)
    end
end

-- Event: Statistiken für UI abrufen
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local sourceId = source

    local MySQLQuery = 'SELECT * FROM ffa_stats WHERE identifier = @id'
    local params = { ['@id'] = identifier }

    local callback = function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', sourceId, result[1])
        end
    end

    if exports['oxmysql'] then
        exports['oxmysql']:query(MySQLQuery, params, callback)
    else
        MySQL.Async.fetchAll(MySQLQuery, params, callback)
    end
end)
