Config = {}

Config.Locale = 'de'
Config.MenuKey = 'F5'

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

local Locales = {
    ['de'] = {
        ['team_blue'] = 'Team Blau',
        ['team_red'] = 'Team Rot',
        ['draw'] = 'Unentschieden'
    },
    ['en'] = {
        ['team_blue'] = 'Team Blue',
        ['team_red'] = 'Team Red',
        ['draw'] = 'Draw'
    }
}

function _U(str, ...)
    if Locales[Config.Locale] and Locales[Config.Locale][str] then
        return string.format(Locales[Config.Locale][str], ...)
    end
    return str
end
