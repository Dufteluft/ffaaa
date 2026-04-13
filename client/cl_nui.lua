-- HUD Daten Synchronisation
Citizen.CreateThread(function()
    while true do
        if playerState and playerState.isInGame then
            local ped = PlayerPedId()
            local health = (GetEntityHealth(ped) - 100)
            if health < 0 then health = 0 end

            local armor = GetPedArmour(ped)
            local currentWeapon = GetSelectedPedWeapon(ped)
            local _, ammo = GetAmmoInClip(ped, currentWeapon)

            SendNUIMessage({
                action = 'updateHUDDetails',
                health = health,
                armor = armor,
                ammo = ammo
            })
        end
        Wait(500)
    end
end)

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

                    local model = GetHashKey(Config.VehicleModel or 'zentorno')
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(0) end

                    local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 5.0, 0.0)
                    lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                    SetVehicleOnGroundProperly(lastVehicle)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Anti-Teamkill
RegisterNetEvent('ffa:initAntiTeamkill')
AddEventHandler('ffa:initAntiTeamkill', function()
    Citizen.CreateThread(function()
        while playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire do
            Citizen.Wait(1000)
            local myId = PlayerId()
            local myTeam = playerState.team

            for _, player in ipairs(GetActivePlayers()) do
                if player ~= myId then
                    local targetServerId = GetPlayerServerId(player)
                    -- Hier müsste eine Team-Liste vom Server vorhanden sein
                    -- Da wir Relationship Groups nutzen, ist das bereits teilweise abgedeckt
                end
            end
        end
    end)
end)

-- Relationship Groups für TDM
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myServerId = GetPlayerServerId(PlayerId())
    playerState.team = teams[myServerId] or 'none'

    local _, blueGroup = AddRelationshipGroup('BLUE_TEAM')
    local _, redGroup = AddRelationshipGroup('RED_TEAM')
    local _, ffaGroup = AddRelationshipGroup('FFA_PLAYERS')

    if playerState.team == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif playerState.team == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), ffaGroup)
    end

    -- Verhalten definieren
    SetRelationshipBetweenGroups(1, blueGroup, blueGroup) -- Respect
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup) -- Hate
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)

    -- Friendly Fire Natives
    if currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
        SetCanAttackFriendly(PlayerPedId(), false, false)
    else
        NetworkSetFriendlyFireOption(true)
        SetCanAttackFriendly(PlayerPedId(), true, false)
    end
end)
