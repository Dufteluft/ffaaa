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
    if map and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end

-- Localization helper (Global)
function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end
