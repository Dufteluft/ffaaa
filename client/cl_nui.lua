local playerVehicle = nil

-- Fahrzeug-Spawn Logik (wenn in Lobby aktiviert)
Citizen.CreateThread(function()
    while true do
        Citizen.Wait(5000)
        if playerState and playerState.isInGame and currentLobby and currentLobby.vehiclesAllowed then
            local playerPed = PlayerPedId()

            -- Prüfen ob das aktuelle Fahrzeug noch existiert
            if playerVehicle and not DoesEntityExist(playerVehicle) then
                playerVehicle = nil
            end

            if not playerVehicle then
                local spawnPos = GetOffsetFromEntityInWorldCoords(playerPed, 0.0, 5.0, 0.0)
                local model = `zentorno`
                RequestModel(model)
                while not HasModelLoaded(model) do Wait(10) end

                playerVehicle = CreateVehicle(model, spawnPos.x, spawnPos.y, spawnPos.z, GetEntityHeading(playerPed), true, false)
                SetVehicleOnGroundProperly(playerVehicle)
                SetEntityAsMissionEntity(playerVehicle, true, true)
                SetModelAsNoLongerNeeded(model)

                ESX.ShowNotification('Fahrzeug gespawnt!')
            end
        elseif playerVehicle then
            -- Fahrzeug löschen wenn nicht mehr im Spiel oder Fahrzeuge nicht erlaubt
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
        Citizen.Wait(0)
        if playerState and playerState.isInGame and currentLobby and currentLobby.mode == 'tdm' and not currentLobby.friendlyFire then
            local playerPed = PlayerPedId()

            -- Wir nutzen Relationship Groups für eine robuste Lösung
            -- Die Gruppen werden in ffa:syncTeams gesetzt

            -- Zusätzliche Prüfung beim Zielen
            local _, targetPed = GetEntityPlayerIsFreeAimingAt(PlayerId())
            if targetPed and DoesEntityExist(targetPed) and IsEntityAPed(targetPed) and IsPedAPlayer(targetPed) then
                local targetId = NetworkGetPlayerIndexFromPed(targetPed)
                local targetServerId = GetPlayerServerId(targetId)

                -- Wir verlassen uns primär auf Relationship Groups,
                -- aber deaktivieren Friendly Fire Schaden explizit
                SetCanAttackFriendly(playerPed, false, false)
            end
        end
    end
end)

-- Native Anti-Teamkill via Relationship Groups
RegisterNetEvent('ffa:syncTeams')
AddEventHandler('ffa:syncTeams', function(teams)
    local myId = GetPlayerServerId(PlayerId())
    local myTeam = teams[tostring(myId)] or teams[myId]

    if not myTeam then return end

    local _, blueGroup = AddRelationshipGroup('BLUE_TEAM')
    local _, redGroup = AddRelationshipGroup('RED_TEAM')

    if myTeam == 'blue' then
        SetPedRelationshipGroupHash(PlayerPedId(), blueGroup)
    elseif myTeam == 'red' then
        SetPedRelationshipGroupHash(PlayerPedId(), redGroup)
    end

    SetRelationshipBetweenGroups(1, blueGroup, blueGroup) -- 1 = Like
    SetRelationshipBetweenGroups(1, redGroup, redGroup)
    SetRelationshipBetweenGroups(5, blueGroup, redGroup) -- 5 = Hate
    SetRelationshipBetweenGroups(5, redGroup, blueGroup)

    -- Verhindert Schaden innerhalb der eigenen Gruppe
    SetCanAttackFriendly(PlayerPedId(), false, false)
end)
