-- Gemeinsame Hilfsfunktionen für Client und Server
Utils = {}

/**
 * Findet eine Map-Konfiguration anhand ihrer ID
 * @param {string} id - Die ID der Map
 * @return {table|nil} - Das Map-Objekt oder nil
 */
function Utils.GetMapById(id)
    for _, map in ipairs(Config.Maps) do
        if map.id == id then
            return map
        end
    end
    return nil
end

/**
 * Wählt einen zufälligen Spawnpunkt für eine bestimmte Map aus
 * @param {string} mapId - Die ID der Map
 * @return {vector4|nil} - Die Koordinaten (x,y,z,w) oder nil
 */
function Utils.GetRandomSpawn(mapId)
    local map = Utils.GetMapById(mapId)
    if map and #map.spawns > 0 then
        return map.spawns[math.random(#map.spawns)]
    end
    return nil
end

/**
 * Formatiert eine Nachricht für die Serverkonsole
 * @param {string} msg - Die zu druckende Nachricht
 */
function Utils.Print(msg)
    print('^4[FFA-Lobby]^0 ' .. tostring(msg))
end

/**
 * Hilfsfunktion zum Formatieren von Sekunden in MM:SS
 * @param {number} seconds - Sekunden
 * @return {string} - Formatiertes Zeit-String
 */
function Utils.FormatTime(seconds)
    local mins = math.floor(seconds / 60)
    local secs = seconds % 60
    return string.format('%02d:%02d', mins, secs)
end
