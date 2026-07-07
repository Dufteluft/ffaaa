Utils = {}

-- Hilfsfunktion: Gibt Map-Daten anhand der ID zurück
function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

-- Hilfsfunktion: Gibt einen zufälligen Spawn-Punkt einer Map zurück
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

-- Hilfsfunktion: Formatierte Konsolenausgabe
function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end
