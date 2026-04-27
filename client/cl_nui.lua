local playerVehicle = nil

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)

            if not playerVehicle or not DoesEntityExist(playerVehicle) then
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)

                if vehicle == 0 then
                    local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                    local model = `zentorno`
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(10) end
                    playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                    SetVehicleOnGroundProperly(playerVehicle)
                    SetEntityAsMissionEntity(playerVehicle, true, true)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        elseif playerVehicle and DoesEntityExist(playerVehicle) then
            DeleteEntity(playerVehicle)
            playerVehicle = nil
        end
    end
end)

Citizen.CreateThread(function()
    while true do
        Citizen.Wait(1000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            NetworkSetFriendlyFireOption(false)
            SetCanAttackFriendly(PlayerPedId(), false, false)
        elseif playerState and playerState.isInGame then
            NetworkSetFriendlyFireOption(true)
            SetCanAttackFriendly(PlayerPedId(), true, false)
        end
    end
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')
    AddRelationshipGroup('FFA_TEAM')

    local ped = PlayerPedId()
    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(ped, `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(ped, `RED_TEAM`)
    else
        SetPedRelationshipGroupHash(ped, `FFA_TEAM`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
    SetRelationshipBetweenGroups(5, `FFA_TEAM`, `FFA_TEAM`)
end)
