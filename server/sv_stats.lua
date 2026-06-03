function UpdatePlayerStats(playerId, kills, deaths, isWin)
    local xPlayer = ESX.GetPlayerFromId(playerId)
    if not xPlayer then return end

    local identifier = xPlayer.getIdentifier()

    local query = [[
        INSERT INTO ffa_stats (identifier, kills, deaths, games_played, wins)
        VALUES (?, ?, ?, 1, ?)
        ON DUPLICATE KEY UPDATE
        kills = kills + ?,
        deaths = deaths + ?,
        games_played = games_played + 1,
        wins = wins + ?
    ]]

    local params = {
        identifier, kills, deaths, (isWin and 1 or 0),
        kills, deaths, (isWin and 1 or 0)
    }

    if exports['oxmysql'] then
        exports.oxmysql:execute(query, params)
    else
        MySQL.Async.execute(query, params)
    end
end

RegisterServerEvent('ffa:getStats')
AddEventHandler('ffa:getStats', function()
    local xPlayer = ESX.GetPlayerFromId(source)
    if not xPlayer then return end

    local query = 'SELECT * FROM ffa_stats WHERE identifier = ?'
    local params = { xPlayer.getIdentifier() }

    local callback = function(result)
        if result and result[1] then
            TriggerClientEvent('ffa:receiveStats', xPlayer.source, result[1])
        end
    end

    if exports['oxmysql'] then
        exports.oxmysql:execute(query, params, callback)
    else
        MySQL.Async.fetchAll(query, params, callback)
    end
end)
