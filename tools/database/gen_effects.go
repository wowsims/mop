package database

import (
	"fmt"
	"os"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"text/template"

	_ "github.com/wowsims/mop/sim/common"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/tools/database/dbc"
	"github.com/wowsims/mop/tools/tooltip"
)

// Sets the minimum itemlevel that should be considered for this expansions
const MIN_EFFECT_ILVL = 416

type ProcInfo struct {
	Outcome             core.HitOutcome
	Callback            core.AuraCallback
	ProcMask            core.ProcMask
	MaxCumulativeStacks int32
	RequireDamageDealt  bool
}

// Entry represents a single effect with its ID and display name.
type Variant struct {
	ID      int
	SpellID int
	Name    string
}

type Entry struct {
	Variants  []*Variant
	Tooltip   []string
	ProcInfo  ProcInfo
	Supported bool
}

// Group holds a category of effects.
type Group struct {
	Name    string
	Entries []*Entry
}

type MissingItemEffect struct {
	ItemID  int32
	Name    string
	Effects []Variant
}

var missingEffectsMap = map[string]map[int32]MissingItemEffect{
	"EnchantEffects": {},
	"ItemEffects":    {},
}

type EffectParseResult byte

const (
	EffectParseResultInvalid     EffectParseResult = iota // Returned when the effect is invalid for the current parameters
	EffectParseResultUnsupported                          // Returned when the effect could be parsed but is not supported for effect generation
	EffectParseResultSuccess                              // Returned when the effect was parsed successfuly
)

func GenerateEffectsFile(groups []*Group, outFile string, templateString string) error {
	if _, err := os.Stat(outFile); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("unable to check file %s: %w", outFile, err)
	}

	// Ensure groups and entries are sorted
	sort.Slice(groups, func(i, j int) bool {
		return groups[i].Name < groups[j].Name
	})

	for _, grp := range groups {
		sort.Slice(grp.Entries, func(i, j int) bool {
			if grp.Entries[i].Supported != grp.Entries[j].Supported {
				return !grp.Entries[i].Supported
			}

			return grp.Entries[i].Variants[0].ID < grp.Entries[j].Variants[0].ID
		})
	}

	funcMap := map[string]any{
		"asCoreCallback": asCoreCallback,
		"asCoreProcMask": asCoreProcMask,
		"asCoreOutcome":  asCoreOutcome,
		"formatStrings":  formatStrings,
	}
	tmpl := template.Must(template.New("effects").Funcs(funcMap).Parse(templateString))
	f, err := os.Create(outFile)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", outFile, err)
	}
	defer f.Close()
	if err := tmpl.Execute(f, map[string]interface{}{"Groups": groups}); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	return nil
}

const missingEffectsFileName = "ui/core/constants/missing_effects_auto_gen.ts"

func GenerateMissingEffectsFile() error {
	if _, err := os.Stat(missingEffectsFileName); err != nil && !os.IsNotExist(err) {
		return fmt.Errorf("unable to check file %s: %w", missingEffectsFileName, err)
	}

	funcMap := map[string]any{
		"asCoreCallback": asCoreCallback,
		"asCoreProcMask": asCoreProcMask,
		"asCoreOutcome":  asCoreOutcome,
		"formatStrings":  formatStrings,
	}
	tmpl := template.Must(template.New("missingEffects").Funcs(funcMap).Parse(TmplStrMissingEffects))
	f, err := os.Create(missingEffectsFileName)
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", missingEffectsFileName, err)
	}
	defer f.Close()

	if err := tmpl.Execute(f, missingEffectsMap); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	return nil
}

func GenerateEnchantEffects(instance *dbc.DBC, db *WowDatabase) {
	groupMapProc := map[string]Group{}
	enchantSpellEffects := map[int]*dbc.SpellEffect{}

	for _, effect := range instance.SpellEffectsById {
		if effect.EffectType == dbc.E_ENCHANT_ITEM {
			enchantSpellEffects[effect.EffectMiscValues[0]] = &effect
		}
	}

	for _, enchant := range instance.Enchants {
		parsed := enchant.ToProto()
		if _, ok := db.Enchants[parsed.EffectId]; !ok {
			continue
		}

		for _, enchantEffect := range parsed.EnchantEffects {
			TryParseEnchantEffect(parsed, enchantEffect, groupMapProc, instance, enchantSpellEffects)
		}
	}

	var procGroups []*Group
	for _, grp := range groupMapProc {
		procGroups = append(procGroups, &grp)
	}
	GenerateEffectsFile(procGroups, "sim/common/mop/enchants_auto_gen.go", TmplStrEnchant)
}

func ItemEffectIsSupported(instance *dbc.DBC, effectID int) bool {
	supported := true
	if effects, ok := instance.SpellEffects[effectID]; ok {
		for _, effect := range effects {
			if params, ok := IgnoreSpellEffectByAuraType[effect.EffectAura]; ok {
				if len(params) == 0 {
					supported = false
					break
				} else {
					if slices.Contains(params, effect.EffectMiscValues[0]) {
						supported = false
						break
					}
				}
			}

			if params, ok := IgnoreSpellEffectBySpellEffectType[effect.EffectType]; ok {
				if len(params) == 0 {
					supported = false
					break
				} else {
					if slices.Contains(params, effect.EffectMiscValues[0]) {
						supported = false
						break
					}
				}
			}
		}
	}
	return supported
}

func GenerateItemEffects(instance *dbc.DBC, db *WowDatabase, itemSources map[int][]*proto.DropSource) {
	groupMapOnUse := map[string]Group{}
	groupMapProc := map[string]Group{}

	// Example loop over your items
	for _, parsed := range db.Items {
		parsed.ItemEffects = dbc.MergeItemEffectsForAllStates(parsed)

		for _, itemEffect := range parsed.ItemEffects {
			if !ItemEffectIsSupported(instance, int(itemEffect.BuffId)) {
				continue
			}

			if TryParseOnUseEffect(parsed, itemEffect, instance, groupMapOnUse) != EffectParseResultSuccess &&
				TryParseProcEffect(parsed, itemEffect, instance, groupMapProc) != EffectParseResultSuccess {
				ParseTooltipForMissingEffect(parsed, itemEffect, instance, groupMapProc, "Procs")
			}
		}
	}

	// Sorting done in GenerateEffectsFile
	// Merge on-use variants
	var onUseGroups []*Group
	for _, grp := range groupMapOnUse {
		newEntries := []*Entry{}
		entryGroupings := map[string]*Entry{}

		// sort entries first to make grouping consistent for variants
		sort.Slice(grp.Entries, func(i, j int) bool {
			return grp.Entries[i].Variants[0].ID < grp.Entries[j].Variants[0].ID
		})

		for _, entry := range grp.Entries {
			added := false

			// Group by name and spell ID
			entryKey := fmt.Sprintf("%s_%d", entry.Variants[0].Name, entry.Variants[0].SpellID)
			if existingEntry, ok := entryGroupings[entryKey]; ok {
				existingEntry.AddVariant(entry.Variants[0])
				added = true
			}

			if !added {
				newEntries = append(newEntries, entry)
				entryGroupings[entryKey] = entry
			}
		}

		grp.Entries = newEntries
		onUseGroups = append(onUseGroups, &grp)
	}

	// Merge variants
	var procGroups []*Group
	needsStatPostfix := map[string]bool{}
	for _, grp := range groupMapProc {
		newEntries := []*Entry{}
		entryGroupings := map[string]*Entry{}

		// sort entries first to make tooltip generation consistent for variants
		sort.Slice(grp.Entries, func(i, j int) bool {
			return grp.Entries[i].Variants[0].ID < grp.Entries[j].Variants[0].ID
		})

		for _, entry := range grp.Entries {
			var idx int64 = 0
			added := false

			// Make sure to only group by name and spell ID, then proc mask as a secondary check
			// Items with the same name and same spell effect should be grouped together
			for groupKey, group := range entryGroupings {
				if group.Variants[0].Name == entry.Variants[0].Name {
					// Only count as same "name group" if they share the same SpellID
					if group.Variants[0].SpellID == entry.Variants[0].SpellID {
						if group.ProcInfo.ProcMask == entry.ProcInfo.ProcMask {
							group.AddVariant(entry.Variants[0])
							added = true
							break
						}
					} else {
						// Different SpellID means a different effect, track for stat postfix
						idx++
						// Check if we already have an entry for this name+spellID combination
						entryKey := fmt.Sprintf("%s_%d", entry.Variants[0].Name, entry.Variants[0].SpellID)
						if existingEntry, ok := entryGroupings[entryKey]; ok && groupKey != entryKey {
							if existingEntry.ProcInfo.ProcMask == entry.ProcInfo.ProcMask {
								existingEntry.AddVariant(entry.Variants[0])
								added = true
								break
							}
						}
					}
				}
			}

			if !added {
				groupName := entry.Variants[0].Name
				if idx > 0 {
					needsStatPostfix[groupName] = true
					groupName += "(" + strconv.FormatInt(idx, 10) + ")"
				}

				newEntries = append(newEntries, entry)
				// Key by name + SpellID to avoid overwriting entries for different spell effects
				entryKey := fmt.Sprintf("%s_%d", entry.Variants[0].Name, entry.Variants[0].SpellID)
				entryGroupings[entryKey] = entry
			}
		}

		grp.Entries = newEntries
		procGroups = append(procGroups, &grp)
	}

	updateNames := func(entries []*Entry) {
		for _, entry := range entries {
			for _, variant := range entry.Variants {
				if _, ok := needsStatPostfix[variant.Name]; ok {
					item := db.Items[int32(variant.ID)]
					for _, itemEffect := range item.ItemEffects {
						effectStatString := GetEffectStatString(itemEffect)
						if len(effectStatString) > 0 {
							variant.Name += " - " + effectStatString
						}
					}
				}

				variant.Name += BuildItemDifficultyPostfix(itemSources, variant.ID, instance)
			}
		}
	}

	// Update Item names
	for _, grp := range onUseGroups {
		updateNames(grp.Entries)
	}

	for _, grp := range procGroups {
		updateNames(grp.Entries)
	}

	GenerateEffectsFile(onUseGroups, "sim/common/mop/stat_bonus_cds_auto_gen.go", TmplStrOnUse)
	GenerateEffectsFile(procGroups, "sim/common/mop/stat_bonus_procs_auto_gen.go", TmplStrProc)
}

func GenerateItemEffectRandomPropPoints(instance *dbc.DBC, db *WowDatabase) {
	for id, allocMap := range instance.RandomPropertiesByIlvl {
		ilvl := int32(id)
		if ilvl < core.MinIlvl || ilvl > core.MaxIlvl {
			continue
		}
		db.ItemEffectRandPropPoints[ilvl] = &proto.ItemEffectRandPropPoints{
			Ilvl:           ilvl,
			RandPropPoints: allocMap[proto.ItemQuality_ItemQualityEpic][0],
		}
	}
}

func BuildItemDifficultyPostfix(itemSources map[int][]*proto.DropSource, itemId int, instance *dbc.DBC) string {
	difficultyPostfix := ""
	if sources, ok := itemSources[itemId]; ok {
		name := DifficultyToShortName(sources[0].Difficulty)
		if len(name) > 0 {
			difficultyPostfix += " " + name
		}
	}

	if item, ok := instance.Items[itemId]; ok {
		if len(item.NameDescription) > 0 && item.NameDescription != "Heroic" {
			difficultyPostfix += " (" + item.NameDescription + ")"
		}

		if item.Flags1.Has(dbc.HORDE_SPECIFIC) {
			difficultyPostfix += " (Horde)"
		}

		if item.Flags1.Has(dbc.ALLIANCE_SPECIFIC) {
			difficultyPostfix += " (Alliance)"
		}
	}

	return difficultyPostfix
}

func TryParseProcEffect(parsed *proto.UIItem, itemEffect *proto.ItemEffect, instance *dbc.DBC, groupMapProc map[string]Group) EffectParseResult {
	if itemEffect.GetProc() != nil && parsed.ScalingOptions[0].Ilvl > MIN_EFFECT_ILVL {
		// Effect was already manually implemented
		if core.HasItemEffect(parsed.Id) {
			return EffectParseResultSuccess
		}

		tooltipString, id := dbc.GetItemEffectSpellTooltip(int(parsed.Id), int(itemEffect.BuffId))
		tooltip, _ := tooltip.ParseTooltip(tooltipString, tooltip.DBCTooltipDataProvider{DBC: instance}, int64(id))

		grp, exists := groupMapProc["Procs"]
		if !exists {
			grp = Group{Name: "Procs"}
		}

		if tooltip != nil {
			renderedTooltip := tooltip.String()
			entry := Entry{
				Tooltip:  strings.Split(renderedTooltip, "\n"),
				Variants: []*Variant{{ID: int(parsed.Id), Name: parsed.Name, SpellID: int(itemEffect.BuffId)}},
			}
			entry.ProcInfo, entry.Supported = BuildProcInfo(parsed, int(itemEffect.BuffId), instance, renderedTooltip)

			if len(itemEffect.ScalingOptions[0].Stats) == 0 || !entry.Supported {
				StoreMissingEffect("ItemEffects", parsed.Name, Variant{
					ID:      int(parsed.Id),
					Name:    renderedTooltip,
					SpellID: int(itemEffect.BuffId),
				})
				return EffectParseResultUnsupported
			}

			grp.Entries = append(grp.Entries, &entry)
			groupMapProc["Procs"] = grp

			return EffectParseResultSuccess
		} else {
			return EffectParseResultUnsupported
		}
	}

	// check if the item has any kind of proc as we only support stat proc parsing right now
	if effects, ok := instance.ItemEffectsByParentID[int(parsed.Id)]; ok && parsed.ScalingOptions[0].Ilvl > MIN_EFFECT_ILVL {
		for _, effect := range effects {
			if SpellHasTriggerEffect(effect.SpellID, instance) {
				return EffectParseResultUnsupported
			}
		}
	}

	return EffectParseResultInvalid
}

func TryParseOnUseEffect(parsed *proto.UIItem, itemEffect *proto.ItemEffect, instance *dbc.DBC, groupMap map[string]Group) EffectParseResult {
	// Effect was already manually implemented
	if core.HasItemEffect(parsed.Id) {
		return EffectParseResultSuccess
	}

	if itemEffect.GetOnUse() != nil && parsed.ScalingOptions[0].Ilvl > MIN_EFFECT_ILVL { // MoP constraints

		if itemEffect.GetOnUse().CooldownMs < 0 && itemEffect.GetOnUse().CategoryCooldownMs < 0 {
			return EffectParseResultUnsupported
		}

		tooltipString, id := dbc.GetItemEffectSpellTooltip(int(parsed.Id), int(itemEffect.BuffId))
		tooltip, _ := tooltip.ParseTooltip(tooltipString, tooltip.DBCTooltipDataProvider{DBC: instance}, int64(id))

		groupName := GetEffectStatString(itemEffect)
		grp, exists := groupMap[groupName]
		if !exists {
			grp = Group{Name: groupName}
		}

		if tooltip != nil {
			renderedTooltip := tooltip.String()
			entry := &Entry{
				Tooltip:   strings.Split(renderedTooltip, "\n"),
				Variants:  []*Variant{{ID: int(parsed.Id), Name: parsed.Name, SpellID: int(itemEffect.BuffId)}},
				Supported: true,
			}
			grp.Entries = append(grp.Entries, entry)
			groupMap[groupName] = grp

			if len(itemEffect.ScalingOptions[0].Stats) == 0 {
				entry.Supported = false
				StoreMissingEffect("ItemEffects", parsed.Name, Variant{
					ID:      int(parsed.Id),
					Name:    renderedTooltip,
					SpellID: int(itemEffect.BuffId),
				})
				return EffectParseResultUnsupported
			}

			return EffectParseResultSuccess
		} else {
			return EffectParseResultUnsupported
		}
	}

	return EffectParseResultInvalid
}

func TryParseEnchantEffect(enchant *proto.UIEnchant, enchantEffect *proto.ItemEffect, groupMapProc map[string]Group, instance *dbc.DBC, enchantSpellEffects map[int]*dbc.SpellEffect) EffectParseResult {
	if (enchantEffect.GetProc() != nil || EnchantHasDummyEffect(enchant, instance)) && enchant.EffectId > 4267 {

		// Effect was already manually implemented
		if core.HasEnchantEffect(enchant.EffectId) {
			return EffectParseResultSuccess
		}

		if enchantingSpell, ok := enchantSpellEffects[int(enchant.EffectId)]; ok {
			tooltipString := instance.Spells[enchantingSpell.SpellID].Description
			tooltip, _ := tooltip.ParseTooltip(tooltipString, tooltip.DBCTooltipDataProvider{DBC: instance}, int64(enchantingSpell.SpellID))

			grp, exists := groupMapProc["Enchants"]
			if !exists {
				grp = Group{Name: "Enchants"}
			}

			renderedTooltip := tooltip.String()
			entry := Entry{Tooltip: strings.Split(renderedTooltip, "\n"), Variants: []*Variant{{ID: int(enchant.EffectId), Name: enchant.Name}}}
			entry.ProcInfo, entry.Supported = BuildEnchantProcInfo(enchant, instance, renderedTooltip)
			grp.Entries = append(grp.Entries, &entry)
			groupMapProc["Enchants"] = grp

			if !entry.Supported {
				StoreMissingEffect("EnchantEffects", enchant.Name, Variant{
					ID:      int(enchant.EffectId),
					Name:    renderedTooltip,
					SpellID: int(enchant.SpellId),
				})
				return EffectParseResultUnsupported
			}

			return EffectParseResultSuccess
		}
	}

	return EffectParseResultInvalid
}

func ParseTooltipForMissingEffect(parsed *proto.UIItem, itemEffect *proto.ItemEffect, instance *dbc.DBC, groupMap map[string]Group, groupMapName string) {
	if parsed.ScalingOptions[0].Ilvl > MIN_EFFECT_ILVL {
		// Effect was already manually implemented
		if core.HasItemEffect(parsed.Id) {
			return
		}

		tooltipString, id := dbc.GetItemEffectSpellTooltip(int(parsed.Id), int(itemEffect.BuffId))
		tooltip, _ := tooltip.ParseTooltip(tooltipString, tooltip.DBCTooltipDataProvider{DBC: instance}, int64(id))

		grp, exists := groupMap[groupMapName]
		if !exists {
			grp = Group{Name: groupMapName}
		}

		if tooltip != nil {
			renderedTooltip := tooltip.String()
			entry := Entry{
				Tooltip:   strings.Split(renderedTooltip, "\n"),
				Supported: false,
				Variants: []*Variant{
					{
						ID:      int(parsed.Id),
						Name:    parsed.Name,
						SpellID: int(itemEffect.BuffId),
					},
				},
			}

			grp.Entries = append(grp.Entries, &entry)
			groupMap[groupMapName] = grp

			if len(itemEffect.ScalingOptions[0].Stats) == 0 || !entry.Supported {
				StoreMissingEffect("ItemEffects", parsed.Name, Variant{
					ID:      int(parsed.Id),
					Name:    renderedTooltip,
					SpellID: int(itemEffect.BuffId),
				})
			}
		}
	}
}

var critMatcher = regexp.MustCompile(`critical ([^\s]+|damage,?)( chance)? [^fbc]`)
var pureHealMatcher = regexp.MustCompile(`healing spells`)
var hasHealMatcher = regexp.MustCompile(`heal(ing)?[^,]`)
var hasGenericMatcher = regexp.MustCompile(`a spell`)

func BuildProcInfo(parsed *proto.UIItem, itemEffectID int, instance *dbc.DBC, tooltip string) (ProcInfo, bool) {
	itemEffect := dbc.GetItemEffectForBuffID(int(parsed.Id), itemEffectID)
	if itemEffect == nil {
		return ProcInfo{}, false
	}

	// if we have multiple spells find the first that has a proc aura assigned
	procId := itemEffect.SpellID
	procSpell, ok := instance.Spells[int(procId)]
	if !ok {
		panic(fmt.Sprintf("Could not find proc aura %d spell for item effect %d.\n", procId, parsed.Id))
	}

	itemType := proto.ItemType_ItemTypeUnknown
	if itemEffect.TriggerType == 2 {
		itemType = proto.ItemType_ItemTypeWeapon
	}

	procInfo, supported := BuildSpellProcInfo(&procSpell, tooltip, itemType)

	if SpellHasDummyEffect(int(procId), instance) {
		return procInfo, false
	}

	return procInfo, supported
}

func BuildEnchantProcInfo(enchant *proto.UIEnchant, instance *dbc.DBC, tooltip string) (ProcInfo, bool) {
	procSpellID := enchant.SpellId
	if procSpellID == 0 {
		fmt.Printf("WARN: Enchant %d with no spell id", enchant.EffectId)
		return ProcInfo{}, false
	}

	procSpell, ok := instance.Spells[int(procSpellID)]
	if !ok {
		panic(fmt.Sprintf("Could not find proc aura %d spell for item effect %d.\n", procSpellID, enchant.EffectId))
	}

	procInfo, supported := BuildSpellProcInfo(&procSpell, tooltip, enchant.Type)
	if SpellHasDummyEffect(int(procSpellID), instance) {
		return procInfo, false
	}

	return procInfo, supported
}

func BuildSpellProcInfo(procSpell *dbc.Spell, tooltip string, itemType proto.ItemType) (ProcInfo, bool) {
	var info = ProcInfo{
		RequireDamageDealt:  true,
		MaxCumulativeStacks: procSpell.MaxCumulativeStacks,
	}

	// On hit proc
	if itemType == proto.ItemType_ItemTypeWeapon {
		info.Callback |= core.CallbackOnSpellHitDealt
		info.ProcMask |= core.ProcMaskUnknown
	}

	if itemType == proto.ItemType_ItemTypeRanged {
		info.Callback |= core.CallbackOnSpellHitDealt
		info.ProcMask |= core.ProcMaskRanged
	}

	if len(procSpell.ProcTypeMask) > 0 {
		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_MELEE_SWING > 0 {
			info.ProcMask |= core.ProcMaskMeleeWhiteHit
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_MELEE_ABILITY > 0 {
			info.ProcMask |= core.ProcMaskMeleeSpecial
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_RANGED_ATTACK > 0 {
			info.ProcMask |= core.ProcMaskRangedAuto
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_RANGED_ABILITY > 0 {
			info.ProcMask |= core.ProcMaskRangedSpecial
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_HARMFUL_PERIODIC > 0 {
			info.ProcMask |= core.ProcMaskSpellDamage
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_HARMFUL_SPELL > 0 {
			info.ProcMask |= core.ProcMaskSpellDamage
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_ANY_DIRECT_TAKEN > 0 {
			info.Callback |= core.CallbackOnSpellHitTaken
			info.Outcome = core.OutcomeLanded

			if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_TAKE_MELEE_SWING > 0 {
				info.ProcMask |= core.ProcMaskMeleeWhiteHit
			}

			if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_TAKE_MELEE_ABILITY > 0 {
				info.ProcMask |= core.ProcMaskMeleeSpecial
			}

			if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_TAKE_HARMFUL_SPELL > 0 {
				info.ProcMask |= core.ProcMaskSpellDamage
			}

			// For now we do not support self damage procs as they usually have custom extra proc conditions
			// like On dodge or on On parry or x amount of damage taken
			return info, false
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_ANY_DIRECT_DEALT > 0 {
			info.Callback |= core.CallbackOnSpellHitDealt

			if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_HARMFUL_SPELL > 0 {
				info.RequireDamageDealt = false
			}
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_HARMFUL_PERIODIC > 0 {
			info.Callback |= core.CallbackOnPeriodicDamageDealt
		}

		if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_HELPFUL_SPELL > 0 &&
			(hasHealMatcher.MatchString(tooltip) || hasGenericMatcher.MatchString(tooltip)) {
			info.RequireDamageDealt = false
			info.Callback |= core.CallbackOnHealDealt
			info.ProcMask |= core.ProcMaskSpellHealing

			// handle HoTs onyl with direct heals for now, there are some odd cases with HoT / DoT overlaps
			if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_DEAL_HELPFUL_PERIODIC > 0 {
				info.Callback |= core.CallbackOnPeriodicHealDealt
			}

			// Check if we have periodic damage flag but only heal paired with it
			// This usually indicates a pure heal proc mask
			if procSpell.ProcTypeMask[0]&dbc.PROC_FLAG_ANY_DIRECT_DEALT == 0 {
				info.Callback &= ^core.CallbackOnPeriodicDamageDealt
				info.Callback &= ^core.CallbackOnSpellHitDealt
				info.ProcMask &= ^core.ProcMaskSpellDamage
			}
		}
	}

	if info.ProcMask.Matches(core.ProcMaskMelee) && procSpell.Attributes[3]&dbc.ATTR_EX_3_CAN_PROC_FROM_PROCS > 0 {
		info.ProcMask |= core.ProcMaskMeleeProc
	}

	if info.ProcMask.Matches(core.ProcMaskRanged) && procSpell.Attributes[3]&dbc.ATTR_EX_3_CAN_PROC_FROM_PROCS > 0 {
		info.ProcMask |= core.ProcMaskRangedProc
	}

	if info.ProcMask.Matches(core.ProcMaskSpellDamage) && procSpell.Attributes[3]&dbc.ATTR_EX_3_CAN_PROC_FROM_PROCS > 0 {
		info.ProcMask |= core.ProcMaskSpellDamageProc
	}

	if critMatcher.MatchString(tooltip) {
		info.Outcome = core.OutcomeCrit
	} else {
		info.Outcome = core.OutcomeLanded
	}

	// check for pure healing spell
	if pureHealMatcher.MatchString(tooltip) {
		info.Callback &= ^core.CallbackOnSpellHitDealt
		info.Callback &= ^core.CallbackOnPeriodicDamageDealt
	}

	unsupported := info.Callback == core.CallbackEmpty &&
		info.Outcome == core.OutcomeEmpty &&
		info.ProcMask == core.ProcMaskEmpty

	return info, !unsupported
}

func StoreMissingEffect(effectType string, name string, variant Variant) {
	if missingEffectsMap[effectType] == nil {
		missingEffectsMap[effectType] = map[int32]MissingItemEffect{}
	}
	id := int32(variant.ID)
	if missingEffectsMap[effectType][id].Effects == nil {
		missingEffectsMap[effectType][id] = MissingItemEffect{
			ItemID:  id,
			Name:    name,
			Effects: []Variant{},
		}
	}
	itemEntry := missingEffectsMap[effectType][id]
	haveEffect := false
	for _, effect := range itemEntry.Effects {
		if effect.SpellID == variant.SpellID {
			haveEffect = true
			break
		}
	}
	if haveEffect {
		return
	}

	itemEntry.Effects = append(
		itemEntry.Effects,
		variant,
	)
	missingEffectsMap[effectType][id] = itemEntry
}

func asCoreCallback(callback core.AuraCallback) string {
	callbacks := []string{}
	for i := range 32 {
		callbackFlag := core.AuraCallback(1 << i)
		if callbackFlag >= core.CallbackLast {
			break
		}

		if callback.Matches(callbackFlag) {
			callbacks = append(callbacks, "core."+callbackFlag.String())
		}
	}

	if len(callbacks) == 0 {
		return "core.CallbackEmpty"
	}

	return strings.Join(callbacks, " | ")
}

func asCoreProcMask(procMask core.ProcMask) string {
	procs := []string{}
	for i := range 32 {
		procFlag := core.ProcMask(1 << i)
		if procFlag >= core.ProcMaskLast {
			break
		}

		if procMask.Matches(procFlag) {
			procs = append(procs, "core."+procFlag.String())
		}
	}

	if len(procs) == 0 {
		return "core.ProcMaskUnknown"
	}
	return strings.Join(procs, " | ")
}

func asCoreOutcome(outcome core.HitOutcome) string {
	if outcome == core.OutcomeCrit {
		return "core.OutcomeCrit"
	}

	if outcome.Matches(core.OutcomeLanded) {
		return "core.OutcomeLanded"
	}

	return "core.OutcomeEmpty"
}

func (entry *Entry) AddVariant(variant *Variant) {
	entry.Variants = append(entry.Variants, variant)
	sort.Slice(entry.Variants, func(i, j int) bool {
		return entry.Variants[i].ID < entry.Variants[j].ID
	})
}
