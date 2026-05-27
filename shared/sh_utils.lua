Utils = {}

-- Gibt Map-Daten anhand der ID zurück
function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

-- Wählt einen zufälligen Spawnpunkt für eine Map aus
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

-- Formatiert Sekunden in MM:SS
function Utils.FormatTime(seconds)
    local mins = math.floor(seconds / 60)
    local secs = seconds % 60
    return string.format('%02d:%02d', mins, secs)
end

-- Konsolen-Logging mit Farbe
function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end
