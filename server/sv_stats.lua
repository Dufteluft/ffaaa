-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local query = 'INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w'
    local params = {
        ['@id'] = identifier,
        ['@k'] = kills,
        ['@d'] = deaths,
        ['@w'] = isWin and 1 or 0
    }

    -- Kompatibilität für oxmysql und mysql-async
    if exports['oxmysql'] then
        exports.oxmysql:execute(query, params)
    else
        MySQL.Async.execute(query, params)
    end
end

-- Event: Statistiken für UI abrufen
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local query = 'SELECT * FROM ffa_stats WHERE identifier = @id'
    local params = { ['@id'] = identifier }

    local callback = function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', src, result[1])
        end
    end

    if exports['oxmysql'] then
        exports.oxmysql:execute(query, params, callback)
    else
        MySQL.Async.fetchAll(query, params, callback)
    end
end)
