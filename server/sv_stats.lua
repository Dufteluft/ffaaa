-- Unterstützung für verschiedene MySQL-Exporte (oxmysql oder mysql-async)
local MySQL_Execute = MySQL.Async.execute
local MySQL_FetchAll = MySQL.Async.fetchAll

if exports['oxmysql'] then
    MySQL_Execute = function(query, params, cb)
        exports.oxmysql:execute(query, params, cb)
    end
    MySQL_FetchAll = function(query, params, cb)
        exports.oxmysql:fetch(query, params, cb)
    end
end

function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL_Execute('INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins) VALUES (@id, @k, @d, 1, @w) ON DUPLICATE KEY UPDATE kills = kills + @k, deaths = deaths + @d, games_played = games_played + 1, wins = wins + @w', {
        ['@id'] = identifier,
        ['@k'] = kills,
        ['@d'] = deaths,
        ['@w'] = isWin and 1 or 0
    }, function(rowsChanged)
        -- Optional: Log Erfolg
    end)
end

RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    MySQL_FetchAll('SELECT * FROM ffa_stats WHERE identifier = @id', {
        ['@id'] = identifier
    }, function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', xPlayer.source, result[1])
        end
    end)
end)
