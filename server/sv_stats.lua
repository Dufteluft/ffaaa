-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()
    local winVal = isWin and 1 or 0

    -- Nutzt ON DUPLICATE KEY UPDATE für performante Speicherung
    -- Wir verwenden oxmysql Syntax falls verfügbar, sonst mysql-async
    local query = [[
        INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins)
        VALUES (@id, @k, @d, 1, @w)
        ON DUPLICATE KEY UPDATE
            kills = kills + @k,
            deaths = deaths + @d,
            games_played = games_played + 1,
            wins = wins + @w
    ]]

    MySQL.Async.execute(query, {
        ['@id'] = identifier,
        ['@k'] = kills,
        ['@d'] = deaths,
        ['@w'] = winVal
    }, function(rowsChanged)
        -- Optional: Logging
    end)
end

-- Event: Statistiken für UI abrufen (Könnte für ein Profil-Tab genutzt werden)
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
        else
            -- Standardwerte senden
            TriggerClientEvent('ffa:receiveStats', src, { kills = 0, deaths = 0, games_played = 0, wins = 0 })
        end
    end)
end)
