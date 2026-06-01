-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    -- Compatibility layer for different MySQL providers
    local query = 'INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE kills = kills + ?, deaths = deaths + ?, games_played = games_played + 1, wins = wins + ?'
    local winVal = isWin and 1 or 0
    local params = {identifier, kills, deaths, winVal, kills, deaths, winVal}

    if exports['oxmysql'] then
        exports.oxmysql:execute(query, params)
    else
        MySQL.Async.execute(query, params)
    end
end

-- Event: Statistiken für UI abrufen
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local query = 'SELECT * FROM ffa_stats WHERE identifier = ?'

    local callback = function(result)
        if result then
            -- Oxmysql returns result directly, mysql-async might return array
            local stats = result[1] or result
            if stats and stats.identifier then
                TriggerClientEvent('ffa:receiveStats', xPlayer.source, stats)
            end
        end
    end

    if exports['oxmysql'] then
        exports.oxmysql:fetchSingle(query, {identifier}, callback)
    else
        MySQL.Async.fetchAll(query, {identifier}, callback)
    end
end)
