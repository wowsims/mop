package dbc

import (
	"math"

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
	MaxCumulativeStacks  int // Max cumulative stacks
	SpellID              int // Spell ID
	ChrSpecializationID  int // Character specialization ID
	ParentItemID         int // Parent item ID
}

// ToMap returns a generic representation of the effect.
func (e *ItemEffect) ToMap() map[string]interface{} {
	return map[string]interface{}{
		"ID":                   e.ID,
		"LegacySlotIndex":      e.LegacySlotIndex,
		"TriggerType":          e.TriggerType,
		"Charges":              e.Charges,
		"CoolDownMSec":         e.CoolDownMSec,
		"CategoryCoolDownMSec": e.CategoryCoolDownMSec,
		"SpellCategoryID":      e.SpellCategoryID,
		"MaxCumulativeStacks":  e.MaxCumulativeStacks,
		"SpellID":              e.SpellID,
		"ChrSpecializationID":  e.ChrSpecializationID,
		"ParentItemID":         e.ParentItemID,
	}
}

func GetItemEffect(effectId int) ItemEffect {
	return dbcInstance.ItemEffects[effectId]
}

func makeBaseProto(e *ItemEffect, statsSpellID int) *proto.ItemEffect {
	sp := dbcInstance.Spells[e.SpellID]
	base := &proto.ItemEffect{
		BuffId:           int32(e.SpellID),
		BuffName:         sp.NameLang,
		EffectDurationMs: int32(sp.Duration),
		ScalingOptions:   make(map[int32]*proto.ScalingItemEffectProperties),
	}
	// override duration if stats spell defines its own
	if dur := dbcInstance.Spells[statsSpellID].Duration; dur > 0 {
		base.EffectDurationMs = int32(dur)
	}
	return base
}

func assignTrigger(e *ItemEffect, statsSpellID int, pe *proto.ItemEffect) {
	spTop := dbcInstance.Spells[e.SpellID]
	statsSP := dbcInstance.Spells[statsSpellID]
	switch resolveTriggerType(e.TriggerType, e.SpellID) {
	case ITEM_SPELLTRIGGER_ON_USE:
		pe.Effect = &proto.ItemEffect_OnUse{OnUse: &proto.OnUseEffect{
			CooldownMs:         int32(e.CoolDownMSec),
			CategoryId:         int32(e.SpellCategoryID),
			CategoryCooldownMs: int32(e.CategoryCoolDownMSec),
		}}
	case ITEM_SPELLTRIGGER_CHANCE_ON_HIT:
		proc := &proto.ProcEffect{
			IcdMs: spTop.ProcCategoryRecovery,
		}

		// if we have a PPM value given, that must be RPPM
		// There is no item with both a Haste and a Crit modifier
		if spTop.SpellProcsPerMinute > 0 {
			mods := []*proto.RppmMod{}
			for _, mod := range spTop.RppmModifiers {
				switch mod.ModifierType {
				case RPPMModifierHaste:
					mods = append(mods, &proto.RppmMod{ModType: &proto.RppmMod_Haste{}, Coefficient: mod.Coeff})
				case RPPMModifierCrit:
					mods = append(mods, &proto.RppmMod{ModType: &proto.RppmMod_Crit{}, Coefficient: mod.Coeff})
				case RPPMModifierSpec:
					mods = append(mods, &proto.RppmMod{ModType: &proto.RppmMod_Spec{Spec: SpecFromID(mod.Param)}, Coefficient: mod.Coeff})
				case RPPMModifierClass:
					mods = append(mods, &proto.RppmMod{ModType: &proto.RppmMod_ClassMask{ClassMask: mod.Param}, Coefficient: mod.Coeff})
				case RPPMModifierIlevel:
					mods = append(mods, &proto.RppmMod{ModType: &proto.RppmMod_Ilvl{Ilvl: mod.Param}, Coefficient: mod.Coeff})
				}
			}

			proc.ProcRate = &proto.ProcEffect_Rppm{
				Rppm: &proto.RppmProc{
					Rate: float64(spTop.SpellProcsPerMinute),
					Mods: mods,
				},
			}

		} else if spTop.ProcChance == 0 || spTop.ProcChance > 100 {
			// If proc chance is above 100 something weird is happening so we set
			// ppm to 1 since we cant accurately proc it 100% of the time
			ppm := math.Max(1, getPPMForItemID(int32(e.ParentItemID)))
			proc.ProcRate = &proto.ProcEffect_Ppm{
				Ppm: ppm,
			}
		} else {
			proc.ProcRate = &proto.ProcEffect_ProcChance{
				ProcChance: float64(spTop.ProcChance) / 100,
			}
		}

		pe.BuffId = statsSP.ID
		pe.BuffName = statsSP.NameLang
		pe.Effect = &proto.ItemEffect_Proc{Proc: proc}

		// In MoP a lot of times the stacks are on the stats spelkl not the trigger spell,
		// so we make sure to check both and take the max of the two if they are different.
		maxCumulativeStacks := max(statsSP.MaxCumulativeStacks, spTop.MaxCumulativeStacks)
		if maxCumulativeStacks > 0 {
			pe.MaxCumulativeStacks = maxCumulativeStacks
		}
	}
}

func (e *ItemEffect) ToProto(itemLevel int, levelState proto.ItemLevelState) (*proto.ItemEffect, bool) {
	statsSpellID := resolveStatsSpell(e.SpellID)

	pe := makeBaseProto(e, statsSpellID)
	assignTrigger(e, statsSpellID, pe)

	// build scaling properties and skip if empty
	props := buildScalingProps(statsSpellID, itemLevel, e.SpellID)

	if len(props.Stats) == 0 {
		return nil, false
	}

	pe.ScalingOptions[int32(levelState)] = props

	return pe, true
}

func resolveStatsSpell(spellID int) int {
	for _, se := range dbcInstance.SpellEffects[spellID] {
		switch se.EffectAura {
		case A_MOD_STAT, A_MOD_RATING, A_MOD_RANGED_ATTACK_POWER, A_MOD_ATTACK_POWER, A_MOD_DAMAGE_DONE, A_MOD_TARGET_RESISTANCE, A_MOD_RESISTANCE, A_MOD_INCREASE_ENERGY,
			A_MOD_INCREASE_HEALTH_2, A_PERIODIC_TRIGGER_SPELL:
			return spellID
		}
	}

	// If we cant resolve the spell in the first loop, we follow proc triggers downwards
	for _, se := range dbcInstance.SpellEffects[spellID] {
		switch se.EffectAura {
		case A_PROC_TRIGGER_SPELL, A_PROC_TRIGGER_SPELL_WITH_VALUE:
			return resolveStatsSpell(se.EffectTriggerSpell)
		}
	}
	return spellID
}

func resolveTriggerType(topType, spellID int) int {
	if topType == ITEM_SPELLTRIGGER_ON_USE || topType == ITEM_SPELLTRIGGER_CHANCE_ON_HIT {
		return topType
	}
	for _, se := range dbcInstance.SpellEffects[spellID] {
		if se.EffectAura == A_PROC_TRIGGER_SPELL || se.EffectAura == A_PROC_TRIGGER_SPELL_WITH_VALUE {
			return ITEM_SPELLTRIGGER_CHANCE_ON_HIT
		}
	}
	return topType
}

func buildScalingProps(spellID, itemLevel, itemSpellID int) *proto.ScalingItemEffectProperties {
	total := collectStats(spellID, itemLevel)

	// check if spell is procced by a SPELL_WITH_VALUE
	if effects, ok := dbcInstance.SpellEffects[itemSpellID]; ok {
		for _, se := range effects {
			if se.EffectAura == A_PROC_TRIGGER_SPELL_WITH_VALUE && spellID == se.EffectTriggerSpell {
				for idx := range total {
					if total[idx] == 0 {
						continue
					}

					total[idx] = float64(se.EffectBasePoints)
				}
			}
		}
	}

	return &proto.ScalingItemEffectProperties{Stats: total.ToProtoMap()}
}

func collectStats(spellID, itemLevel int) stats.Stats {
	var total stats.Stats

	var emptyStats = stats.Stats{}
	visited := make(map[int]bool)

	var recurse func(int)
	recurse = func(id int) {
		if visited[id] {
			return
		}
		visited[id] = true

		sp := dbcInstance.Spells[id]
		for _, se := range dbcInstance.SpellEffects[id] {
			s := se.ParseStatEffect(sp.HasAttributeAt(11, 0x4), itemLevel)
			if s != nil && *s != emptyStats {
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
		if pe, ok := ie.ToProto(itemLevel, levelState); ok {
			out = append(out, pe)
		}
	}
	return out
}

func GetItemEffectSpellTooltip(itemID int, buffId int) (string, int) {
	raw := dbcInstance.ItemEffectsByParentID[itemID]
	var spellID int

	for _, effect := range raw {
		spellID = effect.SpellID
		if effect.SpellID == buffId {
			spellID = effect.SpellID
			break
		} else {
			triggerEffects := dbcInstance.SpellEffects[effect.SpellID]
			if len(triggerEffects) == 0 {
				continue
			}
			if spellEffect := GetSpellEffectRecursive(buffId, triggerEffects); spellEffect != nil {
				if spellEffect.EffectTriggerSpell == buffId {
					spellID = effect.SpellID
				}
				break
			}
		}
	}
	spell := dbcInstance.Spells[spellID]
	return spell.Description, spellID
}

func GetItemEffectForBuffID(itemID int, buffId int) *ItemEffect {
	raw := dbcInstance.ItemEffectsByParentID[itemID]
	var itemEffect *ItemEffect
	for _, effect := range raw {
		if effect.SpellID == buffId {
			itemEffect = &effect
			break
		} else {
			triggerEffects := dbcInstance.SpellEffects[effect.SpellID]
			if len(triggerEffects) == 0 {
				continue
			}
			if spellEffect := GetSpellEffectRecursive(buffId, triggerEffects); spellEffect != nil {
				if spellEffect.EffectTriggerSpell == buffId {
					return &effect
				}
				break
			}
		}
	}
	return itemEffect
}

func GetSpellEffectRecursive(spellIDToMatch int, spellEffects map[int]SpellEffect) *SpellEffect {
	for _, spellEffect := range spellEffects {
		if spellEffect.EffectTriggerSpell != 0 {
			if spellEffect.EffectTriggerSpell == spellIDToMatch {
				return &spellEffect
			} else {
				triggerEffects := dbcInstance.SpellEffects[spellEffect.EffectTriggerSpell]
				return GetSpellEffectRecursive(spellIDToMatch, triggerEffects)
			}
		}
	}
	return nil
}

// Parses a UIItem and loops through Scaling Options for that item.
func MergeItemEffectsForAllStates(parsed *proto.UIItem) []*proto.ItemEffect {
	var effects []*proto.ItemEffect

	// pick a base effect that has stats if there is more than one effect on the item
	for i := range dbcInstance.ItemEffectsByParentID[int(parsed.Id)] {
		var baseEff *ItemEffect

		e := &dbcInstance.ItemEffectsByParentID[int(parsed.Id)][i]
		triggerType := resolveTriggerType(e.TriggerType, e.SpellID)
		statsSpellID := resolveStatsSpell(e.SpellID)
		statsSpell := dbcInstance.Spells[statsSpellID]
		isValidSpell := statsSpell.ID != 0
		props := buildScalingProps(statsSpellID, int(parsed.ScalingOptions[int32(proto.ItemLevelState_Base)].Ilvl), e.SpellID)
		hasStats := len(props.Stats) > 0

		if !isValidSpell {
			continue
		}

		if triggerType == ITEM_SPELLTRIGGER_ON_EQUIP && hasStats {
			for stat, value := range props.Stats {
				parsed.ScalingOptions[0].Stats[int32(stat)] += value
			}
			continue
		} else if triggerType == ITEM_SPELLTRIGGER_ON_EQUIP || triggerType == ITEM_SPELLTRIGGER_CHANCE_ON_HIT || e.CoolDownMSec > 0 {
			baseEff = e
		} else {
			continue
		}

		pe := makeBaseProto(baseEff, statsSpellID)
		assignTrigger(baseEff, statsSpellID, pe)

		// add scaling for each saved state
		for state, opt := range parsed.ScalingOptions {
			ilvl := int(opt.Ilvl)
			pe.ScalingOptions[state] = buildScalingProps(statsSpellID, ilvl, baseEff.SpellID)
		}

		effects = append(effects, pe)
	}

	return effects
}
