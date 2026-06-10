-- Fahrzeug-Spawn & Anti-Teamkill
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local ped = PlayerPedId()
            if not IsPedInAnyVehicle(ped, false) then
                local coords = GetEntityCoords(ped)
                local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 20.0, 0, 71)

                if vehicle == 0 then
                    local model = GetHashKey('bati')
                    RequestModel(model)
                    while not HasModelLoaded(model) do Wait(0) end

                    if playerVehicle and DoesEntityExist(playerVehicle) then DeleteEntity(playerVehicle) end

                    playerVehicle = CreateVehicle(model, coords.x, coords.y, coords.z, GetEntityHeading(ped), true, false)
                    SetVehicleOnGroundProperly(playerVehicle)
                    SetModelAsNoLongerNeeded(model)
                end
            end
        end
    end
end)

-- Teamkill Schutz via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[myId]
    if not myTeam then return end

    local blueGroup = GetHashKey('FFA_BLUE')
    local redGroup = GetHashKey('FFA_RED')
    local neutralGroup = GetHashKey('FFA_NEUTRAL')

    AddRelationshipGroup('FFA_BLUE')
    AddRelationshipGroup('FFA_RED')
    AddRelationshipGroup('FFA_NEUTRAL')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), neutralGroup)
    end

    -- 1 = Respect/Like, 5 = Hate
    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)
end)
