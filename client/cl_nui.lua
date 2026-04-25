-- Performance-Loop für HUD-Daten
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)
            local healthPercent = math.max(0, math.floor(((health - 100) / (maxHealth - 100)) * 100))

            local armor = GetPedArmour(ped)
            local armorPercent = math.min(100, armor)

            local _, ammo = GetAmmoInClip(ped, GetSelectedPedWeapon(ped))

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armorPercent,
                ammo = ammo
            })
        end
        Wait(250) -- Häufigere Updates für flüssige Balken
    end
end)

-- Fahrzeug-Spawn Logik (optimiert)
local lastVehicle = nil
 Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)

            if not IsPedInAnyVehicle(playerPed, false) then
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)
                if vehicle == 0 then
                    if lastVehicle and DoesEntityExist(lastVehicle) then
                        DeleteEntity(lastVehicle)
                    end

                    local model = GetHashKey(Config.VehicleModel or 'zentorno')
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(lastVehicle)
                    SetEntityAsMissionEntity(lastVehicle, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Anti-Teamkill Logik
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            NetworkSetFriendlyFireOption(false)
            SetCanAttackFriendly(PlayerPedId(), false, false)
        else
            NetworkSetFriendlyFireOption(true)
            SetCanAttackFriendly(PlayerPedId(), true, false)
        end
    end
end)

-- NUI Focus Helper
RegisterNetEvent('ffa:gameStarting')
AddEventHandler('ffa:gameStarting', function()
    SetNuiFocus(false, false)
end)
