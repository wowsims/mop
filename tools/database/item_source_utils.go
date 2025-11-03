package database

import (
	"strings"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func InferPhase(item *proto.UIItem) int32 {
	ilvl := item.ScalingOptions[int32(proto.ItemLevelState_Base)].Ilvl
	hasRandomSuffixOptions := len(item.RandomSuffixOptions) > 0
	name := item.Name
	description := item.NameDescription
	quality := item.Quality

	//- Any blue pvp ''Crafted'' item of ilvl 458 is 5.2
	//- Any blue pvp ''Crafted'' item of ilvl 476 is 5.4
	if strings.Contains(name, "Crafted") {
		switch ilvl {
		case 458:
			return 3
		case 476:
			return 5
		}
	}

	//- Any "Tyrannical" item is 5.2
	//- Any "Grievous" item is 5.4
	//- Any "Prideful" item is 5.4
	switch {
	case strings.Contains(name, "Grievous"),
		strings.Contains(name, "Prideful"):
		return 5
	case strings.Contains(name, "Tyrannical"):
		return 3
	}

	//iLvl 600 legendary vs. epic
	if ilvl == core.MaxIlvl {
		if quality == proto.ItemQuality_ItemQualityLegendary {
			return 5
		}
		if quality == proto.ItemQuality_ItemQualityEpic {
			return 4
		}
	}

	//- Any item above ilvl 542 is 5.4 (except the 600 ilvl Epic Cloaks from the legendary questline)
	if ilvl > 542 && quality < proto.ItemQuality_ItemQualityLegendary {
		return 5
	}

	//- Any 483 green item is a boosted level 90 item in 5.4
	if ilvl == 483 && quality == proto.ItemQuality_ItemQualityUncommon {
		return 5
	}

	//- All pve tier items of ilvl 528/540/553/566 are 5.4
	//- All pve tier items of ilvl 502/522/535 are 5.2
	if item.SetId > 0 {
		switch ilvl {
		case 528, 540, 553, 566:
			return 5
		case 502, 522, 535:
			return 3
		}
	}

	// Timeless Isle trinkets are all ilvl 496 or 535 and description "Timeless" and does not have a source listed.
	if len(item.Sources) == 0 {
		if item.Type == proto.ItemType_ItemTypeTrinket && (ilvl == 496 || (ilvl == 535 && strings.Contains(description, "Timeless"))) {
			return 5
		}
	}

	//AtlasLoot‐style source checks
	for _, src := range item.Sources {
		if rep := src.GetRep(); rep != nil {
			//- All items with Reputation requirements of "Shado-Pan Assault" are 5.2
			if rep.RepFactionId == proto.RepFaction_RepFactionShadoPanAssault {
				return 3
			}
			//- All items with Reputation requirements of "Sunreaver Onslaught" or "Kirin Tor Offensive" are 5.2
			if rep.RepFactionId == proto.RepFaction_RepFactionSunreaverOnslaught || rep.RepFactionId == proto.RepFaction_RepFactionKirinTorOffensive {
				return 3
			}
			if rep.RepFactionId == proto.RepFaction_RepFactionOperationShieldwall || rep.RepFactionId == proto.RepFaction_RepFactionDominanceOffensive {
				return 2
			}
			//- All items with Reputation requirements of "Emperor Shaohao" are 5.4
			if rep.RepFactionId == proto.RepFaction_RepFactionEmperorShaohao {
				return 3
			}
		}
		if craft := src.GetCrafted(); craft != nil {
			switch ilvl {
			case 476, 496:
				return 1
			case 502:
				return 4
			case 522:
				return 3
			case 553:
				return 4
			}
		}
		if drop := src.GetDrop(); drop != nil {
			switch drop.ZoneId {
			case 6297, 6125, 6067:
				return 1
			case 6622:
				return 3
			case 6738:
				return 5
			}
			//- All "Oondasta (World Boss)" items are 5.2
			if drop.NpcId == 826 {
				return 3
			}
			//- All "Ordos (World Boss)" items are 5.4
			if drop.NpcId == 861 {
				return 5
			}
		}
	}

	//- Any 476 epic item with random stats is 5.1
	//- Any 496 epic item with random stats is 5.4
	//- Any 516 epic items with random stats are 5.3
	//- Any 535 epic items with random stats are 5.4
	//- Any 489 random stat epic is 5.3
	if hasRandomSuffixOptions {
		switch ilvl {
		case 476:
			return 2
		case 489:
			return 4
		case 496:
			return 5
		case 516:
			return 4
		case 535:
			return 5
		}
	}

	// high ilvl greens probably boosted
	if ilvl > 440 && quality < proto.ItemQuality_ItemQualityRare {
		return 5
	}

	if ilvl <= 463 {
		return 1
	}

	switch ilvl {
	case 476, 483, 489, 496:
		return 1
	case 502, 522, 535, 541:
		return 3
	case 553, 528, 566, 540:
		return 5
	}

	return 0
}

func InferThroneOfThunderSource(item *proto.UIItem) []*proto.UIItemSource {
	sources := make([]*proto.UIItemSource, 0, len(item.Sources)+1)

	sources = append(sources, &proto.UIItemSource{
		Source: &proto.UIItemSource_Drop{Drop: &proto.DropSource{
			ZoneId:    6622,
			OtherName: "Shared Boss Loot",
		}},
	})

	sources = append(sources, item.Sources...)
	return sources
}

func InferCelestialItemSource(item *proto.UIItem) []*proto.UIItemSource {
	if item.Phase <= 2 {
		sources := make([]*proto.UIItemSource, 0, len(item.Sources)+1)
		// Make sure to always add the SoldBy source first so it shows up first in the UI since we pick the first index
		// but we still need the other sources to add things like Sha-Touched gems
		sources = append(sources, &proto.UIItemSource{
			Source: &proto.UIItemSource_SoldBy{SoldBy: &proto.SoldBySource{
				NpcId:   248108,
				NpcName: "Avatar of the August Celestials",
			}},
		})
		sources = append(sources, item.Sources...)
		return sources
	}
	return item.Sources
}

func InferFlexibleRaidItemSource(item *proto.UIItem) []*proto.UIItemSource {
	sources := item.Sources
	hasSources := len(item.Sources) > 0
	if hasSources {
		for _, source := range sources {
			if drop := source.GetDrop(); drop != nil {
				// Flex raid has no difficulty index so we need to infer it from name
				if drop.Difficulty == proto.DungeonDifficulty_DifficultyUnknown {
					drop.Difficulty = proto.DungeonDifficulty_DifficultyRaidFlex
				}
			}
		}
	} else {
		// Some Flex items don't have a drop source listed,
		// so just add the difficulty for filtering
		sources = append(sources, &proto.UIItemSource{
			Source: &proto.UIItemSource_Drop{Drop: &proto.DropSource{
				Difficulty: proto.DungeonDifficulty_DifficultyRaidFlex,
			}},
		})
	}

	return sources
}
