Config = {}

Config.Locale = 'de' -- 'de' oder 'en'
Config.MenuKey = 'F5' -- Standardtaste für das Hauptmenü

Config.DefaultSettings = {
    roundTime = 15, -- Minuten
    maxPlayers = 16,
    respawnTime = 5, -- Sekunden
    killLimit = 30,
    friendlyFire = false,
    vehiclesAllowed = false
}

Config.WeaponLoadouts = {
    ['pistol'] = {
        { name = 'WEAPON_PISTOL', label = 'Pistole', ammo = 250 },
        { name = 'WEAPON_COMBATPISTOL', label = 'Kampfpistole', ammo = 250 }
    },
    ['smg'] = {
        { name = 'WEAPON_SMG', label = 'SMG', ammo = 250 },
        { name = 'WEAPON_COMBATMG', label = 'Kampf-MG', ammo = 250 }
    },
    ['assault'] = {
        { name = 'WEAPON_ASSAULTRIFLE', label = 'Sturmgewehr', ammo = 250 },
        { name = 'WEAPON_CARBINERIFLE', label = 'Karabiner', ammo = 250 }
    },
    ['sniper'] = {
        { name = 'WEAPON_SNIPERRIFLE', label = 'Scharfschützengewehr', ammo = 50 },
        { name = 'WEAPON_HEAVYSNIPER', label = 'Schweres Scharfschützengewehr', ammo = 50 }
    },
    ['shotgun'] = {
        { name = 'WEAPON_PUMPSHOTGUN', label = 'Pump-Action', ammo = 50 },
        { name = 'WEAPON_SAWNOFFSHOTGUN', label = 'Abgesägte Schrotflinte', ammo = 50 }
    },
    ['all'] = {
        { name = 'WEAPON_PISTOL', label = 'Pistole', ammo = 250 },
        { name = 'WEAPON_SMG', label = 'SMG', ammo = 250 },
        { name = 'WEAPON_ASSAULTRIFLE', label = 'Sturmgewehr', ammo = 250 },
        { name = 'WEAPON_SNIPERRIFLE', label = 'Scharfschützengewehr', ammo = 50 },
        { name = 'WEAPON_PUMPSHOTGUN', label = 'Pump-Action', ammo = 50 }
    }
}

Config.Maps = {
    {
        id = 'legion',
        label = 'Würfelpark',
        center = vector3(185.0, -930.0, 30.6),
        radius = 100.0,
        spawns = {
            vector4(167.0, -929.0, 30.6, 180.0),
            vector4(185.0, -912.0, 30.6, 90.0),
            vector4(203.0, -930.0, 30.6, 0.0),
            vector4(185.0, -948.0, 30.6, 270.0)
        }
    },
    {
        id = 'sandyshores',
        label = 'Sandy Shores',
        center = vector3(1850.0, 3680.0, 34.0),
        radius = 150.0,
        spawns = {
            vector4(1820.0, 3680.0, 34.0, 90.0),
            vector4(1880.0, 3680.0, 34.0, 270.0),
            vector4(1850.0, 3650.0, 34.0, 0.0),
            vector4(1850.0, 3710.0, 34.0, 180.0)
        }
    },
    {
        id = 'airport',
        label = 'Flughafen',
        center = vector3(-1037.0, -2737.0, 20.1),
        radius = 200.0,
        spawns = {
            vector4(-1060.0, -2730.0, 20.1, 90.0),
            vector4(-1010.0, -2730.0, 20.1, 270.0),
            vector4(-1035.0, -2700.0, 20.1, 0.0),
            vector4(-1035.0, -2760.0, 20.1, 180.0)
        }
    },
    {
        id = 'vinewood',
        label = 'Vinewood',
        center = vector3(630.0, 560.0, 128.0),
        radius = 120.0,
        spawns = {
            vector4(610.0, 560.0, 128.0, 90.0),
            vector4(650.0, 560.0, 128.0, 270.0),
            vector4(630.0, 540.0, 128.0, 0.0),
            vector4(630.0, 580.0, 128.0, 180.0)
        }
    },
    {
        id = 'port',
        label = 'Hafen',
        center = vector3(770.0, -2980.0, 6.0),
        radius = 150.0,
        spawns = {
            vector4(740.0, -2980.0, 6.0, 90.0),
            vector4(800.0, -2980.0, 6.0, 270.0),
            vector4(770.0, -2950.0, 6.0, 0.0),
            vector4(770.0, -3010.0, 6.0, 180.0)
        }
    }
}

Config.Locales = {
    ['de'] = {
        ['menu_title'] = 'FFA LOBBY SYSTEM',
        ['tab_ffa'] = 'FFA Lobby',
        ['tab_create'] = 'Lobby erstellen',
        ['tab_list'] = 'Offene Lobbys',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Map auswählen',
        ['mode_select'] = 'Spielmodus',
        ['loadout_select'] = 'Waffen-Loadout',
        ['round_time'] = 'Rundenzeit',
        ['max_players'] = 'Max. Spieler',
        ['vehicles_allowed'] = 'Fahrzeuge erlaubt',
        ['friendly_fire'] = 'Freundliches Feuer',
        ['respawn_time'] = 'Respawn-Zeit',
        ['kill_limit'] = 'Kill-Limit',
        ['btn_create'] = 'Lobby erstellen',
        ['btn_cancel'] = 'Abbrechen',
        ['btn_join'] = 'Beitreten',
        ['btn_ready'] = 'Bereit',
        ['btn_start'] = 'Spiel starten',
        ['btn_leave'] = 'Lobby verlassen',
        ['btn_kick'] = 'Kicken',
        ['team_blue'] = 'Team Blau',
        ['team_red'] = 'Team Rot',
        ['spectator'] = 'Zuschauer',
        ['random'] = 'Zufall',
        ['waiting_for_players'] = 'Warte auf Spieler...',
        ['countdown'] = 'Start in %s Sekunden',
        ['game_ended'] = 'Runde beendet!',
        ['winner'] = 'Gewinner: %s',
        ['kills'] = 'Kills',
        ['deaths'] = 'Tode',
        ['kd_ratio'] = 'K/D',
        ['score'] = 'Score',
        ['health'] = 'Leben',
        ['armor'] = 'Rüstung',
        ['ammo'] = 'Munition',
        ['time_left'] = 'Zeit übrig',
        ['no_lobbies'] = 'Keine Lobbys gefunden.',
        ['lobby_full'] = 'Lobby ist voll!',
        ['joining'] = 'Trete bei...',
        ['starting'] = 'Startet...',
        ['round_starting'] = 'Runde startet in 10 Sekunden',
        ['area_warning'] = 'Du verlässt das Kampfgebiet!',
        ['weapon_prohibited'] = 'Diese Waffe ist hier verboten!',
        ['all_maps'] = 'ALLE MAPS',
        ['lobby_full_btn'] = 'VOLL',
        ['quick_join_btn'] = 'SOFORT-START',
        ['countdown_prepare'] = 'BEREITMACHEN!',
        ['btn_back_to_lobby'] = 'ZURÜCK ZUR LOBBY',
        ['btn_back_to_menu'] = 'HAUPTMENÜ',
        ['draw'] = 'UNENTSCHIEDEN',
        ['time_up'] = 'Zeit abgelaufen',
        ['kill_limit_reached'] = 'Kill-Limit erreicht',
        ['kicked'] = 'Du wurdest aus der Lobby gekickt.',
        ['map_changed'] = 'Map wurde geändert auf: %s'
    },
    ['en'] = {
        ['menu_title'] = 'FFA LOBBY SYSTEM',
        ['tab_ffa'] = 'FFA Lobby',
        ['tab_create'] = 'Create Lobby',
        ['tab_list'] = 'Open Lobbies',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Select Map',
        ['mode_select'] = 'Game Mode',
        ['loadout_select'] = 'Weapon Loadout',
        ['round_time'] = 'Round Time',
        ['max_players'] = 'Max Players',
        ['vehicles_allowed'] = 'Vehicles Allowed',
        ['friendly_fire'] = 'Friendly Fire',
        ['respawn_time'] = 'Respawn Time',
        ['kill_limit'] = 'Kill Limit',
        ['btn_create'] = 'Create Lobby',
        ['btn_cancel'] = 'Cancel',
        ['btn_join'] = 'Join',
        ['btn_ready'] = 'Ready',
        ['btn_start'] = 'Start Game',
        ['btn_leave'] = 'Leave Lobby',
        ['btn_kick'] = 'Kick',
        ['team_blue'] = 'Team Blue',
        ['team_red'] = 'Team Red',
        ['spectator'] = 'Spectator',
        ['random'] = 'Random',
        ['waiting_for_players'] = 'Waiting for players...',
        ['countdown'] = 'Starting in %s seconds',
        ['game_ended'] = 'Game Ended!',
        ['winner'] = 'Winner: %s',
        ['kills'] = 'Kills',
        ['deaths'] = 'Deaths',
        ['kd_ratio'] = 'K/D',
        ['score'] = 'Score',
        ['health'] = 'Health',
        ['armor'] = 'Armor',
        ['ammo'] = 'Ammo',
        ['time_left'] = 'Time Left',
        ['no_lobbies'] = 'No lobbies found.',
        ['lobby_full'] = 'Lobby is full!',
        ['joining'] = 'Joining...',
        ['starting'] = 'Starting...',
        ['round_starting'] = 'Round starting in 10 seconds',
        ['area_warning'] = 'You are leaving the combat area!',
        ['weapon_prohibited'] = 'This weapon is prohibited here!',
        ['all_maps'] = 'ALL MAPS',
        ['lobby_full_btn'] = 'FULL',
        ['quick_join_btn'] = 'QUICK JOIN',
        ['countdown_prepare'] = 'GET READY!',
        ['btn_back_to_lobby'] = 'BACK TO LOBBY',
        ['btn_back_to_menu'] = 'MAIN MENU',
        ['draw'] = 'DRAW',
        ['time_up'] = 'Time is up',
        ['kill_limit_reached'] = 'Kill limit reached',
        ['kicked'] = 'You were kicked from the lobby.',
        ['map_changed'] = 'Map changed to: %s'
    }
}

function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end
