-- HUD-Updater: Alle 500ms Leben, Rüstung und Munition an NUI senden
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()

            -- Gesundheit (in Prozent, GTA Standard 100-200 für Ped, 0-100 für HUD)
            local maxHealth = GetEntityMaxHealth(ped)
            local currentHealth = GetEntityHealth(ped)
            local healthPercent = math.floor((currentHealth / maxHealth) * 100)

            -- Rüstung
            local armor = GetPedArmour(ped)

            -- Munition
            local weapon = GetSelectedPedWeapon(ped)
            local ammoInClip = 0
            local totalAmmo = 0

            if weapon ~= `WEAPON_UNARMED` then
                _, ammoInClip = GetAmmoInClip(ped, weapon)
                totalAmmo = GetAmmoInPedWeapon(ped, weapon) - ammoInClip
            end

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = ammoInClip,
                totalAmmo = totalAmmo
            })
        end
        Wait(500)
    end
end)

-- Synchronisation der Teams (wird für TDM benötigt)
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    -- Hier könnten wir Relationship Groups setzen, aber NetworkSetFriendlyFireOption
    -- in cl_gameplay.lua reicht meistens aus für ESX Umgebungen.
end)
