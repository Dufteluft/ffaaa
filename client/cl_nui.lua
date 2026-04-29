local playerVehicle = nil

-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(2000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()

            if not DoesEntityExist(playerVehicle) then
                local coords = GetEntityCoords(playerPed)
                local model = `zentorno`
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                playerVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(playerVehicle)
                SetEntityAsMissionEntity(playerVehicle, true, true)
                SetModelAsNoLongerNeeded(model)

                TaskWarpPedIntoVehicle(playerPed, playerVehicle, -1)
            end
        elseif playerVehicle then
            if DoesEntityExist(playerVehicle) then
                DeleteEntity(playerVehicle)
            end
            playerVehicle = nil
        end
    end
end)

-- Anti-Teamkill: Verhindert Schaden an Teammitgliedern
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(100)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not (currentLobby.friendlyFire == true) then
            -- Relationship groups are handled in ffa:syncTeams event
        else
            -- Reset relationships if not in TDM or friendly fire is ON
            SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `BLUE_TEAM`)
            SetRelationshipBetweenGroups(5, `RED_TEAM`, `RED_TEAM`)
        end
    end
end)

-- Native Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[GetPlayerServerId(PlayerId())]
    if not myTeam then return end

    AddRelationshipGroup('BLUE_TEAM')
    AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), `BLUE_TEAM`)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), `RED_TEAM`)
    end

    SetRelationshipBetweenGroups(1, `BLUE_TEAM`, `BLUE_TEAM`) -- 1 = Like
    SetRelationshipBetweenGroups(1, `RED_TEAM`, `RED_TEAM`)
    SetRelationshipBetweenGroups(5, `BLUE_TEAM`, `RED_TEAM`) -- 5 = Hate
    SetRelationshipBetweenGroups(5, `RED_TEAM`, `BLUE_TEAM`)
end)
