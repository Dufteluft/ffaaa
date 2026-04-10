local lastVehicle = nil

-- Optimized vehicle spawning
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)

            -- If already in a vehicle, don't spawn
            if not IsPedInAnyVehicle(playerPed, false) then
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)

                if vehicle == 0 then
                    -- Cleanup last vehicle if it's too far
                    if lastVehicle and DoesEntityExist(lastVehicle) then
                        local vCoords = GetEntityCoords(lastVehicle)
                        if #(coords - vCoords) > 50.0 then
                            DeleteEntity(lastVehicle)
                            lastVehicle = nil
                        end
                    end

                    if not lastVehicle or not DoesEntityExist(lastVehicle) then
                        local model = `zentorno`
                        RequestModel(model)
                        while not HasModelLoaded(model) do Wait(10) end

                        local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                        local _, groundZ = GetGroundZFor_3dCoord(spawnPos.x, spawnPos.y, spawnPos.z, 0)

                        lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, groundZ + 0.5, GetEntityHeading(playerPed), true, false)
                        SetVehicleOnGroundProperly(lastVehicle)
                        SetEntityAsMissionEntity(lastVehicle, true, true)
                        SetModelAsNoLongerNeeded(model)
                    end
                end
            end
        elseif lastVehicle and DoesEntityExist(lastVehicle) then
            DeleteEntity(lastVehicle)
            lastVehicle = nil
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
            SetCanAttackFriendly(PlayerPedId(), true, false)
        end
    end
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam then return end

    -- Use Relationship Groups for better Anti-TK
    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    for srvId, team in pairs(teams) do
        local player = GetPlayerFromServerId(srvId)
        if player ~= -1 then
            local ped = GetPlayerPed(player)
            if team == 'blue' then
                SetPedRelationshipGroupHash(ped, `BLUE_TEAM`)
            elseif team == 'red' then
                SetPedRelationshipGroupHash(ped, `RED_TEAM`)
            end
        end
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
end)
