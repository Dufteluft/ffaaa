CREATE TABLE IF NOT EXISTS `ffa_stats` (
  `identifier` varchar(60) NOT NULL,
  `kills` int(11) DEFAULT 0,
  `deaths` int(11) DEFAULT 0,
  `games_played` int(11) DEFAULT 0,
  `wins` int(11) DEFAULT 0,
  PRIMARY KEY (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
