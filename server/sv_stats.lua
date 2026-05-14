-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local winVal = isWin and 1 or 0

    -- OxMySQL compatibility check
    local query = 'INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE kills = kills + ?, deaths = deaths + ?, games_played = games_played + 1, wins = wins + ?'
    local params = {identifier, kills, deaths, winVal, kills, deaths, winVal}

    if exports['oxmysql'] then
        exports.oxmysql:execute(query, params)
    else
        MySQL.Async.execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w', {
            ['@id'] = identifier,
            ['@k'] = kills,
            ['@d'] = deaths,
            ['@w'] = winVal
        })
    end
end

-- Event: Statistiken abrufen
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local src = source
    local xPlayer = ESX.GetPlayerFromId(src)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    local fetchQuery = 'SELECT * FROM ffa_stats WHERE identifier = @id'
    MySQL.Async.fetchAll(fetchQuery, {['@id'] = identifier}, function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', src, result[1])
        else
            -- Default stats if none found
            TriggerClientEvent('ffa:receiveStats', src, {kills = 0, deaths = 0, games_played = 0, wins = 0})
        end
    end)
end)
