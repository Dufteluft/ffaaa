-- Kompatibilität für oxmysql oder mysql-async
local MySQL_execute = (exports['oxmysql'] ~= nil) and exports['oxmysql'].execute or MySQL.Async.execute
local MySQL_fetchAll = (exports['oxmysql'] ~= nil) and exports['oxmysql'].fetchLimit or MySQL.Async.fetchAll

-- Funktion: Aktualisiert Spieler-Statistiken in der Datenbank
function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    -- Nutzt ON DUPLICATE KEY UPDATE für performante Speicherung
    local query = 'INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (?, ?, ?, 1, ?) ON DUPLICATE KEY UPDATE kills = kills + ?, deaths = deaths + ?, games_played = games_played + 1, wins = wins + ?'

    if exports['oxmysql'] then
        exports.oxmysql:execute(query, {identifier, kills, deaths, (isWin and 1 or 0), kills, deaths, (isWin and 1 or 0)})
    else
        MySQL.Async.execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w', {
            ['@id'] = identifier,
            ['@k'] = kills,
            ['@d'] = deaths,
            ['@w'] = isWin and 1 or 0
        })
    end
end

-- Event: Statistiken für UI abrufen
RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    if exports['oxmysql'] then
        exports.oxmysql:fetchSingle('SELECT * FROM ffa_stats WHERE identifier = ?', {identifier}, function(result)
            if result then
                TriggerClientEvent('ffa:receiveStats', xPlayer.source, result)
            end
        end)
    else
        MySQL.Async.fetchAll('SELECT * FROM ffa_stats WHERE identifier = @id', {
            ['@id'] = identifier
        }, function(result)
            if result and result[1] then
                TriggerClientEvent('ffa:receiveStats', xPlayer.source, result[1])
            end
        end)
    end
end)
