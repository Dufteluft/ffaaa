-- Globaler Namespace für Utilities
Utils = {}

-- Gibt ein Map-Objekt anhand der ID zurück
function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

-- Wählt eine zufällige Spawn-Position für eine Map aus
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and #map.spawns > 0 then
        local index = math.random(1, #map.spawns)
        return map.spawns[index]
    end
    return nil
end

-- Formatiert Zeit in MM:SS String
function Utils.FormatTime(seconds)
    local mins = math.floor(seconds / 60)
    local secs = seconds % 60
    return string.format('%02d:%02d', mins, secs)
end

-- Konsolenausgabe mit Präfix
function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end
