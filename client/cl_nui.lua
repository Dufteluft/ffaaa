-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    local lastVehicle = nil
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            if IsPedInAnyVehicle(playerPed, false) then
                -- Spieler ist bereits in einem Fahrzeug
            else
                local coords = GetEntityCoords(playerPed)
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

-- Anti-Teamkill
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            -- FiveM Native für Friendly Fire
            NetworkSetFriendlyFireOption(false)
            SetCanAttackFriendly(PlayerPedId(), false, false)
        else
            NetworkSetFriendlyFireOption(true)
            SetCanAttackFriendly(PlayerPedId(), true, false)
        end
    end
end)

-- Team Synchronisation
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]

    if not myTeam then return end

    -- Relationship Groups für KI und Namensschilder (optional)
    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), `PLAYER`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
end)

-- Sound Effekte vom Server
RegisterNetEvent('ffa:playSound')
AddEventHandler('ffa:playSound', function(soundName)
    SendNUIMessage({
        action = 'playSound',
        sound = soundName
    })
end)

-- HUD-Updater (Health, Armor, Ammo)
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local maxHealth = GetEntityMaxHealth(ped)
            local health = GetEntityHealth(ped)

            -- Prozentuale Berechnung (GTA Health ist oft 200, 100 ist tot)
            local healthPercent = 0
            if maxHealth > 100 then
                healthPercent = math.max(0, math.floor(((health - 100) / (maxHealth - 100)) * 100))
            else
                healthPercent = math.max(0, math.floor((health / maxHealth) * 100))
            end

            local armor = GetPedArmour(ped)
            local weapon = GetSelectedPedWeapon(ped)
            local ammo = GetAmmoInPedWeapon(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = ammo
            })
            Wait(250)
        else
            Wait(1000)
        end
    end
end)
