-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()
            local coords = GetEntityCoords(playerPed)
            local vehicle = GetClosestVehicle(coords.x, coords.y, coords.z, 30.0, 0, 71)

            if vehicle == 0 then
                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 15.0, 0.0)
                local model = GetHashKey('bati') -- Changed from backtick to GetHashKey
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                local veh = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(veh)
                SetEntityAsMissionEntity(veh, true, true)
                SetModelAsNoLongerNeeded(model)

                playerVehicle = veh -- Speichere Fahrzeug handle (global in cl_main)
            end
        end
    end
end)

-- Anti-Teamkill: Verhindert Schaden an Teammitgliedern
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(0)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            local playerPed = PlayerPedId()

            -- Wir nutzen relationship groups für besseres teamplay (siehe syncTeams)
            -- Hier können wir zusätzliche prüfungen einbauen
            SetCanAttackFriendly(playerPed, false, false)
            SetPedCanRagdollFromPlayerImpact(playerPed, false)
        end
    end
end)

-- Native Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myTeam = teams[tostring(GetPlayerServerId(PlayerId()))]
    if not myTeam then return end

    local _, blueGroup = AddRelationshipGroup('FFA_BLUE')
    local _, redGroup = AddRelationshipGroup('FFA_RED')
    local _, neutralGroup = AddRelationshipGroup('FFA_NEUTRAL')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    else
        SetPedRelationshipGroupHash(PlayerPedId(), neutralGroup)
    end

    -- Respect teammates
    SetRelationshipBetweenGroups(1, blueGroup, blueGroup)
    SetRelationshipBetweenGroups(1, redGroup, redGroup)

    -- Hate enemies
    SetRelationshipBetweenGroups(5, blueGroup, redGroup)
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)
end)
