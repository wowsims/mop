package dbc

import (
	"github.com/wowsims/mop/sim/core/proto"
)

// in proto/spellpower.go

type SpellPower struct {
	ID                  int     // corresponds to [ID]
	OrderIndex          int     // [OrderIndex]
	ManaCost            int     // [ManaCost]
	ManaCostPerLevel    int     // [ManaCostPerLevel]
	ManaPerSecond       int     // [ManaPerSecond]
	PowerDisplayID      int     // [PowerDisplayID] NULL → 0
	AltPowerBarID       int     // [AltPowerBarID]
	PowerCostPct        float64 // [PowerCostPct]
	PowerCostMaxPct     float64 // [PowerCostMaxPct]
	PowerPctPerSecond   float64 // [PowerPctPerSecond]
	PowerType           int     // [PowerType]     NULL → 0
	RequiredAuraSpellID int     // [RequiredAuraSpellID] NULL → 0
	OptionalCost        int     // [OptionalCost]
	SpellID             int     // [SpellID]      NULL → 0
}

func (sd *SpellPower) GetPowerType() proto.ResourceType {
	switch sd.PowerType {
	case POWER_MANA:
		return proto.ResourceType_ResourceTypeMana
	case POWER_RAGE:
		return proto.ResourceType_ResourceTypeRage
	case POWER_FOCUS:
		return proto.ResourceType_ResourceTypeFocus
	case POWER_ENERGY:
		return proto.ResourceType_ResourceTypeEnergy
	case POWER_COMBO_POINT:
		return proto.ResourceType_ResourceTypeComboPoints
	case POWER_RUNIC_POWER:
		return proto.ResourceType_ResourceTypeRunicPower
	case POWER_BLOOD_RUNE:
		return proto.ResourceType_ResourceTypeBloodRune
	case POWER_FROST_RUNE:
		return proto.ResourceType_ResourceTypeFrostRune
	case POWER_UNHOLY_RUNE:
		return proto.ResourceType_ResourceTypeUnholyRune
	case POWER_HOLY_POWER:
		return proto.ResourceType_ResourceTypeHolyPower
	default:
		return proto.ResourceType_ResourceTypeNone
	}
}

// func (sd *SpellPower) GetMaxCost() float64 {
// 	if sd.CostMax != 0 {
// 		return float64(sd.CostMax) / sd.costDivisor(!(sd.ManaCost != 0))
// 	}
// 	return float64(sd.PowerCostMaxPct) / sd.costDivisor(!(sd.ManaCost != 0))
// }

func (sd *SpellPower) GetCostPerTick() float64 {
	return float64(sd.ManaPerSecond) / sd.costDivisor(!(sd.ManaCost != 0))
}

func (sd *SpellPower) GetCost() float64 {
	cost := 0.0
	if sd.ManaCost != 0 {
		cost = float64(sd.ManaCost)
	} else {
		cost = sd.PowerCostPct
	}
	return cost / sd.costDivisor(!(sd.ManaCost != 0))
}

func (sd *SpellPower) costDivisor(percentage bool) float64 {
	switch sd.PowerType {
	case POWER_MANA:
		if percentage {
			return 100.0
		}
		return 1.0
	case POWER_RAGE, POWER_RUNIC_POWER, POWER_ASTRAL_POWER, POWER_SOUL_SHARDS:
		return 10.0
	default:
		return 1.0
	}

}
