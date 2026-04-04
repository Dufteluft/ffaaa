-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    -- Nutzt oxmysql Syntax mit positional parameters für bessere Performance
    MySQL.update('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE kills = kills + ?, deaths = deaths + ?, games_played = games_played + 1, wins = wins + ?', {
        identifier, kills, deaths, isWin and 1 or 0, kills, deaths, isWin and 1 or 0
    })
end

-- Event: Statistiken für UI abrufen
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL.fetchAll('SELECT * FROM ffa_stats WHERE identifier = ?', {
        identifier
    }, function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', xPlayer.source, result[1])
        end
    end)
end)
