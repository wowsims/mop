package database

import (
	"bytes"
	"fmt"
	"go/format"
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

// Enchantment IDs at or below this are pre-MoP. They still resolve, and their data is
// carried in the database, but they are not generated.
const MIN_ENCHANT_EFFECT_ID = 4267

func isGeneratableEnchant(effectID int32) bool {
	return effectID > MIN_ENCHANT_EFFECT_ID
}

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
	// Set when the effect deals flat damage rather than granting stats. Damage is not
	// carried in the database, so the resolved amounts are emitted as literals.
	Damage *dbc.DamageEffect
	// Set for on-use enchants, which take a different helper than procs do.
	OnUse      bool
	Profession proto.Profession
	// Set for effects an ignore list deliberately excludes. These emit a comment only, so
	// that skipping them is visible in the generated file rather than silent.
	Skipped bool
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
		slices.SortFunc(grp.Entries, func(a, b *Entry) int {
			if a.Supported != b.Supported {
				return core.TernaryInt(a.Supported, 1, -1)
			}

			return compareEntries(a, b)
		})
	}

	// Set below, once the template it renders from exists. Lets a template emit one of its own
	// named blocks as a string, which is what makes commentOut possible.
	var tmpl *template.Template
	funcMap := map[string]any{
		"asCoreCallback":    asCoreCallback,
		"asCoreProcMask":    asCoreProcMask,
		"asCoreOutcome":     asCoreOutcome,
		"asCoreSpellSchool": asCoreSpellSchool,
		"formatStrings":     formatStrings,
		"commentOut":        commentOut,
		"render": func(name string, data any) (string, error) {
			var block bytes.Buffer
			if err := tmpl.ExecuteTemplate(&block, name, data); err != nil {
				return "", err
			}
			return block.String(), nil
		},
	}
	tmpl = template.Must(template.New("effects").Funcs(funcMap).Parse(templateString))

	var rendered bytes.Buffer
	if err := tmpl.Execute(&rendered, map[string]any{"Groups": groups}); err != nil {
		return fmt.Errorf("failed to execute template: %w", err)
	}

	// The template cannot indent commented-out blocks or blank lines the way gofmt wants,
	// so format the result. Otherwise every regeneration reverts whatever formatted the
	// file last and the diff is hundreds of whitespace-only lines.
	out := rendered.Bytes()
	if formatted, err := format.Source(out); err != nil {
		fmt.Printf("WARN: generated %s is not valid Go, writing unformatted: %v\n", outFile, err)
	} else {
		out = formatted
	}

	if err := os.WriteFile(outFile, out, 0644); err != nil {
		return fmt.Errorf("failed to write file %s: %w", outFile, err)
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
		"jsString":       jsString,
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

	// Several enchanting spells can apply the same enchantment. SpellEffectsById is a
	// map, so keep the lowest spell ID instead of letting iteration order decide which
	// spell the generated tooltip is read from.
	for _, effect := range instance.SpellEffectsById {
		if effect.EffectType != dbc.E_ENCHANT_ITEM {
			continue
		}

		enchantID := effect.EffectMiscValues[0]
		if existing, ok := enchantSpellEffects[enchantID]; ok && existing.SpellID <= effect.SpellID {
			continue
		}
		enchantSpellEffects[enchantID] = &effect
	}

	for _, enchant := range instance.Enchants {
		parsed := enchant.ToProto(EnchantBuffSpellOverrides)
		if _, ok := db.Enchants[parsed.EffectId]; !ok {
			continue
		}

		for _, enchantEffect := range parsed.EnchantEffects {
			TryParseEnchantEffect(parsed, enchantEffect, groupMapProc, instance, enchantSpellEffects)
		}
	}

	// Copied out of the map explicitly, because what is appended is a pointer and the groups
	// are stored by value. GenerateEffectsFile sorts by name, so the iteration order is free.
	procGroups := make([]*Group, 0, len(groupMapProc))
	for name := range groupMapProc {
		grp := groupMapProc[name]
		procGroups = append(procGroups, &grp)
	}
	GenerateEffectsFile(procGroups, "sim/common/mop/enchants_auto_gen.go", TmplStrEnchant)
}

// Appends an entry to the named group, creating the group if this is its first entry. Groups
// are stored by value, so every caller has to write the group back after appending; doing it
// here means no caller can forget to, and none of them has to create an empty group up front
// just in case it turns out to have an entry.
func appendEntry(groupMap map[string]Group, name string, entry *Entry) {
	grp, exists := groupMap[name]
	if !exists {
		grp = Group{Name: name}
	}

	grp.Entries = append(grp.Entries, entry)
	groupMap[name] = grp
}

// Names the ignore-list rule that excluded an effect, for the comment emitted in the
// generated file. Returns "" when nothing excludes it.
func ignoredEffectReason(instance *dbc.DBC, effectID int) string {
	for _, effect := range instance.SpellEffectsInOrder(effectID) {
		if params, ok := IgnoreSpellEffectByAuraType[effect.EffectAura]; ok {
			if len(params) == 0 || slices.Contains(params, effect.EffectMiscValues[0]) {
				return fmt.Sprintf("ignored aura type %d", effect.EffectAura)
			}
		}

		if params, ok := IgnoreSpellEffectBySpellEffectType[effect.EffectType]; ok {
			if len(params) == 0 || slices.Contains(params, effect.EffectMiscValues[0]) {
				return fmt.Sprintf("ignored effect type %d", effect.EffectType)
			}
		}
	}

	return ""
}

// Records an effect excluded by an ignore list so the generated file documents it. Kept in
// its own group: variant merging is per-group, so these cannot affect
// whether a real effect's variant set is emitted live or commented.
func storeSkippedEffect(id int32, name string, buffID int32, instance *dbc.DBC, groupMap map[string]Group) {
	buffName := instance.Spells[int(buffID)].NameLang
	appendEntry(groupMap, "Skipped", &Entry{
		Skipped:  true,
		Variants: []*Variant{{ID: int(id), Name: name, SpellID: int(buffID)}},
		Tooltip: []string{fmt.Sprintf("%s: %q (%d) - %s",
			name, buffName, buffID, ignoredEffectReason(instance, int(buffID)))},
	})
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
				// Commented into the generated file rather than dropped. These are
				// deliberately out of scope - pet summons, teleports, transforms, PvP
				// mechanic immunity - but an item whose only effect is skipped otherwise
				// vanished with no trace, while a sibling marker aura on the same item got
				// reported as missing instead.
				skippedGroup := groupMapProc
				if itemEffect.GetOnUse() != nil {
					skippedGroup = groupMapOnUse
				}
				storeSkippedEffect(parsed.Id, parsed.Name, itemEffect.BuffId, instance, skippedGroup)
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
	onUseGroups := make([]*Group, 0, len(groupMapOnUse))
	for name := range groupMapOnUse {
		grp := groupMapOnUse[name]
		newEntries := []*Entry{}
		entryGroupings := map[string]*Entry{}

		// sort entries first to make grouping consistent for variants
		sortEntries(grp.Entries)

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
	procGroups := make([]*Group, 0, len(groupMapProc))
	needsStatPostfix := map[string]bool{}
	for name := range groupMapProc {
		grp := groupMapProc[name]
		newEntries := []*Entry{}
		entryGroupings := map[string]*Entry{}

		// sort entries first to make tooltip generation consistent for variants
		sortEntries(grp.Entries)

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
		provider := tooltip.DBCTooltipDataProvider{DBC: instance, ItemLevel: int(parsed.ScalingOptions[int32(proto.ItemLevelState_Base)].Ilvl)}
		tooltip, _ := tooltip.ParseTooltip(tooltipString, provider, int64(id))

		if tooltip != nil {
			renderedTooltip := tooltip.String()
			entry := Entry{
				Tooltip:  strings.Split(renderedTooltip, "\n"),
				Variants: []*Variant{{ID: int(parsed.Id), Name: parsed.Name, SpellID: int(itemEffect.BuffId)}},
			}
			entry.ProcInfo, entry.Supported = BuildProcInfo(parsed, int(itemEffect.BuffId), instance, renderedTooltip)

			if len(dbc.EffectStats(itemEffect, proto.ItemLevelState_Base)) == 0 || !entry.Supported {
				StoreMissingEffect("ItemEffects", parsed.Name, Variant{
					ID:      int(parsed.Id),
					Name:    renderedTooltip,
					SpellID: int(itemEffect.BuffId),
				})
				return EffectParseResultUnsupported
			}

			appendEntry(groupMapProc, "Procs", &entry)

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
		provider := tooltip.DBCTooltipDataProvider{DBC: instance, ItemLevel: int(parsed.ScalingOptions[int32(proto.ItemLevelState_Base)].Ilvl)}
		tooltip, _ := tooltip.ParseTooltip(tooltipString, provider, int64(id))

		groupName := GetEffectStatString(itemEffect)

		if tooltip != nil {
			renderedTooltip := tooltip.String()
			entry := &Entry{
				Tooltip:   strings.Split(renderedTooltip, "\n"),
				Variants:  []*Variant{{ID: int(parsed.Id), Name: parsed.Name, SpellID: int(itemEffect.BuffId)}},
				Supported: true,
			}
			appendEntry(groupMap, groupName, entry)

			if len(dbc.EffectStats(itemEffect, proto.ItemLevelState_Base)) == 0 {
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
	// On-use enchants take a different helper, and must not fall into the proc path below
	// via EnchantHasDummyEffect, which would emit a bogus proc stub for them.
	if enchantEffect.GetOnUse() != nil {
		return tryParseOnUseEnchantEffect(enchant, enchantEffect, instance, groupMapProc)
	}

	if (enchantEffect.GetProc() != nil || EnchantHasDummyEffect(enchant, instance)) && isGeneratableEnchant(enchant.EffectId) {

		// Effect was already manually implemented
		if core.HasEnchantEffect(enchant.EffectId) {
			return EffectParseResultSuccess
		}

		if enchantingSpell, ok := enchantSpellEffects[int(enchant.EffectId)]; ok {
			tooltipString := instance.Spells[enchantingSpell.SpellID].Description
			tooltip, _ := tooltip.ParseTooltip(tooltipString, tooltip.DBCTooltipDataProvider{DBC: instance}, int64(enchantingSpell.SpellID))

			renderedTooltip := tooltip.String()
			entry := Entry{Tooltip: strings.Split(renderedTooltip, "\n"), Variants: []*Variant{{ID: int(enchant.EffectId), Name: enchant.Name}}}
			entry.ProcInfo, entry.Supported = BuildEnchantProcInfo(enchant, instance, renderedTooltip)
			entry.Damage = dbc.ResolveDamageEffect(int(enchant.SpellId))
			appendEntry(groupMapProc, "Enchants", &entry)

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

// Generates the engineering tinkers and anything else applying its buff through
// ITEM_ENCHANTMENT_USE_SPELL. Only the ones whose stats resolve can be
// generated; the rest apply a server-scripted buff and are left for a manual implementation.
func tryParseOnUseEnchantEffect(enchant *proto.UIEnchant, enchantEffect *proto.ItemEffect, instance *dbc.DBC, groupMap map[string]Group) EffectParseResult {
	if !isGeneratableEnchant(enchant.EffectId) {
		return EffectParseResultInvalid
	}

	// Effect was already manually implemented
	if core.HasEnchantEffect(enchant.EffectId) {
		return EffectParseResultSuccess
	}

	if !ItemEffectIsSupported(instance, int(enchantEffect.BuffId)) {
		storeSkippedEffect(enchant.EffectId, enchant.Name, enchantEffect.BuffId, instance, groupMap)
		return EffectParseResultUnsupported
	}

	effectStats := dbc.EffectStats(enchantEffect, proto.ItemLevelState_Base)
	if len(effectStats) == 0 {
		StoreMissingEffect("EnchantEffects", enchant.Name, Variant{
			ID:      int(enchant.EffectId),
			Name:    enchant.Name,
			SpellID: int(enchantEffect.BuffId),
		})
		return EffectParseResultUnsupported
	}

	appendEntry(groupMap, "OnUseEnchants", &Entry{
		Supported:  true,
		OnUse:      true,
		Profession: enchant.RequiredProfession,
		Variants:   []*Variant{{ID: int(enchant.EffectId), Name: enchant.Name, SpellID: int(enchantEffect.BuffId)}},
		Tooltip: []string{fmt.Sprintf("%s: %v for %dms, %dms cooldown, category %d",
			enchant.Name, effectStats, enchantEffect.EffectDurationMs,
			enchantEffect.GetOnUse().CooldownMs, enchantEffect.GetOnUse().CategoryId)},
	})

	return EffectParseResultSuccess
}

func ParseTooltipForMissingEffect(parsed *proto.UIItem, itemEffect *proto.ItemEffect, instance *dbc.DBC, groupMap map[string]Group, groupMapName string) {
	if parsed.ScalingOptions[0].Ilvl > MIN_EFFECT_ILVL {
		// Effect was already manually implemented
		if core.HasItemEffect(parsed.Id) {
			return
		}

		tooltipString, id := dbc.GetItemEffectSpellTooltip(int(parsed.Id), int(itemEffect.BuffId))
		provider := tooltip.DBCTooltipDataProvider{DBC: instance, ItemLevel: int(parsed.ScalingOptions[int32(proto.ItemLevelState_Base)].Ilvl)}
		tooltip, _ := tooltip.ParseTooltip(tooltipString, provider, int64(id))

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

			// The entry is always kept, because the commented-out stub documents the gap and
			// because these entries take part in the variant grouping that decides whether a
			// whole variant set is emitted live or commented.
			appendEntry(groupMap, groupMapName, &entry)

			// A marker aura that resolves to nothing is not a missing effect though. The
			// item's real effect is a sibling ItemEffect row, and reporting this one instead
			// was actively misleading.
			if SpellIsPureDummy(int(itemEffect.BuffId), instance) {
				return
			}

			if len(dbc.EffectStats(itemEffect, proto.ItemLevelState_Base)) == 0 || !entry.Supported {
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

// "helpful spell" is how some tooltips name a heal without using the word: Nazgrim's
// Burnished Insignia reads "Your helpful spells have a chance to ...", which matches neither
// of the two above and left the proc with no callback at all.
var hasHelpfulSpellMatcher = regexp.MustCompile(`helpful spell`)

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

	// A dummy effect normally means the buff is applied by server script and cannot be
	// resolved, so the effect is refused. When EnchantBuffSpellOverrides supplies the link,
	// that dummy is exactly what the override resolves and is no longer a reason to refuse.
	if _, linked := EnchantBuffSpellOverrides[int(enchant.EffectId)]; !linked {
		if SpellHasDummyEffect(int(procSpellID), instance) {
			return procInfo, false
		}
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
			(hasHealMatcher.MatchString(tooltip) || hasGenericMatcher.MatchString(tooltip) ||
				hasHelpfulSpellMatcher.MatchString(tooltip)) {
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

	if info.ProcMask.Matches(core.ProcMaskMelee) && procSpell.CanProcFromProcs() {
		info.ProcMask |= core.ProcMaskMeleeProc
	}

	if info.ProcMask.Matches(core.ProcMaskRanged) && procSpell.CanProcFromProcs() {
		info.ProcMask |= core.ProcMaskRangedProc
	}

	if info.ProcMask.Matches(core.ProcMaskSpellDamage) && procSpell.CanProcFromProcs() {
		info.ProcMask |= core.ProcMaskSpellProc
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

	return info, info.Callback != core.CallbackEmpty
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

// A total order over entries. Sorting on the item or enchant ID alone is not one: an item
// with two effects yields two entries sharing that ID, and sort.Slice is
// not stable, so their order in the generated file flipped between runs.
func compareEntries(a *Entry, b *Entry) int {
	if a.Variants[0].ID != b.Variants[0].ID {
		return a.Variants[0].ID - b.Variants[0].ID
	}

	return a.Variants[0].SpellID - b.Variants[0].SpellID
}

// Puts a group's entries in the order they are emitted in, which has to be settled before
// variants are merged so that grouping and tooltip selection are the same on every run.
func sortEntries(entries []*Entry) {
	slices.SortFunc(entries, compareEntries)
}

// Comments out a rendered block line by line, so a template can emit the same block live or
// commented instead of carrying a second, hand-prefixed copy of it. Indentation is left to
// gofmt, which GenerateEffectsFile runs over the finished file.
func commentOut(block string) string {
	lines := strings.Split(block, "\n")
	for i, line := range lines {
		lines[i] = "// " + line
	}

	return strings.Join(lines, "\n")
}

// Escapes a rendered tooltip for use inside a double-quoted TypeScript string.
// Tooltips routinely span several lines, which would otherwise produce a file that does
// not parse.
func jsString(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `"`, `\"`)
	s = strings.ReplaceAll(s, "\r", "")
	return strings.ReplaceAll(s, "\n", `\n`)
}

// Renders a DBC school mask as a core.SpellSchool expression. The two use different bit
// orders, so the mask cannot be passed through as a number.
func asCoreSpellSchool(schoolMask int32) string {
	schools := []struct {
		dbc  dbc.SpellSchool
		name string
	}{
		{dbc.PHYSICAL, "core.SpellSchoolPhysical"},
		{dbc.HOLY, "core.SpellSchoolHoly"},
		{dbc.FIRE, "core.SpellSchoolFire"},
		{dbc.NATURE, "core.SpellSchoolNature"},
		{dbc.FROST, "core.SpellSchoolFrost"},
		{dbc.SHADOW, "core.SpellSchoolShadow"},
		{dbc.ARCANE, "core.SpellSchoolArcane"},
	}

	names := []string{}
	for _, school := range schools {
		if dbc.SpellSchool(schoolMask)&school.dbc != 0 {
			names = append(names, school.name)
		}
	}

	if len(names) == 0 {
		return "core.SpellSchoolNone"
	}

	return strings.Join(names, " | ")
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
