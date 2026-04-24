-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
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

                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    local model = GetHashKey(Config.VehicleModel or 'zentorno')
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end

                    lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(lastVehicle)
                    SetEntityAsMissionEntity(lastVehicle, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- HUD-Daten Synchronisation (Leben, Rüstung, Munition)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(250)
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = GetEntityHealth(ped) - 100
            if health < 0 then health = 0 end
            local maxHealth = GetEntityMaxHealth(ped) - 100
            local healthPercent = (health / maxHealth) * 100

            local armor = GetPedArmour(ped)

            local _, currentWeapon = GetCurrentPedWeapon(ped, true)
            local ammo = 0
            if currentWeapon ~= `WEAPON_UNARMED` then
                ammo = GetAmmoInPedWeapon(ped, currentWeapon)
            end

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = healthPercent,
                armor = armor,
                ammo = ammo
            })
        end
    end
end)

-- Anti-Teamkill: Verhindert Schaden an Teammitgliedern
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

-- Native Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))] or teams[GetPlayerServerId(PlayerId())]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), `PLAYER`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- 1 = Like
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`) -- 5 = Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
end)
