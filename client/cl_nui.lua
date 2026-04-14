-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    local lastVehicle = nil
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) then
                local coords = GetEntityCoords(ped)
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)

                if vehicle == 0 then
                    if lastVehicle and DoesEntityExist(lastVehicle) then
                        DeleteEntity(lastVehicle)
                    end

                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                    lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
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
            NetworkSetFriendlyFireOption(false)
            SetCanAttackFriendly(PlayerPedId(), false, false)
        else
            NetworkSetFriendlyFireOption(true)
            SetCanAttackFriendly(PlayerPedId(), true, false)
        end
    end
end)

-- HUD Data Sync Loop
Citizen.CreateThread(function()
    while true do
        if playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped)
            local maxHealth = GetEntityMaxHealth(ped)
            local healthPercent = math.floor((health / maxHealth) * 100)

            local armor = GetPedArmour(ped)
            local weapon = GetSelectedPedWeapon(ped)
            local _, ammo = GetAmmoInClip(ped, weapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = ammo
            })
        end
        Wait(500)
    end
end)

-- Team Sync for Anti-Teamkill via Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[tostring(myId)]
    if not myTeam then return end

    local blueGroup = `BLUE_TEAM`
    local redGroup = `RED_TEAM`

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    end

    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)
end)
