Utils = {}

-- Funktion: Findet eine Map anhand ihrer ID in der Konfiguration
function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

-- Funktion: Gibt einen zufälligen Spawn-Punkt für eine bestimmte Map zurück
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

-- Funktion: Formatiertes Loggen in der Konsole
function Utils.Print(msg)
    print('^4[FFA Lobby]^0 ' .. tostring(msg))
end

-- Hilfsfunktion: Prüft ob ein Wert in einer Tabelle existiert
function Utils.TableContains(table, element)
    for _, value in pairs(table) do
        if value == element then
            return true
        end
    end
    return false
end
