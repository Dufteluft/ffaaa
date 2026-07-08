Utils = {}

-- Funktion: Sucht eine Map anhand ihrer ID in der Konfiguration
-- Gibt die Map-Daten zurück oder nil, wenn nicht gefunden.
function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

-- Funktion: Gibt einen zufälligen Spawn-Punkt für eine bestimmte Map zurück
-- Spawn-Punkte sind als vector4 (x, y, z, heading) definiert.
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

-- Funktion: Einheitliche Konsolenausgabe mit Präfix
-- Hilft beim Debugging und bei Statusmeldungen.
function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end
