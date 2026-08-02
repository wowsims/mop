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
	return GetDBC().ItemEffects[effectId]
}

func makeBaseProto(e *ItemEffect, statsSpellID int) *proto.ItemEffect {
	sp := GetDBC().Spells[e.SpellID]
	base := &proto.ItemEffect{
		BuffId:           int32(e.SpellID),
		BuffName:         sp.NameLang,
		EffectDurationMs: int32(sp.Duration),
		ScalingOptions:   make(map[int32]*proto.ScalingItemEffectProperties),
	}
	// override duration if stats spell defines its own
	if dur := GetDBC().Spells[statsSpellID].Duration; dur > 0 {
		base.EffectDurationMs = int32(dur)
	}
	return base
}

// On a stacking effect the aura the trigger applies grants nothing itself, so its scaling options
// resolve to an empty message at every item level state. ScalingItemEffectProperties holds only a
// stats map, so those entries carry no information at all — drop the whole map rather than ship
// one empty entry per state. Readers reach the map through GetStats(), which is nil-safe.
//
// A no-op when anything did resolve, which keeps this honest if an effect ever carries stats on
// both the trigger aura and the aura it accumulates.
func dropEmptyScalingOptions(pe *proto.ItemEffect) {
	for _, opt := range pe.ScalingOptions {
		if len(opt.GetStats()) > 0 {
			return
		}
	}
	pe.ScalingOptions = nil
}

func assignTrigger(e *ItemEffect, statsSpellID int, pe *proto.ItemEffect) {
	spTop := GetDBC().Spells[e.SpellID]
	statsSP := GetDBC().Spells[statsSpellID]
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

// The stats an effect grants at one item level state.
//
// A stacking effect grants nothing through the aura its trigger applies - the stats it is named
// after live on the aura that accumulates - so an empty scaling option is not the same as no
// stats, and no caller may read ScalingOptions directly to answer this question.
func EffectStats(effect *proto.ItemEffect, levelState proto.ItemLevelState) map[int32]float64 {
	state := int32(levelState)
	if stats := effect.GetScalingOptions()[state].GetStats(); len(stats) > 0 {
		return stats
	}

	return effect.GetStackingAura().GetScalingOptions()[state].GetStats()
}

// Assembles the proto for an effect: its buff, its trigger, the stats it resolves to at each of
// ilvlByState's item levels, and the stacking aura it accumulates if it has one. Reports whether
// any stats resolved at any state.
//
// identityIlvl is the item level the stacking aura is looked for at. Which state it comes from
// does not change the answer - see referencedStatAura - only that it is not left to map
// iteration order.
func buildEffectProto(e *ItemEffect, statsSpellID int, ilvlByState map[int32]int, identityIlvl int) (*proto.ItemEffect, bool) {
	pe := makeBaseProto(e, statsSpellID)
	assignTrigger(e, statsSpellID, pe)

	for state, ilvl := range ilvlByState {
		pe.ScalingOptions[state] = buildScalingProps(statsSpellID, ilvl, e.SpellID)
	}

	// A container aura that accumulates a separate stat aura resolves its amounts at every
	// state too, and per stack rather than in total.
	if stacking, stackPeriodMs := buildStackingAura(statsSpellID, identityIlvl); stacking != nil {
		for state, ilvl := range ilvlByState {
			stacking.ScalingOptions[state] = buildStackingProps(statsSpellID, int(stacking.BuffId), ilvl, e.SpellID)
		}
		pe.StackingAura = stacking
		pe.StackPeriodMs = stackPeriodMs
		dropEmptyScalingOptions(pe)
	}

	for state := range ilvlByState {
		if len(EffectStats(pe, proto.ItemLevelState(state))) > 0 {
			return pe, true
		}
	}

	return pe, false
}

// Assembles the proto for an effect at a single state and reports whether any stats were
// resolved. Callers that only care about stat effects should use ToProto, which drops
// the effect when there are none; callers that need the trigger regardless (on-use
// enchants carry a real cooldown even when their buff is server-scripted) use this.
func (e *ItemEffect) BuildProto(itemLevel int, levelState proto.ItemLevelState) (*proto.ItemEffect, bool) {
	return buildEffectProto(e, resolveStatsSpell(e.SpellID), map[int32]int{int32(levelState): itemLevel}, itemLevel)
}

func (e *ItemEffect) ToProto(itemLevel int, levelState proto.ItemLevelState) (*proto.ItemEffect, bool) {
	pe, hasStats := e.BuildProto(itemLevel, levelState)
	if !hasStats {
		return nil, false
	}

	return pe, true
}

func resolveStatsSpell(spellID int) int {
	return newChainWalker().resolveStatsSpell(spellID)
}

func (w *chainWalker) resolveStatsSpell(spellID int) int {
	effects := w.effects(spellID)
	for _, se := range effects {
		if se.GrantsStats() {
			return spellID
		}
	}

	// If we cant resolve the spell in the first loop, we follow proc triggers downwards
	for _, se := range effects {
		if se.IsProcTrigger() {
			return w.resolveStatsSpell(se.EffectTriggerSpell)
		}
	}
	return spellID
}

func resolveTriggerType(topType, spellID int) int {
	if topType == ITEM_SPELLTRIGGER_ON_USE || topType == ITEM_SPELLTRIGGER_CHANCE_ON_HIT {
		return topType
	}
	for _, se := range GetDBC().SpellEffectsInOrder(spellID) {
		if se.IsProcTrigger() {
			return ITEM_SPELLTRIGGER_CHANCE_ON_HIT
		}
	}
	return topType
}

func buildScalingProps(spellID, itemLevel, itemSpellID int) *proto.ScalingItemEffectProperties {
	total := collectStats(spellID, itemLevel)

	// check if spell is procced by a SPELL_WITH_VALUE
	if effects := GetDBC().SpellEffectsInOrder(itemSpellID); len(effects) > 0 {
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
	newChainWalker().collectStats(spellID, itemLevel, &total)
	return total
}

func (w *chainWalker) collectStats(spellID, itemLevel int, total *stats.Stats) {
	sp := GetDBC().Spells[spellID]
	for _, se := range w.effects(spellID) {
		if s, resolved := se.ParseStatEffect(sp.ScalesWithItemLevel(), itemLevel); resolved {
			total.AddInplace(&s)
		} else if se.EffectAura == A_PROC_TRIGGER_SPELL {
			// Deliberately narrower than IsProcTrigger: descending through a
			// A_PROC_TRIGGER_SPELL_WITH_VALUE would collect the triggered spell's own amounts,
			// past the point where buildScalingProps can still override them with the value
			// the trigger carries.
			w.collectStats(se.EffectTriggerSpell, itemLevel, total)
		}
	}
}

func ParseItemEffects(itemID, itemLevel int, levelState proto.ItemLevelState) []*proto.ItemEffect {
	raw := GetDBC().ItemEffectsByParentID[itemID]
	out := make([]*proto.ItemEffect, 0, len(raw))
	for _, ie := range raw {
		if pe, ok := ie.ToProto(itemLevel, levelState); ok {
			out = append(out, pe)
		}
	}
	return out
}

func GetItemEffectSpellTooltip(itemID int, buffId int) (string, int) {
	raw := GetDBC().ItemEffectsByParentID[itemID]
	var spellID int

	for _, effect := range raw {
		spellID = effect.SpellID
		if effect.SpellID == buffId {
			break
		}

		if len(GetDBC().SpellEffects[effect.SpellID]) == 0 {
			continue
		}
		if GetSpellEffectRecursive(buffId, effect.SpellID) != nil {
			break
		}
	}
	spell := GetDBC().Spells[spellID]
	return spell.Description, spellID
}

func GetItemEffectForBuffID(itemID int, buffId int) *ItemEffect {
	raw := GetDBC().ItemEffectsByParentID[itemID]
	var itemEffect *ItemEffect
	for _, effect := range raw {
		if effect.SpellID == buffId {
			itemEffect = &effect
			break
		}

		if len(GetDBC().SpellEffects[effect.SpellID]) == 0 {
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
	return newChainWalker().findTriggerOf(spellIDToMatch, spellID)
}

func (w *chainWalker) findTriggerOf(spellIDToMatch int, spellID int) *SpellEffect {
	for _, spellEffect := range w.effects(spellID) {
		if spellEffect.EffectTriggerSpell == 0 {
			continue
		}

		if spellEffect.EffectTriggerSpell == spellIDToMatch {
			return &spellEffect
		}

		if match := w.findTriggerOf(spellIDToMatch, spellEffect.EffectTriggerSpell); match != nil {
			return match
		}
	}
	return nil
}

// Parses a UIItem and loops through Scaling Options for that item.
func MergeItemEffectsForAllStates(parsed *proto.UIItem) []*proto.ItemEffect {
	var effects []*proto.ItemEffect

	baseIlvl := int(parsed.ScalingOptions[int32(proto.ItemLevelState_Base)].Ilvl)
	ilvlByState := map[int32]int{}
	for state, opt := range parsed.ScalingOptions {
		ilvlByState[state] = int(opt.Ilvl)
	}

	// pick a base effect that has stats if there is more than one effect on the item
	for i := range GetDBC().ItemEffectsByParentID[int(parsed.Id)] {
		e := &GetDBC().ItemEffectsByParentID[int(parsed.Id)][i]
		statsSpellID := resolveStatsSpell(e.SpellID)
		if GetDBC().Spells[statsSpellID].ID == 0 {
			continue
		}

		triggerType := resolveTriggerType(e.TriggerType, e.SpellID)
		if triggerType == ITEM_SPELLTRIGGER_ON_EQUIP && len(buildScalingProps(statsSpellID, baseIlvl, e.SpellID).Stats) > 0 {
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
		}

		// A cooldown of -1 is "none", so it does not make an otherwise untriggered effect
		// worth carrying.
		if triggerType != ITEM_SPELLTRIGGER_ON_EQUIP && triggerType != ITEM_SPELLTRIGGER_CHANCE_ON_HIT && e.CoolDownMSec <= 0 {
			continue
		}

		pe, _ := buildEffectProto(e, statsSpellID, ilvlByState, baseIlvl)
		effects = append(effects, pe)
	}

	return effects
}
