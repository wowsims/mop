package mop

import (
	"github.com/wowsims/mop/sim/common/shared"
)

func RegisterAllOnUseCds() {

	//

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Throw a bomb at the target, dealing 20074 Fire Damage upon impact to all enemies within 40 yards.
	// https://www.wowhead.com/mop/spell=128365
	// shared.NewSimpleStatActive(88583)

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Deals 20074 Fire damage to your current target.
	// https://www.wowhead.com/mop/spell=128191
	// shared.NewSimpleStatActive(88590)

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Place a Mogu Rune of Paralysis on the ground for 1min, which will stun the next creature that enters it
	// for 4s.
	// https://www.wowhead.com/mop/spell=129554
	// shared.NewSimpleStatActive(89232)

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Consumes all Blessings of Zuldazar to shield the target, absorbing 9339 damage per Blessing consumed.
	// Lasts 15s.
	// https://www.wowhead.com/mop/spell=138925
	// shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
	// 	{ItemID: 94525, ItemName: "Stolen Relic of Zuldazar (N)"},
	// 	{ItemID: 95763, ItemName: "Stolen Relic of Zuldazar (LFR) (Celestial)"},
	// 	{ItemID: 96135, ItemName: "Stolen Relic of Zuldazar (Thunderforged)"},
	// 	{ItemID: 96507, ItemName: "Stolen Relic of Zuldazar (H)"},
	// 	{ItemID: 96879, ItemName: "Stolen Relic of Zuldazar (Heroic Thunderforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Reduces damage taken from creature area of effect attacks by 33% for 15s.
	// https://www.wowhead.com/mop/spell=146343
	// shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
	// 	{ItemID: 102296, ItemName: "Rook's Unlucky Talisman (N)"},
	// 	{ItemID: 104442, ItemName: "Rook's Unlucky Talisman (H)"},
	// 	{ItemID: 104691, ItemName: "Rook's Unlucky Talisman (Flexible)"},
	// 	{ItemID: 104940, ItemName: "Rook's Unlucky Talisman (LFR) (Celestial)"},
	// 	{ItemID: 105189, ItemName: "Rook's Unlucky Talisman (Warforged)"},
	// 	{ItemID: 105438, ItemName: "Rook's Unlucky Talisman (Heroic Warforged)"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Let the Horseman laugh through you.
	// https://www.wowhead.com/mop/spell=43873
	// shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
	// 	{ItemID: 263014, ItemName: "The Horseman's Horrific Hood"},
	// 	{ItemID: 282172, ItemName: "The Horseman's Horrific Hood"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Summon Pumpkin Soldiers to burn your foes.
	// https://www.wowhead.com/mop/spell=50070
	// shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
	// 	{ItemID: 263018, ItemName: "The Horseman's Sinister Slicer"},
	// 	{ItemID: 282174, ItemName: "The Horseman's Sinister Slicer"},
	// })

	// TODO: Manual implementation required
	//       This can be ignored if the effect has already been implemented.
	//       With next db run the item will be removed if implemented.
	//
	// Let the Frostscythe's chill flow through you.
	// https://www.wowhead.com/mop/spell=46643
	// shared.NewSimpleStatActive(280389)

	// Agility

	// Increases your Agility by 4232 for 15s.
	// https://www.wowhead.com/mop/spell=126484
	shared.NewSimpleStatActive(81265)

	// Increases Agility by 2021 for 20s.
	// https://www.wowhead.com/mop/spell=126690
	shared.NewSimpleStatActive(84344)

	// Increases Agility by 2553 for 20s.
	// https://www.wowhead.com/mop/spell=126690
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 84934, ItemName: "Malevolent Gladiator's Badge of Conquest (Season 12)"},
		{ItemID: 91452, ItemName: "Malevolent Gladiator's Badge of Conquest (Season 13)"},
	})

	// Increases your Agility by 3480 for 20s.
	// https://www.wowhead.com/mop/spell=127575
	shared.NewSimpleStatActive(87495)

	// Increases Agility by 2881 for 20s.
	// https://www.wowhead.com/mop/spell=126690
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 91099, ItemName: "Tyrannical Gladiator's Badge of Conquest (Season 13) (Alliance)"},
		{ItemID: 94373, ItemName: "Tyrannical Gladiator's Badge of Conquest (Season 13) (Horde)"},
		{ItemID: 99772, ItemName: "Tyrannical Gladiator's Badge of Conquest (Season 14) (Alliance)"},
		{ItemID: 100043, ItemName: "Tyrannical Gladiator's Badge of Conquest (Season 14) (Horde)"},
	})

	// Increases Agility by 2021 for 20s.
	// https://www.wowhead.com/mop/spell=126690
	shared.NewSimpleStatActive(93419)

	// Increases Agility by 2390 for 20s.
	// https://www.wowhead.com/mop/spell=126690
	shared.NewSimpleStatActive(98755)

	// Increases Agility by 3670 for 20s.
	// https://www.wowhead.com/mop/spell=126690
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 100195, ItemName: "Grievous Gladiator's Badge of Conquest (Season 14) (Alliance)"},
		{ItemID: 100603, ItemName: "Grievous Gladiator's Badge of Conquest (Season 14) (Horde)"},
		{ItemID: 102856, ItemName: "Grievous Gladiator's Badge of Conquest (Season 15) (Horde)"},
		{ItemID: 103145, ItemName: "Grievous Gladiator's Badge of Conquest (Season 15) (Alliance)"},
	})

	// Increases Agility by 4765 for 20s.
	// https://www.wowhead.com/mop/spell=126690
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 102659, ItemName: "Prideful Gladiator's Badge of Conquest (Season 15) (Alliance)"},
		{ItemID: 103342, ItemName: "Prideful Gladiator's Badge of Conquest (Season 15) (Horde)"},
	})

	// CritRating

	// Increases your critical strike by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126605
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 86044, ItemName: "Jade Magistrate Figurine"},
		{ItemID: 86773, ItemName: "Jade Magistrate Figurine (Celestial)"},
	})

	// Increases your critical strike by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126605
	shared.NewSimpleStatActive(89081)

	// Increases your critical strike by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136086
	shared.NewSimpleStatActive(93253)

	// Increases your critical strike by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136084
	shared.NewSimpleStatActive(93256)

	// Increases your critical strike by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136086
	shared.NewSimpleStatActive(93258)

	// Increases your critical strike by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136084
	shared.NewSimpleStatActive(93261)

	// Increases your critical strike by 9795 for 15s.
	// https://www.wowhead.com/mop/spell=146395
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 102307, ItemName: "Curse of Hubris (N)"},
		{ItemID: 104649, ItemName: "Curse of Hubris (H)"},
		{ItemID: 104898, ItemName: "Curse of Hubris (Flexible)"},
		{ItemID: 105147, ItemName: "Curse of Hubris (LFR) (Celestial)"},
		{ItemID: 105396, ItemName: "Curse of Hubris (Warforged)"},
		{ItemID: 105645, ItemName: "Curse of Hubris (Heroic Warforged)"},
	})

	// DodgeRating

	// Grants 8871 dodge for 10s.
	// https://www.wowhead.com/mop/spell=128988
	shared.NewSimpleStatActive(79329)

	// Increases dodge by 4232 for 20s.
	// https://www.wowhead.com/mop/spell=126260
	shared.NewSimpleStatActive(81181)

	// Grants 16000 dodge, decreasing by 1600 every 2.0 sec. Lasts 20s.
	// https://www.wowhead.com/mop/spell=138728
	shared.NewSimpleStatActive(94507)

	// Increases dodge by 5759 for 20s.
	// https://www.wowhead.com/mop/spell=146344
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 103690, ItemName: "Resolve of Niuzao"},
		{ItemID: 103990, ItemName: "Resolve of Niuzao (Timeless)"},
	})

	// Increases dodge by 5831 for 20s.
	// https://www.wowhead.com/mop/spell=127967
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 257885, ItemName: "Brawler's Statue"},
		{ItemID: 282039, ItemName: "Brawler's Statue"},
	})

	// HasteRating

	// Increases your haste by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126599
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 86042, ItemName: "Jade Charioteer Figurine"},
		{ItemID: 86771, ItemName: "Jade Charioteer Figurine (Celestial)"},
	})

	// Increases your haste by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126599
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 86043, ItemName: "Jade Bandit Figurine"},
		{ItemID: 86772, ItemName: "Jade Bandit Figurine (Celestial)"},
	})

	// Increases your haste by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126599
	shared.NewSimpleStatActive(89082)

	// Increases your haste by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=129812
	shared.NewSimpleStatActive(89083)

	// Increases your haste by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136089
	shared.NewSimpleStatActive(93342)

	// Increases your haste by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136089
	shared.NewSimpleStatActive(93347)

	// Health

	// Increases maximum health by 40673 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(84399)

	// Increases maximum health by 40673 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(84400)

	// Increases maximum health by 40673 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(84401)

	// Increases maximum health by 51364 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 84936, ItemName: "Malevolent Gladiator's Emblem of Cruelty (Season 12)"},
		{ItemID: 91562, ItemName: "Malevolent Gladiator's Emblem of Cruelty (Season 13)"},
	})

	// Increases maximum health by 51364 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 84938, ItemName: "Malevolent Gladiator's Emblem of Tenacity (Season 12)"},
		{ItemID: 91563, ItemName: "Malevolent Gladiator's Emblem of Tenacity (Season 13)"},
	})

	// Increases maximum health by 51364 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 84939, ItemName: "Malevolent Gladiator's Emblem of Meditation (Season 12)"},
		{ItemID: 91564, ItemName: "Malevolent Gladiator's Emblem of Meditation (Season 13)"},
	})

	// Increases maximum health by 27803 for 20s.
	// https://www.wowhead.com/mop/spell=127549
	shared.NewSimpleStatActive(87500)

	// Increases maximum health by 57969 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 91209, ItemName: "Tyrannical Gladiator's Emblem of Cruelty (Season 13) (Alliance)"},
		{ItemID: 94396, ItemName: "Tyrannical Gladiator's Emblem of Cruelty (Season 13) (Horde)"},
		{ItemID: 99838, ItemName: "Tyrannical Gladiator's Emblem of Cruelty (Season 14) (Alliance)"},
		{ItemID: 100066, ItemName: "Tyrannical Gladiator's Emblem of Cruelty (Season 14) (Horde)"},
	})

	// Increases maximum health by 57969 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 91210, ItemName: "Tyrannical Gladiator's Emblem of Tenacity (Season 13) (Alliance)"},
		{ItemID: 94422, ItemName: "Tyrannical Gladiator's Emblem of Tenacity (Season 13) (Horde)"},
		{ItemID: 99839, ItemName: "Tyrannical Gladiator's Emblem of Tenacity (Season 14) (Alliance)"},
		{ItemID: 100092, ItemName: "Tyrannical Gladiator's Emblem of Tenacity (Season 14) (Horde)"},
	})

	// Increases maximum health by 57969 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 91211, ItemName: "Tyrannical Gladiator's Emblem of Meditation (Season 13) (Alliance)"},
		{ItemID: 94329, ItemName: "Tyrannical Gladiator's Emblem of Meditation (Season 13) (Horde)"},
		{ItemID: 99840, ItemName: "Tyrannical Gladiator's Emblem of Meditation (Season 14) (Alliance)"},
		{ItemID: 99990, ItemName: "Tyrannical Gladiator's Emblem of Meditation (Season 14) (Horde)"},
	})

	// Increases maximum health by 40673 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(93485)

	// Increases maximum health by 40673 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(93486)

	// Increases maximum health by 40673 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(93487)

	// Increases maximum health by 73844 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 94516, ItemName: "Fortitude of the Zandalari (N)"},
		{ItemID: 95677, ItemName: "Fortitude of the Zandalari (LFR) (Celestial)"},
		{ItemID: 96049, ItemName: "Fortitude of the Zandalari (Thunderforged)"},
		{ItemID: 96421, ItemName: "Fortitude of the Zandalari (H)"},
		{ItemID: 96793, ItemName: "Fortitude of the Zandalari (Heroic Thunderforged)"},
	})

	// Increases maximum health by 48099 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(98811)

	// Increases maximum health by 48099 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(98812)

	// Increases maximum health by 48099 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActive(98813)

	// Increases maximum health by 73844 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 100305, ItemName: "Grievous Gladiator's Emblem of Cruelty (Season 14) (Alliance)"},
		{ItemID: 100626, ItemName: "Grievous Gladiator's Emblem of Cruelty (Season 14) (Horde)"},
		{ItemID: 102877, ItemName: "Grievous Gladiator's Emblem of Cruelty (Season 15) (Horde)"},
		{ItemID: 103210, ItemName: "Grievous Gladiator's Emblem of Cruelty (Season 15) (Alliance)"},
	})

	// Increases maximum health by 73844 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 100306, ItemName: "Grievous Gladiator's Emblem of Tenacity (Season 14) (Alliance)"},
		{ItemID: 100652, ItemName: "Grievous Gladiator's Emblem of Tenacity (Season 14) (Horde)"},
		{ItemID: 102903, ItemName: "Grievous Gladiator's Emblem of Tenacity (Season 15) (Horde)"},
		{ItemID: 103211, ItemName: "Grievous Gladiator's Emblem of Tenacity (Season 15) (Alliance)"},
	})

	// Increases maximum health by 73844 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 100307, ItemName: "Grievous Gladiator's Emblem of Meditation (Season 14) (Alliance)"},
		{ItemID: 100559, ItemName: "Grievous Gladiator's Emblem of Meditation (Season 14) (Horde)"},
		{ItemID: 102813, ItemName: "Grievous Gladiator's Emblem of Meditation (Season 15) (Horde)"},
		{ItemID: 103212, ItemName: "Grievous Gladiator's Emblem of Meditation (Season 15) (Alliance)"},
	})

	// Increases maximum health by 95875 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 102616, ItemName: "Prideful Gladiator's Emblem of Meditation (Season 15) (Alliance)"},
		{ItemID: 103409, ItemName: "Prideful Gladiator's Emblem of Meditation (Season 15) (Horde)"},
	})

	// Increases maximum health by 95875 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 102680, ItemName: "Prideful Gladiator's Emblem of Cruelty (Season 15) (Alliance)"},
		{ItemID: 103407, ItemName: "Prideful Gladiator's Emblem of Cruelty (Season 15) (Horde)"},
	})

	// Increases maximum health by 95875 for 15s. Shares cooldown with other Battlemaster's trinkets.
	// https://www.wowhead.com/mop/spell=126697
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 102706, ItemName: "Prideful Gladiator's Emblem of Tenacity (Season 15) (Alliance)"},
		{ItemID: 103408, ItemName: "Prideful Gladiator's Emblem of Tenacity (Season 15) (Horde)"},
	})

	// Intellect

	// Increases your Intellect by 4232 for 25s.
	// https://www.wowhead.com/mop/spell=126478
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 81263, ItemName: "Flashfrozen Resin Globule (H)"},
		{ItemID: 100951, ItemName: "Flashfrozen Resin Globule (N)"},
	})

	// Increases Intellect by 2021 for 20s.
	// https://www.wowhead.com/mop/spell=126683
	shared.NewSimpleStatActive(84488)

	// Increases Intellect by 2553 for 20s.
	// https://www.wowhead.com/mop/spell=126683
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 84940, ItemName: "Malevolent Gladiator's Badge of Dominance (Season 12)"},
		{ItemID: 91753, ItemName: "Malevolent Gladiator's Badge of Dominance (Season 13)"},
	})

	// Increases Intellect by 2881 for 20s.
	// https://www.wowhead.com/mop/spell=126683
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 91400, ItemName: "Tyrannical Gladiator's Badge of Dominance (Season 13) (Alliance)"},
		{ItemID: 94346, ItemName: "Tyrannical Gladiator's Badge of Dominance (Season 13) (Horde)"},
		{ItemID: 99937, ItemName: "Tyrannical Gladiator's Badge of Dominance (Season 14) (Alliance)"},
		{ItemID: 100016, ItemName: "Tyrannical Gladiator's Badge of Dominance (Season 14) (Horde)"},
	})

	// Increases your Intellect by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136082
	shared.NewSimpleStatActive(93254)

	// Increases your Intellect by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136082
	shared.NewSimpleStatActive(93259)

	// Increases Intellect by 2021 for 20s.
	// https://www.wowhead.com/mop/spell=126683
	shared.NewSimpleStatActive(93600)

	// Increases Intellect by 2390 for 20s.
	// https://www.wowhead.com/mop/spell=126683
	shared.NewSimpleStatActive(98910)

	// Increases Intellect by 3670 for 20s.
	// https://www.wowhead.com/mop/spell=126683
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 100490, ItemName: "Grievous Gladiator's Badge of Dominance (Season 14) (Alliance)"},
		{ItemID: 100576, ItemName: "Grievous Gladiator's Badge of Dominance (Season 14) (Horde)"},
		{ItemID: 102830, ItemName: "Grievous Gladiator's Badge of Dominance (Season 15) (Horde)"},
		{ItemID: 103308, ItemName: "Grievous Gladiator's Badge of Dominance (Season 15) (Alliance)"},
	})

	// Increases Intellect by 4765 for 20s.
	// https://www.wowhead.com/mop/spell=126683
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 102633, ItemName: "Prideful Gladiator's Badge of Dominance (Season 15) (Alliance)"},
		{ItemID: 103505, ItemName: "Prideful Gladiator's Badge of Dominance (Season 15) (Horde)"},
	})

	// MasteryRating

	// Increases your mastery by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126597
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 86046, ItemName: "Jade Warlord Figurine"},
		{ItemID: 86775, ItemName: "Jade Warlord Figurine (Celestial)"},
	})

	// Increases your mastery by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126597
	shared.NewSimpleStatActive(89079)

	// Increases your mastery by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136085
	shared.NewSimpleStatActive(93257)

	// Increases your mastery by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136085
	shared.NewSimpleStatActive(93262)

	// Increases your mastery by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136088
	shared.NewSimpleStatActive(93341)

	// Increases your mastery by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136091
	shared.NewSimpleStatActive(93344)

	// Increases your mastery by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136092
	shared.NewSimpleStatActive(93345)

	// Increases your mastery by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136088
	shared.NewSimpleStatActive(93346)

	// Increases your mastery by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136091
	shared.NewSimpleStatActive(93349)

	// Increases your mastery by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136092
	shared.NewSimpleStatActive(93350)

	// PvpPowerRating

	// Increases PvP Power by 5000 for 30s. Only usable in Pandaria.
	// https://www.wowhead.com/mop/spell=134945
	shared.NewSimpleStatActive(92784)

	// Increases PvP Power by 5000 for 30s. Only usable in Pandaria.
	// https://www.wowhead.com/mop/spell=134954
	shared.NewSimpleStatActive(92785)

	// PvpPowerRating / PvpResilienceRating

	// Increases PvP Power and PvP Resilience by 5643 for 30s.
	// https://www.wowhead.com/mop/spell=148388
	shared.NewSimpleStatActive(103639)

	// PvpResilienceRating

	// Increases PvP resilience by 10000 for 15s. Only usable in Pandaria.
	// https://www.wowhead.com/mop/spell=134944
	shared.NewSimpleStatActive(92782)

	// Increases PvP resilience by 10000 for 15s. Only usable in Pandaria.
	// https://www.wowhead.com/mop/spell=134953
	shared.NewSimpleStatActive(92783)

	// Skipped
	// Not simulated: Sun-Lute of the Phoenix King: "Sun-Lute's Song" (132452) - ignored aura type 56
	// https://www.wowhead.com/mop/spell=132452
	// Not simulated: Dragonwrath, Tarecgosa's Rest: "Tarecgosa's Visage" (101641) - ignored aura type 56
	// https://www.wowhead.com/mop/spell=101641
	// Not simulated: Ruthless Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Ruthless Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Ruthless Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Cataclysmic Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Cataclysmic Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Cataclysmic Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Golad, Twilight of Aspects: "Embrace of the Destroyer" (107082) - ignored aura type 105
	// https://www.wowhead.com/mop/spell=107082
	// Not simulated: Tiriosh, Nightmare of Ages: "Embrace of the Destroyer" (107082) - ignored aura type 105
	// https://www.wowhead.com/mop/spell=107082
	// Not simulated: Jade Raccoon: "Socks" (121717) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=121717
	// Not simulated: Dreadful Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Dreadful Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Dreadful Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Malevolent Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Malevolent Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Malevolent Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Yaungol Wind Chime: "Yaungol Wind Chime" (126555) - ignored aura type 56
	// https://www.wowhead.com/mop/spell=126555
	// Not simulated: Crate of Kidnapped Puppies: "Release Puppies" (127233) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=127233
	// Not simulated: Terracotta Fragment: "Summon Terracotta Warrior" (127247) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=127247
	// Not simulated: Dynasty of Steel: "Summon Whirlwind of Blades" (127265) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=127265
	// Not simulated: Seed of Tranquil Growth: "Summon Tranquil Sprout" (130146) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=130146
	// Not simulated: Martar's Magnifying Glass: "Summon Martar" (127464) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=127464
	// Not simulated: Flamelager's Summer Keg: "Flamelager's Summer Keg" (127789) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=127789
	// Not simulated: Shado-Pan Dragon Gun: "Shado-Pan Dragon Gun" (129115) - ignored aura type 33
	// https://www.wowhead.com/mop/spell=129115
	// Not simulated: Quilen Statuette: "Quilen Statuette" (130486) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=130486
	// Not simulated: Alliance Insignia of Conquering: "Supremacy of the Alliance" (134946) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=134946
	// Not simulated: Horde Insignia of Conquering: "Supremacy of the Horde" (134956) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=134956
	// Not simulated: Crafted Dreadful Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Crafted Dreadful Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Crafted Dreadful Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Tyrannical Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Tyrannical Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Tyrannical Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: The Brassiest Knuckle: "Teleport: Brawl'gar Arena" (139432) - ignored effect type 252
	// https://www.wowhead.com/mop/spell=139432
	// Not simulated: The Brassiest Knuckle: "Teleport: Bizmo's Brewpub" (139437) - ignored effect type 252
	// https://www.wowhead.com/mop/spell=139437
	// Not simulated: Crafted Malevolent Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Crafted Malevolent Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Crafted Malevolent Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Grievous Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Grievous Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Grievous Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Gladiator's Medallion: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Gladiator's Emblem: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Prideful Gladiator's Medallion of Meditation: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Prideful Gladiator's Medallion of Tenacity: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Prideful Gladiator's Medallion of Cruelty: "PvP Trinket" (42292) - ignored aura type 77
	// https://www.wowhead.com/mop/spell=42292
	// Not simulated: Time-Lost Artifact: "Call of the Mists" (145430) - ignored effect type 252
	// https://www.wowhead.com/mop/spell=145430
	// Not simulated: Ordon Death Chime: "Ordon Death Chime" (148534) - ignored aura type 56
	// https://www.wowhead.com/mop/spell=148534
	// Not simulated: Captain Zvezdan's Lost Leg: "Summon Crew of the Barnacle" (148597) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=148597
	// Not simulated: Bitterest Balebrew Charm: "Summon the Black Brewmaiden" (1262327) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=1262327
	// Not simulated: Bubbliest Brightbrew Charm: "Summon the Brewmaiden" (1262345) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=1262345
	// Not simulated: Bitterest Balebrew Charm: "Summon the Black Brewmaiden" (1313111) - ignored effect type 28
	// https://www.wowhead.com/mop/spell=1313111

	// Spirit

	// Increases your Spirit by 4241 for 20s.
	// https://www.wowhead.com/mop/spell=126270
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 81264, ItemName: "Vial of Ichorous Blood (H)"},
		{ItemID: 100963, ItemName: "Vial of Ichorous Blood (N)"},
	})

	// Increases your Spirit by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126606
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 86045, ItemName: "Jade Courtesan Figurine"},
		{ItemID: 86774, ItemName: "Jade Courtesan Figurine (Celestial)"},
	})

	// Increases your Spirit by 3595 for 15s.
	// https://www.wowhead.com/mop/spell=126606
	shared.NewSimpleStatActive(89080)

	// Increases your Spirit by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136083
	shared.NewSimpleStatActive(93255)

	// Increases your Spirit by 3838 for 15s.
	// https://www.wowhead.com/mop/spell=136087
	shared.NewSimpleStatActive(93260)

	// Increases your Spirit by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136090
	shared.NewSimpleStatActive(93343)

	// Increases your Spirit by 2693 for 15s.
	// https://www.wowhead.com/mop/spell=136090
	shared.NewSimpleStatActive(93348)

	// Increases your Spirit by 5759 for 15s.
	// https://www.wowhead.com/mop/spell=146323
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 103688, ItemName: "Contemplation of Chi-Ji"},
		{ItemID: 103988, ItemName: "Contemplation of Chi-Ji (Timeless)"},
	})

	// Strength

	// Increases your Strength by 4232 for 20s.
	// https://www.wowhead.com/mop/spell=126519
	shared.NewSimpleStatActive(81268)

	// Increases Strength by 2021 for 20s.
	// https://www.wowhead.com/mop/spell=126679
	shared.NewSimpleStatActive(84490)

	// Increases Strength by 2553 for 20s.
	// https://www.wowhead.com/mop/spell=126679
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 84942, ItemName: "Malevolent Gladiator's Badge of Victory (Season 12)"},
		{ItemID: 91763, ItemName: "Malevolent Gladiator's Badge of Victory (Season 13)"},
	})

	// Increases your Strength by 5633 for 10s.
	// https://www.wowhead.com/mop/spell=127577
	shared.NewSimpleStatActive(87496)

	// Increases Strength by 2881 for 20s.
	// https://www.wowhead.com/mop/spell=126679
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 91410, ItemName: "Tyrannical Gladiator's Badge of Victory (Season 13) (Alliance)"},
		{ItemID: 94349, ItemName: "Tyrannical Gladiator's Badge of Victory (Season 13) (Horde)"},
		{ItemID: 99943, ItemName: "Tyrannical Gladiator's Badge of Victory (Season 14) (Alliance)"},
		{ItemID: 100019, ItemName: "Tyrannical Gladiator's Badge of Victory (Season 14) (Horde)"},
	})

	// Increases Strength by 2021 for 20s.
	// https://www.wowhead.com/mop/spell=126679
	shared.NewSimpleStatActive(93606)

	// Increases Strength by 2390 for 20s.
	// https://www.wowhead.com/mop/spell=126679
	shared.NewSimpleStatActive(98912)

	// Increases Strength by 3670 for 20s.
	// https://www.wowhead.com/mop/spell=126679
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 100500, ItemName: "Grievous Gladiator's Badge of Victory (Season 14) (Alliance)"},
		{ItemID: 100579, ItemName: "Grievous Gladiator's Badge of Victory (Season 14) (Horde)"},
		{ItemID: 102833, ItemName: "Grievous Gladiator's Badge of Victory (Season 15) (Horde)"},
		{ItemID: 103314, ItemName: "Grievous Gladiator's Badge of Victory (Season 15) (Alliance)"},
	})

	// Increases Strength by 4765 for 20s.
	// https://www.wowhead.com/mop/spell=126679
	shared.NewSimpleStatActiveWithVariants([]shared.ItemVariant{
		{ItemID: 102636, ItemName: "Prideful Gladiator's Badge of Victory (Season 15) (Alliance)"},
		{ItemID: 103511, ItemName: "Prideful Gladiator's Badge of Victory (Season 15) (Horde)"},
	})
}
