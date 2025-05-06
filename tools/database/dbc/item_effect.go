package dbc

import (
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// ItemEffect represents an item effect in the game.
type ItemEffect struct {
	ID                   int // Effect ID
	LegacySlotIndex      int // Legacy slot index
	TriggerType          int // Trigger type
	Charges              int // Number of charges
	CoolDownMSec         int // Cooldown in milliseconds
	CategoryCoolDownMSec int // Category cooldown in milliseconds
	SpellCategoryID      int // Spell category ID
	SpellID              int // Spell ID
	ChrSpecializationID  int // Character specialization ID
	ParentItemID         int // Parent item ID
}

// ToMap converts the ItemEffect to a map representation.
func (e *ItemEffect) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"ID":                   e.ID,
		"LegacySlotIndex":      e.LegacySlotIndex,
		"TriggerType":          e.TriggerType,
		"Charges":              e.Charges,
		"CoolDownMSec":         e.CoolDownMSec,
		"CategoryCoolDownMSec": e.CategoryCoolDownMSec,
		"SpellCategoryID":      e.SpellCategoryID,
		"SpellID":              e.SpellID,
		"ChrSpecializationID":  e.ChrSpecializationID,
		"ParentItemID":         e.ParentItemID,
	}
}

func GetItemEffect(effectId int) ItemEffect {
	return dbcInstance.ItemEffects[effectId]
}

// collectSpellStats walks through all SpellEffects for a given spellID,
// summing any direct stats, and—if an effect has EffectAura == A_PROC_TRIGGER_SPELL—
// recurses into the triggered spell exactly once (guarded by visited).
func collectSpellStats(spellID int, visited map[int]bool) stats.Stats {
	if visited[spellID] {
		return stats.Stats{}
	}
	visited[spellID] = true

	var total stats.Stats
	for _, se := range dbcInstance.SpellEffects[spellID] {
		// 1) Direct stat effects
		if s := se.ParseStatEffect(); s != nil {
			total.Add(*s)
			continue
		}

		// 2) If this effect “triggers” another spell, follow it
		if se.EffectAura == A_PROC_TRIGGER_SPELL {
			// se.TriggerSpellID holds the ID of the spell to recurse into
			total.Add(collectSpellStats(se.EffectTriggerSpell, visited))
		}

		// 3) (Optional) you could handle A_PROC_TRIGGER_DAMAGE here if needed
	}
	return total
}

// ToProto converts this ItemEffect into a *proto.ItemEffect.
// It sets Name, ItemId, Type, Stats (including any recursive proc‑spell stats),
// and the correct oneof Proc/OnUse/Rppm sub‑message.
func (e *ItemEffect) ToProto() *proto.ItemEffect {
	pe := &proto.ItemEffect{
		Name:           "", // TODO: pull human name from dbcInstance.Spells[e.SpellID]
		ItemId:         int32(e.ParentItemID),
		EffectDuration: 0, // TODO: set from your spell’s duration field (in seconds)
		MaxStacks:      int32(e.Charges),
		StackInterval:  int32(e.CategoryCoolDownMSec / 1000),
		Stats:          make(map[int32]float64),
	}

	// Accumulate stats from this effect’s spell (including any triggered spells)
	statsMap := collectSpellStats(e.SpellID, make(map[int]bool))
	for statIdx, val := range statsMap {
		pe.Stats[int32(statIdx)] = val
	}

	// Map DBC trigger → protobuf oneof + enum
	switch e.TriggerType {
	case ITEM_SPELLTRIGGER_ON_USE:
		pe.Type = proto.ItemEffectType_ON_USE
		pe.Effect = &proto.ItemEffect_OnUse{
			OnUse: &proto.OnUseEffect{
				Cooldown: int32(e.CoolDownMSec / 1000),
			},
		}

	case ITEM_SPELLTRIGGER_CHANCE_ON_HIT,
		ITEM_SPELLTRIGGER_ON_EQUIP:
		// If the spell itself has a procChance, treat it as a ProcEffect
		sp := dbcInstance.Spells[e.SpellID]
		pe.Type = proto.ItemEffectType_PROC
		pe.Effect = &proto.ItemEffect_Proc{
			Proc: &proto.ProcEffect{
				ProcChance: float64(sp.ProcChance) / 100,
				Icd:        int32(sp.ProcCategoryRecovery / 1000),
			},
		}

	case ITEM_SPELLTRIGGER_RPPM:
		pe.Type = proto.ItemEffectType_RPPM
		pe.Effect = &proto.ItemEffect_Rppm{
			Rppm: &proto.RPPMEffect{
				Rppm: 0, // TODO: fill in real PPM from sp.SpellProcsPerMinute
			},
		}

	default:
		pe.Type = proto.ItemEffectType_NONE
	}

	return pe
}

// ParseItemEffects returns all ItemEffects for itemID as protobufs.
func ParseItemEffects(itemID int) []*proto.ItemEffect {
	res := make([]*proto.ItemEffect, 0, len(dbcInstance.ItemEffectsByParentID[itemID]))
	for _, ie := range dbcInstance.ItemEffectsByParentID[itemID] {
		res = append(res, ie.ToProto())
	}
	return res
}
