Utils = {}

-- Funktion: Holt eine Map anhand ihrer ID aus der Konfiguration
function Utils.GetMapById(id)
    if not Config.Maps then return nil end
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

-- Funktion: Wählt einen zufälligen Spawn-Punkt für eine Map
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and map.spawns and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

-- Funktion: Konsolen-Ausgabe mit Präfix
function Utils.Print(msg)
    print('^4[FFA Lobby System]^0 ' .. tostring(msg))
end
