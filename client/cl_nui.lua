-- cl_nui.lua ist redundant, da cl_lobby.lua die NUI Callbacks behandelt.
-- Wir nutzen diese Datei stattdessen für UI-spezifische Hilfsfunktionen oder löschen sie.
-- Da sie im Manifest steht, lassen wir sie leer oder fügen UI-Sound Trigger hinzu.

RegisterNetEvent('ffa:playSound')
AddEventHandler('ffa:playSound', function(soundName)
    SendNUIMessage({
        action = 'playSound',
        sound = soundName
    })
end)
