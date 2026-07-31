package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/tools/database/dbc"
)

func parseIntArrayField(jsonStr string, expectedLen int) ([]int, error) {
	var arr []int
	if jsonStr == "" {
		return arr, nil
	}
	if err := json.Unmarshal([]byte(jsonStr), &arr); err != nil {
		return nil, fmt.Errorf("unmarshaling JSON array: %w", err)
	}
	if len(arr) != expectedLen {
		return nil, fmt.Errorf("invalid array length: expected %d, got %d", expectedLen, len(arr))
	}
	return arr, nil
}

func parseFloatArrayField(jsonStr string, expectedLen int) ([]float64, error) {
	var arr []float64
	if err := json.Unmarshal([]byte(jsonStr), &arr); err != nil {
		return nil, fmt.Errorf("unmarshaling JSON array: %w", err)
	}
	if len(arr) != expectedLen {
		return nil, fmt.Errorf("invalid array length: expected %d, got %d", expectedLen, len(arr))
	}
	return arr, nil
}

func ParseRandomSuffixOptions(optionsString sql.NullString) ([]int32, error) {
	if !optionsString.Valid || optionsString.String == "" {
		return []int32{}, nil
	}

	parts := strings.Split(optionsString.String, ",")
	var opts []int32
	var parseErrors []string

	for i, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}

		num, err := strconv.Atoi(part)
		if err != nil {
			parseErrors = append(parseErrors, fmt.Sprintf("part %d (%s): %v", i, part, err))
			continue
		}
		opts = append(opts, int32(num))
	}

	if len(parseErrors) > 0 {
		return opts, fmt.Errorf("some values couldn't be parsed: %s", strings.Join(parseErrors, "; "))
	}

	return opts, nil
}

// Formats the input string so that it does not use more than maxLength characters
// as soon a whole word exceeds the character limit a new line will be created
func formatStrings(maxLength int, input []string) []string {
	result := []string{}
	for _, line := range input {
		words := strings.Split(strings.Trim(line, "\n\r "), " ")
		currentLine := ""
		for _, word := range words {
			if len(currentLine) > maxLength {
				result = append(result, currentLine)
				currentLine = ""
			}

			if len(currentLine) > 0 {
				currentLine += " "
			}

			currentLine += word
		}

		if len(result) > 0 || len(currentLine) > 0 {
			result = append(result, currentLine)
		}
	}

	return result
}

func parseDungeonDifficultyMask(mask int, isRaid bool) proto.DungeonDifficulty {
	// for negative masks take the 2 compliment value of the lower 8 bits
	if mask < 0 {
		mask = mask & 0xFF
	}

	if isRaid {
		// we only map to one difficulty so for now do the best match
		if mask&dbc.LOOKING_FOR_RAID > 0 {
			return proto.DungeonDifficulty_DifficultyRaid25RF
		}

		if mask&dbc.HEROIC_RAID_25_MAN > 0 {
			return proto.DungeonDifficulty_DifficultyRaid25H
		}

		if mask&dbc.HEROIC_RAID_10_MAN > 0 {
			return proto.DungeonDifficulty_DifficultyRaid10H
		}

		if mask&dbc.NORMAL_RAID_25_MAN > 0 {
			return proto.DungeonDifficulty_DifficultyRaid25
		}

		if mask&dbc.NORMAL_RAID_10_MAN > 0 {
			return proto.DungeonDifficulty_DifficultyRaid10
		}

	} else {
		if mask&dbc.HEROIC_DUNGEON > 0 {
			return proto.DungeonDifficulty_DifficultyHeroic
		}

		if mask&dbc.NORMAL_DUNGEON > 0 {
			return proto.DungeonDifficulty_DifficultyNormal
		}
	}

	return proto.DungeonDifficulty_DifficultyUnknown
}

func DifficultyToShortName(difficulty proto.DungeonDifficulty) string {
	switch difficulty {
	case proto.DungeonDifficulty_DifficultyHeroic, proto.DungeonDifficulty_DifficultyRaid10H, proto.DungeonDifficulty_DifficultyRaid25H:
		return "(H)"
	case proto.DungeonDifficulty_DifficultyNormal, proto.DungeonDifficulty_DifficultyRaid25, proto.DungeonDifficulty_DifficultyRaid10:
		return "(N)"
	case proto.DungeonDifficulty_DifficultyRaid25RF:
		return "(LFR)"
	default:
		return ""
	}
}

func EnchantHasDummyEffect(enchant *proto.UIEnchant, instance *dbc.DBC) bool {
	return SpellHasDummyEffect(int(enchant.SpellId), instance)
}

// Reports whether a spell resolves to nothing at all: every effect is a dummy and none of
// them trigger another spell. These are the despawn and marker auras that
// sit alongside an item's real effect - Quilen Statuette Despawn Aura, Barnacle Crew Despawn
// Aura, Sha-dowfiend - and reporting them as missing effects is noise. Note that their base
// points often hold another spell's ID, so a non-zero value does not make them meaningful.
func SpellIsPureDummy(spellId int, instance *dbc.DBC) bool {
	effects := instance.SpellEffects[spellId]
	if len(effects) == 0 {
		return false
	}

	return !anySpellEffect(spellId, instance, func(effect dbc.SpellEffect) bool {
		return !isDummyAura(effect) || effect.EffectTriggerSpell != 0
	})
}

func SpellHasDummyEffect(spellId int, instance *dbc.DBC) bool {
	return anySpellEffect(spellId, instance, isDummyAura)
}

func SpellHasTriggerEffect(spellId int, instance *dbc.DBC) bool {
	return anySpellEffect(spellId, instance, isProcTriggerAura)
}

func SpellUsesStacks(spellId int, instance *dbc.DBC) bool {
	if instance.Spells[spellId].MaxCumulativeStacks > 1 {
		return true
	}

	return anySpellEffect(spellId, instance, func(effect dbc.SpellEffect) bool {
		return isProcTriggerAura(effect) &&
			instance.Spells[effect.EffectTriggerSpell].MaxCumulativeStacks > 1
	})
}

// Reports whether any of the spell's effects satisfies pred. Effect order does not matter to
// a predicate, so this reads the map directly rather than paying for a sorted copy.
func anySpellEffect(spellId int, instance *dbc.DBC, pred func(dbc.SpellEffect) bool) bool {
	for _, effect := range instance.SpellEffects[spellId] {
		if pred(effect) {
			return true
		}
	}

	return false
}

func isDummyAura(effect dbc.SpellEffect) bool {
	return effect.EffectAura == dbc.A_DUMMY || effect.EffectAura == dbc.A_PERIODIC_DUMMY
}

func isProcTriggerAura(effect dbc.SpellEffect) bool {
	return effect.EffectAura == dbc.A_PROC_TRIGGER_SPELL ||
		effect.EffectAura == dbc.A_PROC_TRIGGER_SPELL_WITH_VALUE
}

func GetEffectStatString(itemEffect *proto.ItemEffect) string {
	if itemEffect == nil {
		return ""
	}

	stats := itemEffect.ScalingOptions[int32(0)].Stats
	statsString := make([]string, 0, len(stats))
	for k := range stats {
		stat := proto.Stat(k)
		statsString = append(statsString, stat.String()[4:])
	}

	slices.Sort(statsString)

	return strings.Join(statsString, " / ")
}
