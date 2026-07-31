package dbc

import (
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func GetProfession(id int) proto.Profession {
	if profession, ok := MapProfessionIdToProfession[id]; ok {
		return profession
	}
	return 0
}

func GetRepLevel(minReputation int) proto.RepLevel {
	if repLevel, ok := MapMinReputationToRepLevel[minReputation]; ok {
		return repLevel
	}
	return proto.RepLevel_RepLevelUnknown
}
func NullFloat(arr []float64) []float64 {
	for _, v := range arr {
		if v > 0 {
			return arr
		}
	}

	return nil
}
func GetClassesFromClassMask(mask int) []proto.Class {
	var result []proto.Class

	allClasses := (1 << len(Classes)) - 1
	if mask&allClasses == allClasses {
		return result
	}

	for _, class := range Classes {
		if mask&(1<<(class.ID-1)) != 0 {
			result = append(result, class.ProtoClass)
		}
	}
	slices.Sort(result)
	return result
}

func WriteGzipFile(filePath string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return fmt.Errorf("failed to create directories for %s: %w", filePath, err)
	}
	// Create the file
	f, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	// Create a gzip writer on top of the file writer
	gw := gzip.NewWriter(f)
	defer gw.Close()

	// Write the data to the gzip writer
	_, err = gw.Write(data)
	return err
}
func ReadGzipFile(filename string) ([]byte, error) {
	f, err := os.Open(filename)
	if err != nil {
		return nil, DataLoadError{
			Source:   filename,
			DataType: "gzip file",
			Reason:   err.Error(),
		}
	}
	defer f.Close()

	gzReader, err := gzip.NewReader(f)
	if err != nil {
		return nil, DataLoadError{
			Source:   filename,
			DataType: "gzip",
			Reason:   err.Error(),
		}
	}
	defer gzReader.Close()

	data, err := io.ReadAll(gzReader)
	if err != nil {
		return nil, DataLoadError{
			Source:   filename,
			DataType: "decompression",
			Reason:   err.Error(),
		}
	}

	return data, nil
}

func processEnchantmentEffects(
	effects []int,
	effectArgs []int,
	effectPoints []int,
	outStats *stats.Stats,
	addRanged bool,
) {
	for i, effect := range effects {
		switch effect {
		case ITEM_ENCHANTMENT_RESISTANCE:
			stat, match := MapResistanceToStat(effectArgs[i])
			if !match {
				continue
			}
			outStats[stat] = float64(effectPoints[i])
		case ITEM_ENCHANTMENT_STAT:
			stat, success := MapBonusStatIndexToStat(effectArgs[i])
			if !success {
				continue
			}
			outStats[stat] = float64(effectPoints[i])
			// If the bonus stat is attack power, copy it to ranged attack power
			if addRanged && stat == proto.Stat_StatAttackPower {
				outStats[proto.Stat_StatRangedAttackPower] = float64(effectPoints[i])
			}
		case ITEM_ENCHANTMENT_EQUIP_SPELL: //Buff
			for _, spellEffect := range dbcInstance.SpellEffectsInOrder(effectArgs[i]) {
				if spellEffect.EffectType != E_APPLY_AURA {
					continue
				}

				points := float64(spellEffect.EffectBasePoints)
				switch spellEffect.EffectAura {
				case A_MOD_STAT:
					// -1 in MiscValue 0 means all stats
					if spellEffect.EffectMiscValues[0] == -1 {
						outStats[proto.Stat_StatAgility] += points
						outStats[proto.Stat_StatIntellect] += points
						outStats[proto.Stat_StatSpirit] += points
						outStats[proto.Stat_StatStamina] += points
						outStats[proto.Stat_StatStrength] += points
						continue
					}

					// MiscValue 0 is a DBC stat index, not a proto.Stat
					stat, match := MapMainStatToStat(spellEffect.EffectMiscValues[0])
					if !match {
						continue
					}
					outStats[stat] += points
				case A_MOD_RATING:
					for _, rating := range getMatchingRatingMods(spellEffect.EffectMiscValues[0]) {
						if statMod := RatingModToStat[rating]; statMod != -1 {
							outStats[statMod] = points
						}
					}
				case A_MOD_ATTACK_POWER:
					outStats[proto.Stat_StatAttackPower] += points
					if addRanged {
						outStats[proto.Stat_StatRangedAttackPower] += points
					}
				case A_MOD_RANGED_ATTACK_POWER:
					outStats[proto.Stat_StatRangedAttackPower] += points
				case A_MOD_DAMAGE_DONE:
					outStats[proto.Stat_StatSpellPower] += points
				}
			}
		case ITEM_ENCHANTMENT_COMBAT_SPELL:
			// Not processed (chance on hit, ignore for now)
		case ITEM_ENCHANTMENT_USE_SPELL:
			// Not processed
		}
	}
}
