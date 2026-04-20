-- Vehicle Spawn Logic (Optimized)
local lastVehicle = nil
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)
            local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)

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
end)

-- Anti-Teamkill
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            NetworkSetFriendlyFireOption(false)
            SetCanAttackFriendly(PlayerPedId(), false, false)
        else
            NetworkSetFriendlyFireOption(true)
            SetCanAttackFriendly(PlayerPedId(), true, true)
        end
    end
end)

-- HUD Data Synchronization
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)
            local healthPercent = math.max(0, math.floor(((health - 100) / (maxHealth - 100)) * 100))

            local armor = GetPedArmour(ped)
            local armorPercent = math.floor((armor / 100) * 100)

            local weapon = GetSelectedPedWeapon(ped)
            local ammoInClip = GetAmmoInClip(ped, weapon)
            local totalAmmo = GetAmmoInPedWeapon(ped, weapon)
            local ammoStr = ammoInClip .. " / " .. (totalAmmo - ammoInClip)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armorPercent,
                ammo = ammoStr
            })
        end
        Wait(500)
    end
end)
