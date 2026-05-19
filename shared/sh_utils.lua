Utils = {}

function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and map.spawns and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end

-- Helper for time formatting
function Utils.FormatTime(seconds)
    local mins = math.floor(seconds / 60)
    local secs = seconds % 60
    return string.format('%02d:%02d', mins, secs)
end
