Citizen.CreateThread(function()
    local lastVehicle = 0
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            local coords = GetEntityCoords(ped)
            local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)

            if vehicle == 0 then
                if DoesEntityExist(lastVehicle) then DeleteVehicle(lastVehicle) end
                local spawnPos = GetOffsetFromEntityInWorldCoords(ped, 0.0, 15.0, 0.0)
                local model = Config.VehicleModel or `zentorno`
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(ped), true, false)
                SetVehicleOnGroundProperly(lastVehicle)
                SetEntityAsMissionEntity(lastVehicle, true, true)
                SetModelAsNoLongerNeeded(model)
            end
        end
    end
end)

RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam then return end

    if currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
        NetworkSetFriendlyFireOption(false)
        SetCanAttackFriendly(PlayerPedId(), false, false)
    else
        NetworkSetFriendlyFireOption(true)
        SetCanAttackFriendly(PlayerPedId(), true, false)
    end
end)
