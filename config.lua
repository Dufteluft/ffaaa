-- Lokalisierungs-Helfer (Global verfügbar)
-- Verwendet die Konfiguration für sprachspezifische Ausgaben
function _U(str, ...)
    if Config.Locales[Config.Locale] and Config.Locales[Config.Locale][str] then
        return string.format(Config.Locales[Config.Locale][str], ...)
    else
        return 'Translation [' .. Config.Locale .. '][' .. str .. '] not found'
    end
end

Config = {}

Config.Locale = 'de' -- 'de' oder 'en'
Config.MenuKey = 'F5' -- Standardtaste für das Hauptmenü

-- Standardeinstellungen für neu erstellte Lobbys
Config.DefaultSettings = {
    roundTime = 15, -- Minuten
    maxPlayers = 16,
    respawnTime = 5, -- Sekunden
    killLimit = 30,
    friendlyFire = false,
    vehiclesAllowed = false
}

-- Definierte Waffen-Loadouts für die Lobby-Erstellung
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

-- Verfügbare Maps für FFA und Custom Lobbys
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

-- Lokalisierungstabelle für alle UI-Texte
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
        ['round_time'] = 'Rundenzeit (Min)',
        ['max_players'] = 'Max. Spieler',
        ['vehicles_allowed'] = 'Fahrzeuge erlaubt',
        ['friendly_fire'] = 'Freundliches Feuer',
        ['respawn_time'] = 'Respawn-Zeit (Sek)',
        ['kill_limit'] = 'Kill-Limit zum Sieg',
        ['btn_create'] = 'Lobby erstellen',
        ['btn_cancel'] = 'Abbrechen',
        ['btn_join'] = 'Beitreten',
        ['btn_ready'] = 'BEREIT',
        ['btn_start'] = 'Spiel starten',
        ['btn_leave'] = 'VERLASSEN',
        ['btn_kick'] = 'Kicken',
        ['team_blue'] = 'Team Blau',
        ['team_red'] = 'Team Rot',
        ['spectator'] = 'Zuschauer',
        ['random'] = 'ZUFALL',
        ['waiting_for_players'] = 'Warte auf Spieler...',
        ['countdown'] = 'Start in %s Sekunden',
        ['game_ended'] = 'RUNDE BEENDET!',
        ['winner'] = 'Gewinner: %s',
        ['kills'] = 'KILLS',
        ['deaths'] = 'TODE',
        ['kd_ratio'] = 'K/D',
        ['score'] = 'Score',
        ['players'] = 'SPIELER',
        ['settings'] = 'EINSTELLUNGEN',
        ['map_vote'] = 'Nächste Map wählen',
        ['col_name'] = 'NAME',
        ['btn_back_lobby'] = 'ZURÜCK ZUR LOBBY',
        ['btn_back_menu'] = 'HAUPTMENÜ'
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
        ['round_time'] = 'Round Time (Min)',
        ['max_players'] = 'Max Players',
        ['vehicles_allowed'] = 'Vehicles Allowed',
        ['friendly_fire'] = 'Friendly Fire',
        ['respawn_time'] = 'Respawn Time (Sec)',
        ['kill_limit'] = 'Kill Limit to Win',
        ['btn_create'] = 'Create Lobby',
        ['btn_cancel'] = 'Cancel',
        ['btn_join'] = 'Join',
        ['btn_ready'] = 'READY',
        ['btn_start'] = 'Start Game',
        ['btn_leave'] = 'LEAVE',
        ['btn_kick'] = 'Kick',
        ['team_blue'] = 'Team Blue',
        ['team_red'] = 'Team Red',
        ['spectator'] = 'Spectator',
        ['random'] = 'RANDOM',
        ['waiting_for_players'] = 'Waiting for players...',
        ['countdown'] = 'Starting in %s seconds',
        ['game_ended'] = 'GAME ENDED!',
        ['winner'] = 'Winner: %s',
        ['kills'] = 'KILLS',
        ['deaths'] = 'DEATHS',
        ['kd_ratio'] = 'K/D',
        ['score'] = 'Score',
        ['players'] = 'PLAYERS',
        ['settings'] = 'SETTINGS',
        ['map_vote'] = 'Vote Next Map',
        ['col_name'] = 'NAME',
        ['btn_back_lobby'] = 'BACK TO LOBBY',
        ['btn_back_menu'] = 'MAIN MENU'
    }
}
