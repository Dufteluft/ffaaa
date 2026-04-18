-- Fahrzeug-Spawn Logik
Citizen.CreateThread(function()
    local lastVehicle = nil
    while true do
        Citizen.Wait(1000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)

            -- Prüfen ob Spieler bereits ein Fahrzeug hat
            if not lastVehicle or not DoesEntityExist(lastVehicle) then
                local model = GetHashKey(Config.VehicleModel or 'zentorno')
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                lastVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(lastVehicle)
                SetEntityAsMissionEntity(lastVehicle, true, true)
                SetModelAsNoLongerNeeded(model)
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

-- Team-Synchronisation
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))] or teams[GetPlayerServerId(PlayerId())]
    if not myTeam then return end

    -- Relationship Groups für KI/Ziele
    local blueHash = `BLUE_TEAM`
    local redHash = `RED_TEAM`

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueHash)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redHash)
    end

    SetRelationshipBetweenGroups(1, blueHash, blueHash) -- Like
    SetRelationshipBetweenGroups(1, redHash, redHash)
    SetRelationshipBetweenGroups(5, blueHash, redHash) -- Hate
    SetRelationshipBetweenGroups(5, redHash, blueHash)
end)
