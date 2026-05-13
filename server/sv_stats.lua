ESX = exports['es_extended']:getSharedObject()

-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    -- Nutzt ON DUPLICATE KEY UPDATE für performante Speicherung
    -- Wir prüfen ob oxmysql oder mysql-async verwendet wird
    local query = 'INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE kills = kills + ?, deaths = deaths + ?, games_played = games_played + 1, wins = wins + ?'
    local params = { identifier, kills, deaths, isWin and 1 or 0, kills, deaths, isWin and 1 or 0 }

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

    if exports['oxmysql'] then
        exports.oxmysql:fetchSingle(query, { identifier }, function(result)
            if result then TriggerClientEvent('ffa:receiveStats', xPlayer.source, result) end
        end)
    else
        MySQL.Async.fetchAll(query, { identifier }, function(result)
            if result and result[1] then TriggerClientEvent('ffa:receiveStats', xPlayer.source, result[1]) end
        end)
    end
end)
