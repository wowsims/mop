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

// Assembles the proto for an effect and reports whether any stats were resolved.
// Callers that only care about stat effects should use ToProto, which drops
// the effect when there are none; callers that need the trigger regardless (on-use
// enchants carry a real cooldown even when their buff is server-scripted) use this.
func (e *ItemEffect) BuildProto(itemLevel int, levelState proto.ItemLevelState) (*proto.ItemEffect, bool) {
	statsSpellID := resolveStatsSpell(e.SpellID)

	pe := makeBaseProto(e, statsSpellID)
	assignTrigger(e, statsSpellID, pe)

	props := buildScalingProps(statsSpellID, itemLevel, e.SpellID)
	pe.ScalingOptions[int32(levelState)] = props

	return pe, len(props.Stats) > 0
}

func (e *ItemEffect) ToProto(itemLevel int, levelState proto.ItemLevelState) (*proto.ItemEffect, bool) {
	pe, hasStats := e.BuildProto(itemLevel, levelState)
	if !hasStats {
		return nil, false
	}

	return pe, true
}

func resolveStatsSpell(spellID int) int {
	return resolveStatsSpellVisited(spellID, map[int]bool{})
}

func resolveStatsSpellVisited(spellID int, visited map[int]bool) int {
	// A proc chain that loops back on itself would otherwise recurse until the stack dies,
	// the same hazard getSpellEffectRecursive and collectStats already guard against.
	if visited[spellID] {
		return spellID
	}
	visited[spellID] = true

	effects := dbcInstance.SpellEffectsInOrder(spellID)
	for _, se := range effects {
		switch se.EffectAura {
		case A_MOD_STAT, A_MOD_RATING, A_MOD_RANGED_ATTACK_POWER, A_MOD_ATTACK_POWER, A_MOD_DAMAGE_DONE, A_MOD_TARGET_RESISTANCE, A_MOD_RESISTANCE, A_MOD_INCREASE_ENERGY,
			A_MOD_INCREASE_HEALTH_2, A_PERIODIC_TRIGGER_SPELL:
			return spellID
		}
	}

	// If we cant resolve the spell in the first loop, we follow proc triggers downwards
	for _, se := range effects {
		switch se.EffectAura {
		case A_PROC_TRIGGER_SPELL, A_PROC_TRIGGER_SPELL_WITH_VALUE:
			return resolveStatsSpellVisited(se.EffectTriggerSpell, visited)
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
	if effects := dbcInstance.SpellEffectsInOrder(itemSpellID); len(effects) > 0 {
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
		for _, se := range dbcInstance.SpellEffectsInOrder(id) {
			s := se.ParseStatEffect(sp.ScalesWithItemLevel(), itemLevel)
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
			break
		}

		if len(dbcInstance.SpellEffects[effect.SpellID]) == 0 {
			continue
		}
		if GetSpellEffectRecursive(buffId, effect.SpellID) != nil {
			break
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
		}

		if len(dbcInstance.SpellEffects[effect.SpellID]) == 0 {
			continue
		}
		if GetSpellEffectRecursive(buffId, effect.SpellID) != nil {
			return &effect
		}
	}
	return itemEffect
}

// Walks the trigger chain below spellID and returns the effect that triggers
// spellIDToMatch, or nil. Effects are visited in index order
// and a branch that does not contain the match does not abort the search of its
// siblings.
func GetSpellEffectRecursive(spellIDToMatch int, spellID int) *SpellEffect {
	return getSpellEffectRecursive(spellIDToMatch, spellID, map[int]bool{})
}

func getSpellEffectRecursive(spellIDToMatch int, spellID int, visited map[int]bool) *SpellEffect {
	if visited[spellID] {
		return nil
	}
	visited[spellID] = true

	for _, spellEffect := range dbcInstance.SpellEffectsInOrder(spellID) {
		if spellEffect.EffectTriggerSpell == 0 {
			continue
		}

		if spellEffect.EffectTriggerSpell == spellIDToMatch {
			return &spellEffect
		}

		if match := getSpellEffectRecursive(spellIDToMatch, spellEffect.EffectTriggerSpell, visited); match != nil {
			return match
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
		baseProps := buildScalingProps(statsSpellID, int(parsed.ScalingOptions[int32(proto.ItemLevelState_Base)].Ilvl), e.SpellID)
		hasStats := len(baseProps.Stats) > 0

		if !isValidSpell {
			continue
		}

		if triggerType == ITEM_SPELLTRIGGER_ON_EQUIP && hasStats {
			// Fold into every scaling state, resolved at that state's own item level, the way
			// the proc path below does. Writing only ScalingOptions[Base] left the stat off
			// the challenge mode and upgrade states entirely, and copying the base value over
			// would be wrong too since the amount scales with item level.
			for _, opt := range parsed.ScalingOptions {
				for stat, value := range buildScalingProps(statsSpellID, int(opt.Ilvl), e.SpellID).Stats {
					opt.Stats[int32(stat)] += value
				}
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
