-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    -- Kompatibilitätsschicht für oxmysql und mysql-async
    local MySQL_Execute = MySQL.Async.execute
    if exports['oxmysql'] then
        MySQL_Execute = function(query, params, cb)
            exports['oxmysql']:execute(query, params, cb)
        end
    end

    MySQL_Execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE kills = kills + ?, deaths = deaths + ?, games_played = games_played + 1, wins = wins + ?', {
        identifier, kills, deaths, (isWin and 1 or 0), kills, deaths, (isWin and 1 or 0)
    })
end

-- Event: Statistiken für UI abrufen
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    local MySQL_FetchAll = MySQL.Async.fetchAll
    if exports['oxmysql'] then
        MySQL_FetchAll = function(query, params, cb)
            exports['oxmysql']:execute(query, params, cb)
        end
    end

    MySQL_FetchAll('SELECT * FROM ffa_stats WHERE identifier = ?', { identifier }, function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', xPlayer.source, result[1])
        end
    end)
end)
