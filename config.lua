Config = {}

Config.Locale = 'de' -- 'de' oder 'en'
Config.MenuKey = 'F5' -- Standard-Taste für das Menü (via RegisterKeyMapping)

Config.DefaultSettings = {
    roundTime = 15,
    maxPlayers = 16,
    respawnTime = 5,
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
        radius = 80.0,
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
        radius = 100.0,
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
        radius = 150.0,
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
        radius = 100.0,
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
        radius = 120.0,
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
        ['tab_create_title'] = 'Custom Lobby konfigurieren',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Map auswählen',
        ['map_select_create'] = 'Map wählen',
        ['mode_select'] = 'Spielmodus',
        ['loadout_select'] = 'Waffen-Loadout',
        ['loadout_select_create'] = 'Waffen-Loadout (Multi-Select)',
        ['round_time'] = 'Rundenzeit',
        ['max_players'] = 'Spieler',
        ['max_players_create'] = 'Max. Spieler',
        ['vehicles_allowed'] = 'Fahrzeuge erlaubt?',
        ['friendly_fire'] = 'Friendly Fire',
        ['respawn_time'] = 'Respawn Zeit',
        ['kill_limit'] = 'Kill Limit',
        ['btn_create'] = 'Lobby erstellen',
        ['btn_cancel'] = 'Abbrechen',
        ['btn_join'] = 'Beitreten',
        ['btn_ready'] = 'Bereit',
        ['btn_start'] = 'Spiel starten',
        ['btn_leave'] = 'Verlassen',
        ['btn_kick'] = 'Kicken',
        ['btn_back_lobby'] = 'Zur Lobby',
        ['btn_main_menu'] = 'Hauptmenü',
        ['team_blue'] = 'Team Blau',
        ['team_red'] = 'Team Rot',
        ['spectator'] = 'Zuschauer',
        ['random'] = 'Zufall',
        ['players_title'] = 'Spieler',
        ['map_label'] = 'Map',
        ['mode_label'] = 'Modus',
        ['time_label'] = 'Zeit',
        ['hud_kills'] = 'KILLS',
        ['hud_deaths'] = 'DEATHS',
        ['game_ended'] = 'Runde beendet',
        ['winner_suffix'] = 'gewinnt!',
        ['vote_map'] = 'Nächste Map wählen',
        ['stat_name'] = 'NAME',
        ['stat_kills'] = 'KILLS',
        ['stat_deaths'] = 'TODE',
        ['stat_kd'] = 'K/D'
    },
    ['en'] = {
        ['menu_title'] = 'FFA LOBBY SYSTEM',
        ['tab_ffa'] = 'FFA Lobby',
        ['tab_create'] = 'Create Lobby',
        ['tab_list'] = 'Open Lobbies',
        ['tab_create_title'] = 'Configure Custom Lobby',
        ['lobby_name'] = 'Lobby Name',
        ['map_select'] = 'Select Map',
        ['map_select_create'] = 'Select Map',
        ['mode_select'] = 'Game Mode',
        ['loadout_select'] = 'Weapon Loadout',
        ['loadout_select_create'] = 'Weapon Loadout (Multi-Select)',
        ['round_time'] = 'Round Time',
        ['max_players'] = 'Players',
        ['max_players_create'] = 'Max Players',
        ['vehicles_allowed'] = 'Vehicles Allowed?',
        ['friendly_fire'] = 'Friendly Fire',
        ['respawn_time'] = 'Respawn Time',
        ['kill_limit'] = 'Kill Limit',
        ['btn_create'] = 'Create Lobby',
        ['btn_cancel'] = 'Cancel',
        ['btn_join'] = 'Join',
        ['btn_ready'] = 'Ready',
        ['btn_start'] = 'Start Game',
        ['btn_leave'] = 'Leave',
        ['btn_kick'] = 'Kick',
        ['btn_back_lobby'] = 'Back to Lobby',
        ['btn_main_menu'] = 'Main Menu',
        ['team_blue'] = 'Team Blue',
        ['team_red'] = 'Team Red',
        ['spectator'] = 'Spectator',
        ['random'] = 'Random',
        ['players_title'] = 'Players',
        ['map_label'] = 'Map',
        ['mode_label'] = 'Mode',
        ['time_label'] = 'Time',
        ['hud_kills'] = 'KILLS',
        ['hud_deaths'] = 'DEATHS',
        ['game_ended'] = 'Round Ended',
        ['winner_suffix'] = 'wins!',
        ['vote_map'] = 'Vote Next Map',
        ['stat_name'] = 'NAME',
        ['stat_kills'] = 'KILLS',
        ['stat_deaths'] = 'DEATHS',
        ['stat_kd'] = 'K/D'
    }
}

function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end
