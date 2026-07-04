Utils = {}

-- Gibt die Map-Daten basierend auf der ID zurück
function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

-- Wählt einen zufälligen Spawn-Punkt für die angegebene Map aus
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and #map.spawns > 0 then
        -- Zufälliger Index aus der Spawns-Tabelle
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

-- Hilfsfunktion für formatierte Konsolen-Ausgaben
function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end
