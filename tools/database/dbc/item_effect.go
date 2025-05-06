package dbc

import (
	"maps"

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

var emptyStats = stats.Stats{}

func (e *ItemEffect) ToProto(itemLevel int, levelState proto.ItemLevelState) *proto.ItemEffect {
	pe := newProtoShell(e)

	statsSpellID := applyTrigger(e, pe)

	pe.ScalingOptions[int32(levelState)] = buildScalingProps(statsSpellID, itemLevel)
	return pe
}

func newProtoShell(e *ItemEffect) *proto.ItemEffect {
	sp := dbcInstance.Spells[e.SpellID]
	return &proto.ItemEffect{
		SpellId:        int32(e.SpellID),
		Type:           proto.ItemEffectType_NONE,
		EffectDuration: int32(sp.Duration),
		MaxStacks:      int32(sp.MaxCharges),
		StackInterval:  int32(e.CoolDownMSec / 1000),
		ScalingOptions: make(map[int32]*proto.ScalingItemEffectProperties),
	}
}

func applyTrigger(e *ItemEffect, pe *proto.ItemEffect) int {
	trig, statsSpellID := resolveTrigger(e.TriggerType, e.SpellID)

	switch trig {
	case ITEM_SPELLTRIGGER_ON_USE:
		pe.Type = proto.ItemEffectType_ON_USE
		pe.Effect = &proto.ItemEffect_OnUse{
			OnUse: &proto.OnUseEffect{
				Cooldown:         int32(e.CoolDownMSec / 1000),
				CategoryId:       int32(e.SpellCategoryID),
				CategoryCooldown: int32(e.CategoryCoolDownMSec / 1000),
			},
		}

	case ITEM_SPELLTRIGGER_CHANCE_ON_HIT:
		// For procchance and ICD we always use the original spell id
		spTop := dbcInstance.Spells[e.SpellID]
		pe.Type = proto.ItemEffectType_PROC
		pe.Effect = &proto.ItemEffect_Proc{
			Proc: &proto.ProcEffect{
				ProcChance: float64(spTop.ProcChance) / 100,
				Icd:        int32(spTop.ProcCategoryRecovery / 1000),
			},
		}

	default:
		// leave as NONE
	}

	return statsSpellID
}

func resolveTrigger(topType, spellID int) (triggerType, statsSpellID int) {
	if topType == ITEM_SPELLTRIGGER_ON_USE || topType == ITEM_SPELLTRIGGER_CHANCE_ON_HIT {
		return topType, spellID
	}
	for _, se := range dbcInstance.SpellEffects[spellID] {
		if se.EffectAura == A_PROC_TRIGGER_SPELL {
			// stats come from the triggered spell
			return resolveTrigger(ITEM_SPELLTRIGGER_CHANCE_ON_HIT, se.EffectTriggerSpell)
		}
	}
	return topType, spellID
}

func buildScalingProps(spellID, itemLevel int) *proto.ScalingItemEffectProperties {
	total := collectStats(spellID, itemLevel)
	src := total.ToProtoMap()

	m := make(map[int32]float64, len(src))
	maps.Copy(m, src)

	return &proto.ScalingItemEffectProperties{Stats: m}
}

func collectStats(spellID, itemLevel int) stats.Stats {
	var total stats.Stats
	visited := make(map[int]bool)

	var recurse func(int)
	recurse = func(id int) {
		if visited[id] {
			return
		}
		visited[id] = true

		sp := dbcInstance.Spells[id]
		for _, se := range dbcInstance.SpellEffects[id] {
			if s := se.ParseStatEffect(sp.HasAttributeAt(11, 0x4), itemLevel); s != &emptyStats {
				total.AddInplace(s)
			} else if se.EffectAura == A_PROC_TRIGGER_SPELL {
				recurse(se.EffectTriggerSpell)
			}
		}
	}

	recurse(spellID)
	return total
}

func ParseItemEffects(itemID, itemLevel int, levelState proto.ItemLevelState) []*proto.ItemEffect {
	raw := dbcInstance.ItemEffectsByParentID[itemID]
	out := make([]*proto.ItemEffect, 0, len(raw))
	for _, ie := range raw {
		out = append(out, ie.ToProto(itemLevel, levelState))
	}
	return out
}

func MergeItemEffectsForAllStates(parsed *proto.UIItem) []*proto.ItemEffect {
	itemID := int(parsed.Id)
	raws := dbcInstance.ItemEffectsByParentID[itemID]
	var merged []*proto.ItemEffect

	for idx := range raws {
		var base *proto.ItemEffect

		for key, props := range parsed.ScalingOptions {
			state := proto.ItemLevelState(key)
			ilvl := int(props.Ilvl)
			slice := ParseItemEffects(itemID, ilvl, state)
			eff := slice[idx]

			if base == nil {
				base = eff
			} else {
				base.ScalingOptions[key] = eff.ScalingOptions[key]
			}
		}
		if base == nil {
			continue
		}

		for k, props := range base.ScalingOptions {
			if props == nil || len(props.Stats) == 0 {
				delete(base.ScalingOptions, k)
			}
		}
		if len(base.ScalingOptions) > 0 {
			merged = append(merged, base)
		}
	}
	return merged
}
