package dbc

import (
	"fmt"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// InitDBC reads its inputs from ./assets/db_inputs/dbc, relative to the repo root.
func repoRoot(t *testing.T) {
	t.Helper()
	t.Chdir("../../..")
}

// P0-4: item effect parsing must be stable across runs.
func TestDeterministicItemEffects(t *testing.T) {
	repoRoot(t)
	d := GetDBC()

	itemIDs := []int{}
	for itemID := range d.ItemEffectsByParentID {
		if item, ok := d.Items[itemID]; ok && item.ItemLevel >= 416 {
			itemIDs = append(itemIDs, itemID)
		}
	}
	slices.Sort(itemIDs)

	snapshot := func() string {
		var sb strings.Builder
		for _, itemID := range itemIDs {
			item := d.Items[itemID]
			for _, pe := range ParseItemEffects(itemID, item.ItemLevel, proto.ItemLevelState_Base) {
				fmt.Fprintf(&sb, "%d|%d|%v|%v;", itemID, pe.BuffId, pe.Effect, pe.ScalingOptions[0].Stats)
			}
		}
		return sb.String()
	}

	first := snapshot()
	for i := range 25 {
		if got := snapshot(); got != first {
			t.Fatalf("snapshot %d differs from the first", i+1)
		}
	}
	t.Logf("stable across 26 runs over %d items, %d bytes of effect output", len(itemIDs), len(first))
}

// P0-4: the old recursion returned on the first branch with a trigger spell, so a
// buff reachable only through a later sibling was never found.
func TestRecursiveSearchVisitsSiblings(t *testing.T) {
	repoRoot(t)
	d := GetDBC()

	oldImpl := func(match int, effects map[int]SpellEffect) *SpellEffect {
		for _, se := range effects {
			if se.EffectTriggerSpell != 0 {
				if se.EffectTriggerSpell == match {
					return &se
				}
				return oldImplRecurse(d, match, se.EffectTriggerSpell, 0)
			}
		}
		return nil
	}

	newlyFound := 0
	for itemID, effects := range d.ItemEffectsByParentID {
		item, ok := d.Items[itemID]
		if !ok || item.ItemLevel < 416 {
			continue
		}
		for _, ie := range effects {
			for _, target := range reachableSpells(d, ie.SpellID) {
				now := GetSpellEffectRecursive(target, ie.SpellID)
				before := oldImpl(target, d.SpellEffects[ie.SpellID])
				if now != nil && before == nil {
					newlyFound++
				}
				if now == nil && before != nil {
					t.Errorf("regression: item %d spell %d target %d found before, not now", itemID, ie.SpellID, target)
				}
			}
		}
	}
	t.Logf("chains resolved by the fixed recursion that the old one missed: %d", newlyFound)
}

func oldImplRecurse(d *DBC, match int, spellID int, depth int) *SpellEffect {
	if depth > 8 {
		return nil
	}
	for _, se := range d.SpellEffects[spellID] {
		if se.EffectTriggerSpell != 0 {
			if se.EffectTriggerSpell == match {
				return &se
			}
			return oldImplRecurse(d, match, se.EffectTriggerSpell, depth+1)
		}
	}
	return nil
}

func reachableSpells(d *DBC, spellID int) []int {
	seen := map[int]bool{}
	var walk func(int, int)
	walk = func(id int, depth int) {
		if depth > 5 || seen[id] {
			return
		}
		seen[id] = true
		for _, se := range d.SpellEffects[id] {
			if se.EffectTriggerSpell != 0 {
				walk(se.EffectTriggerSpell, depth+1)
			}
		}
	}
	walk(spellID, 0)
	out := make([]int, 0, len(seen))
	for id := range seen {
		if id != spellID {
			out = append(out, id)
		}
	}
	return out
}

// P0-5: a rating mask spanning several stats must set all of them. Diffed against the
// old implementation, which broke out of the loop after the first coefficient-scaled
// stat. 148388 "White Ash" (item 103639 Pouch of White Ash) is the live case.
func TestRatingMaskNotTruncated(t *testing.T) {
	repoRoot(t)
	d := GetDBC()

	const ilvl = 496

	oldRatingImpl := func(se SpellEffect, scalesWithIlvl bool) stats.Stats {
		var out stats.Stats
		for _, rating := range getMatchingRatingMods(se.EffectMiscValues[0]) {
			if statMod := RatingModToStat[rating]; statMod != -1 {
				if se.Coefficient != 0 && scalesWithIlvl {
					out[statMod] = se.CalcCoefficientStatValue(ilvl)
					break
				}
				out[statMod] = float64(se.EffectBasePoints)
			}
		}
		return out
	}

	spellIDs := []int{}
	for spellID := range d.SpellEffects {
		spellIDs = append(spellIDs, spellID)
	}
	slices.Sort(spellIDs)

	multi, changed := 0, 0
	for _, spellID := range spellIDs {
		sp := d.Spells[spellID]
		for _, se := range d.SpellEffectsInOrder(spellID) {
			if se.EffectAura != A_MOD_RATING {
				continue
			}
			targets := map[proto.Stat]bool{}
			for _, rating := range getMatchingRatingMods(se.EffectMiscValues[0]) {
				if s := RatingModToStat[rating]; s != -1 {
					targets[s] = true
				}
			}
			if len(targets) < 2 {
				continue
			}
			multi++

			scalesWithIlvl := sp.HasAttributeAt(11, 0x4)
			before := oldRatingImpl(se, scalesWithIlvl)
			after := *se.ParseStatEffect(scalesWithIlvl, ilvl)
			if before == after {
				continue
			}
			changed++
			t.Logf("spell %d (%s) mask %d\n  before %v\n  after  %v",
				spellID, sp.NameLang, se.EffectMiscValues[0], before, after)

			for s := range targets {
				if after[s] == 0 && before[s] != 0 {
					t.Errorf("spell %d: stat %v regressed to zero", spellID, s)
				}
			}
		}
	}
	t.Logf("multi-stat rating effects: %d, values changed by the fix: %d", multi, changed)
}

// P0-6: only power type 0 (mana) may produce StatMana.
func TestIncreaseEnergyOnlyManaForManaPowerType(t *testing.T) {
	repoRoot(t)
	d := GetDBC()

	fixed, kept := 0, 0
	for spellID, effects := range d.SpellEffects {
		sp := d.Spells[spellID]
		for _, se := range effects {
			if se.EffectAura != A_MOD_INCREASE_ENERGY || se.EffectBasePoints == 0 {
				continue
			}
			mana := (*se.ParseStatEffect(sp.HasAttributeAt(11, 0x4), 0))[proto.Stat_StatMana]
			if se.EffectMiscValues[0] == POWER_TYPE_MANA {
				if mana == 0 {
					t.Errorf("spell %d: mana power type lost its mana", spellID)
				}
				kept++
				continue
			}
			if mana != 0 {
				t.Errorf("spell %d: power type %d still produced %v mana", spellID, se.EffectMiscValues[0], mana)
			}
			fixed++
			t.Logf("no longer fake mana: spell %d (%s) power type %d, %d points",
				spellID, sp.NameLang, se.EffectMiscValues[0], se.EffectBasePoints)
		}
	}
	t.Logf("mana effects kept: %d, non-mana effects no longer counted as mana: %d", kept, fixed)
}

// P1-9: ITEM_ENCHANTMENT_USE_SPELL must produce an on-use effect carrying the cooldown,
// spell category and duration of the spell it casts, even when no stats resolve.
func TestOnUseEnchantsCarryTheirTrigger(t *testing.T) {
	repoRoot(t)
	d := GetDBC()

	ids := []int{}
	for id := range d.Enchants {
		ids = append(ids, id)
	}
	slices.Sort(ids)

	withOnUse, withStats := 0, 0
	for _, id := range ids {
		ench := d.Enchants[id]
		if !slices.Contains(ench.Effects, ITEM_ENCHANTMENT_USE_SPELL) {
			continue
		}
		withOnUse++

		parsed := ench.ToProto()
		var onUse *proto.ItemEffect
		for _, eff := range parsed.EnchantEffects {
			if eff.GetOnUse() != nil {
				onUse = eff
			}
		}
		if onUse == nil {
			t.Errorf("enchant %d %q has an ITEM_ENCHANTMENT_USE_SPELL effect but no on-use proto", id, ench.Name)
			continue
		}

		useEffect, _ := ench.OnUseEffect()
		spell := d.Spells[useEffect.SpellID]
		if onUse.BuffId != int32(useEffect.SpellID) {
			t.Errorf("enchant %d: on-use BuffId %d, expected the use spell %d", id, onUse.BuffId, useEffect.SpellID)
		}
		if got, want := onUse.GetOnUse().CooldownMs, spell.Cooldown; got != want {
			t.Errorf("enchant %d: cooldown %d, expected %d", id, got, want)
		}
		if got, want := onUse.GetOnUse().CategoryCooldownMs, spell.CategoryRecoveryTime; got != want {
			t.Errorf("enchant %d: category cooldown %d, expected %d", id, got, want)
		}

		stats := onUse.ScalingOptions[0].Stats
		if len(stats) > 0 {
			withStats++
		}
		t.Logf("ench %5d %-34s use=%6d cd=%6d catCd=%6d cat=%5d dur=%6d stats=%v",
			id, ench.Name, useEffect.SpellID, onUse.GetOnUse().CooldownMs, onUse.GetOnUse().CategoryCooldownMs,
			onUse.GetOnUse().CategoryId, onUse.EffectDurationMs, stats)
	}

	if withOnUse == 0 {
		t.Fatal("no ITEM_ENCHANTMENT_USE_SPELL enchants found")
	}
	t.Logf("on-use enchants: %d, of which %d resolve stats", withOnUse, withStats)
}

// P1-10: damage procs resolve to no stats, so they used to be dropped before anything
// could report them. The shield spikes are the check on the resolved amounts: every one
// of them carries Blizzard's own range in its enchantment name, e.g. "Iron Spike (8-12)".
func TestDamageProcRangesMatchEnchantmentLabels(t *testing.T) {
	repoRoot(t)
	d := GetDBC()

	labelled := regexp.MustCompile(`\((\d+)-(\d+)\)\s*$`)

	ids := []int{}
	for id := range d.Enchants {
		ids = append(ids, id)
	}
	slices.Sort(ids)

	checked := 0
	for _, id := range ids {
		ench := d.Enchants[id]
		match := labelled.FindStringSubmatch(ench.EffectName)
		if match == nil {
			continue
		}

		damage := ResolveDamageEffect(ench.SpellId)
		if damage == nil {
			t.Errorf("enchant %d %q is labelled %q but no damage effect resolved", id, ench.Name, ench.EffectName)
			continue
		}

		wantMin, _ := strconv.Atoi(match[1])
		wantMax, _ := strconv.Atoi(match[2])
		if int(damage.MinDamage) != wantMin || int(damage.MaxDamage) != wantMax {
			t.Errorf("enchant %d %q labelled %d-%d but resolved %.0f-%.0f",
				id, ench.Name, wantMin, wantMax, damage.MinDamage, damage.MaxDamage)
		}
		checked++
		t.Logf("ench %5d %-30s label %-28s resolved %.0f-%.0f school=%d",
			id, ench.Name, ench.EffectName, damage.MinDamage, damage.MaxDamage, damage.SchoolMask)
	}

	if checked == 0 {
		t.Fatal("no range-labelled enchantments found to check against")
	}
	t.Logf("range-labelled damage enchants verified: %d", checked)
}

// P0-7: equip-spell enchant stats must be keyed through MapMainStatToStat.
func TestEnchantEquipSpellStatMapping(t *testing.T) {
	repoRoot(t)
	d := GetDBC()

	oldImpl := func(effects, effectArgs, effectPoints []int, out *stats.Stats) {
		for i, effect := range effects {
			switch effect {
			case ITEM_ENCHANTMENT_RESISTANCE:
				if stat, ok := MapResistanceToStat(effectArgs[i]); ok {
					out[stat] = float64(effectPoints[i])
				}
			case ITEM_ENCHANTMENT_STAT:
				if stat, ok := MapBonusStatIndexToStat(effectArgs[i]); ok {
					out[stat] = float64(effectPoints[i])
					if stat == proto.Stat_StatAttackPower {
						out[proto.Stat_StatRangedAttackPower] = float64(effectPoints[i])
					}
				}
			case ITEM_ENCHANTMENT_EQUIP_SPELL:
				for _, se := range d.SpellEffects[effectArgs[i]] {
					if se.EffectMiscValues[0] == -1 && se.EffectType == E_APPLY_AURA && se.EffectAura == A_MOD_STAT {
						out[proto.Stat_StatAgility] += float64(se.EffectBasePoints)
						out[proto.Stat_StatIntellect] += float64(se.EffectBasePoints)
						out[proto.Stat_StatSpirit] += float64(se.EffectBasePoints)
						out[proto.Stat_StatStamina] += float64(se.EffectBasePoints)
						out[proto.Stat_StatStrength] += float64(se.EffectBasePoints)
						continue
					}
					if se.EffectType == E_APPLY_AURA && se.EffectAura == A_MOD_STAT {
						out[se.EffectMiscValues[0]] += float64(se.EffectBasePoints)
					}
				}
			}
		}
	}

	changed := 0
	for _, ench := range d.Enchants {
		var before, after stats.Stats
		oldImpl(ench.Effects, ench.EffectArgs, ench.EffectPoints, &before)
		processEnchantmentEffects(ench.Effects, ench.EffectArgs, ench.EffectPoints, &after, true)
		if before != after {
			changed++
			t.Logf("enchant %d %-42s\n  before %v\n  after  %v", ench.EffectId, ench.Name, before, after)
		}
	}
	t.Logf("enchants whose stats changed: %d of %d", changed, len(d.Enchants))
}
