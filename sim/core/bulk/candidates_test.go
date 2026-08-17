package bulk

import (
	"fmt"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)

func addBulkTestEnchant(effectID int32, itemType proto.ItemType, extraTypes []proto.ItemType, enchantType proto.EnchantType) {
	core.AddToDatabase(&proto.SimDatabase{
		Enchants: []*proto.SimEnchant{
			{
				EffectId:    effectID,
				Type:        itemType,
				ExtraTypes:  extraTypes,
				EnchantType: enchantType,
			},
		},
	})
}

func TestBulkSimEnchantAppliesToItem_UsesTypedWeaponRules(t *testing.T) {
	twoHandEffectID := int32(910001)
	staffEffectID := int32(910002)
	shieldEffectID := int32(910003)
	offHandEffectID := int32(910004)

	addBulkTestEnchant(twoHandEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeTwoHand)
	addBulkTestEnchant(staffEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeStaff)
	addBulkTestEnchant(shieldEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeShield)
	addBulkTestEnchant(offHandEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeOffHand)

	twoHandSword := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeSword,
		HandType:   proto.HandType_HandTypeTwoHand,
	}
	oneHandSword := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeSword,
		HandType:   proto.HandType_HandTypeOneHand,
	}
	staff := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeStaff,
		HandType:   proto.HandType_HandTypeTwoHand,
	}
	shield := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeShield,
		HandType:   proto.HandType_HandTypeOffHand,
	}
	offHand := core.Item{
		Type:       proto.ItemType_ItemTypeWeapon,
		WeaponType: proto.WeaponType_WeaponTypeOffHand,
		HandType:   proto.HandType_HandTypeOffHand,
	}

	if !enchantAppliesToItem(twoHandEffectID, twoHandSword) {
		t.Fatalf("expected two-hand enchant to apply to two-handed weapon")
	}
	if enchantAppliesToItem(twoHandEffectID, oneHandSword) {
		t.Fatalf("expected two-hand enchant to not apply to one-handed weapon")
	}

	if !enchantAppliesToItem(staffEffectID, staff) {
		t.Fatalf("expected staff enchant to apply to staff")
	}
	if enchantAppliesToItem(staffEffectID, twoHandSword) {
		t.Fatalf("expected staff enchant to not apply to non-staff weapon")
	}

	if !enchantAppliesToItem(shieldEffectID, shield) {
		t.Fatalf("expected shield enchant to apply to shield")
	}
	if enchantAppliesToItem(shieldEffectID, offHand) {
		t.Fatalf("expected shield enchant to not apply to off-hand frill")
	}

	if !enchantAppliesToItem(offHandEffectID, offHand) {
		t.Fatalf("expected off-hand enchant to apply to off-hand frill")
	}
	if !enchantAppliesToItem(offHandEffectID, shield) {
		t.Fatalf("expected off-hand enchant to apply to shield")
	}
	if enchantAppliesToItem(offHandEffectID, oneHandSword) {
		t.Fatalf("expected off-hand enchant to not apply to one-handed weapon")
	}
}

func TestBulkSimEnchantAppliesToItem_UsesTypedRangedRules(t *testing.T) {
	rangedEffectID := int32(910005)
	weaponEffectID := int32(910006)

	addBulkTestEnchant(rangedEffectID, proto.ItemType_ItemTypeRanged, nil, proto.EnchantType_EnchantTypeNormal)
	addBulkTestEnchant(weaponEffectID, proto.ItemType_ItemTypeWeapon, nil, proto.EnchantType_EnchantTypeNormal)

	bow := core.Item{
		Type:             proto.ItemType_ItemTypeRanged,
		RangedWeaponType: proto.RangedWeaponType_RangedWeaponTypeBow,
	}
	wand := core.Item{
		Type:             proto.ItemType_ItemTypeRanged,
		RangedWeaponType: proto.RangedWeaponType_RangedWeaponTypeWand,
	}
	gun := core.Item{
		Type:             proto.ItemType_ItemTypeRanged,
		RangedWeaponType: proto.RangedWeaponType_RangedWeaponTypeGun,
	}

	if !enchantAppliesToItem(rangedEffectID, bow) {
		t.Fatalf("expected ranged enchant to apply to bow")
	}
	if enchantAppliesToItem(rangedEffectID, wand) {
		t.Fatalf("expected ranged enchant to not apply to wand")
	}
	if enchantAppliesToItem(weaponEffectID, gun) {
		t.Fatalf("expected non-ranged enchant to not apply to non-wand ranged weapon")
	}
}

func TestBulkSimEnchantAppliesToItem_SupportsExtraTypes(t *testing.T) {
	extraTypeEffectID := int32(910007)
	addBulkTestEnchant(extraTypeEffectID, proto.ItemType_ItemTypeChest, []proto.ItemType{proto.ItemType_ItemTypeWrist}, proto.EnchantType_EnchantTypeNormal)

	wrist := core.Item{Type: proto.ItemType_ItemTypeWrist}
	legs := core.Item{Type: proto.ItemType_ItemTypeLegs}

	if !enchantAppliesToItem(extraTypeEffectID, wrist) {
		t.Fatalf("expected enchant to apply to item type listed in extra types")
	}
	if enchantAppliesToItem(extraTypeEffectID, legs) {
		t.Fatalf("expected enchant to not apply to unrelated item type")
	}
}

func TestReorganizeGems_PersistsHeadMetaOnly(t *testing.T) {
	existing := core.Item{
		Type:       proto.ItemType_ItemTypeHead,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorMeta, proto.GemColor_GemColorRed},
		Gems: []core.Gem{
			{ID: 1001, Color: proto.GemColor_GemColorMeta},
			{ID: 1002, Color: proto.GemColor_GemColorRed},
		},
	}
	newItem := core.Item{
		Type:       proto.ItemType_ItemTypeHead,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorMeta, proto.GemColor_GemColorBlue},
	}

	gems := applyMetaGem(existing, newItem)
	if len(gems) != 2 {
		t.Fatalf("expected 2 gem slots, got %d", len(gems))
	}
	if gems[0] != 1001 {
		t.Fatalf("expected meta gem to persist in meta socket, got %d", gems[0])
	}
	if gems[1] != 0 {
		t.Fatalf("expected non-meta gem to be cleared, got %d", gems[1])
	}
}

func TestReorganizeGems_DropsNonHeadGems(t *testing.T) {
	existing := core.Item{
		Type:       proto.ItemType_ItemTypeHands,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorRed},
		Gems: []core.Gem{
			{ID: 2001, Color: proto.GemColor_GemColorRed},
		},
	}
	newItem := core.Item{
		Type:       proto.ItemType_ItemTypeHands,
		GemSockets: []proto.GemColor{proto.GemColor_GemColorRed},
	}

	gems := applyMetaGem(existing, newItem)
	if len(gems) != 1 {
		t.Fatalf("expected 1 gem slot, got %d", len(gems))
	}
	if gems[0] != 0 {
		t.Fatalf("expected non-head gems to be cleared, got %d", gems[0])
	}
}

// Per-spec mainhand/offhand combination matrix.

// Feeds every spec a pool of synthetic weapons covering every (weaponType, handType) shape the
// class can equip - ranged weapons included, since MoP puts bows and wands in the mainhand -
// then asserts the generated MH/OH pairs are all wearable in game and that no eligible item is
// dropped from the batch. Run with -v to print the per-spec combination table.

// (weaponType, handType) pairs that actually occur in assets/database/db.json, so the synthetic
// pool cannot invent shapes like a one-handed off-hand frill.
var comboTableWeaponShapes = map[proto.WeaponType][]proto.HandType{
	proto.WeaponType_WeaponTypeAxe:     {proto.HandType_HandTypeMainHand, proto.HandType_HandTypeOneHand, proto.HandType_HandTypeTwoHand},
	proto.WeaponType_WeaponTypeDagger:  {proto.HandType_HandTypeMainHand, proto.HandType_HandTypeOneHand, proto.HandType_HandTypeOffHand},
	proto.WeaponType_WeaponTypeFist:    {proto.HandType_HandTypeOneHand},
	proto.WeaponType_WeaponTypeMace:    {proto.HandType_HandTypeMainHand, proto.HandType_HandTypeOneHand, proto.HandType_HandTypeTwoHand},
	proto.WeaponType_WeaponTypeOffHand: {proto.HandType_HandTypeOffHand},
	proto.WeaponType_WeaponTypePolearm: {proto.HandType_HandTypeTwoHand},
	proto.WeaponType_WeaponTypeShield:  {proto.HandType_HandTypeOffHand},
	proto.WeaponType_WeaponTypeStaff:   {proto.HandType_HandTypeTwoHand},
	proto.WeaponType_WeaponTypeSword:   {proto.HandType_HandTypeMainHand, proto.HandType_HandTypeOneHand, proto.HandType_HandTypeTwoHand},
}

// Iteration order for the pool, so item ids and the printed table are stable.
var comboTableWeaponTypes = []proto.WeaponType{
	proto.WeaponType_WeaponTypeAxe,
	proto.WeaponType_WeaponTypeDagger,
	proto.WeaponType_WeaponTypeFist,
	proto.WeaponType_WeaponTypeMace,
	proto.WeaponType_WeaponTypeOffHand,
	proto.WeaponType_WeaponTypePolearm,
	proto.WeaponType_WeaponTypeShield,
	proto.WeaponType_WeaponTypeStaff,
	proto.WeaponType_WeaponTypeSword,
}

var comboTableRangedTypes = []proto.RangedWeaponType{
	proto.RangedWeaponType_RangedWeaponTypeBow,
	proto.RangedWeaponType_RangedWeaponTypeCrossbow,
	proto.RangedWeaponType_RangedWeaponTypeGun,
	proto.RangedWeaponType_RangedWeaponTypeThrown,
	proto.RangedWeaponType_RangedWeaponTypeWand,
}

var comboTableWeaponTypeNames = map[proto.WeaponType]string{
	proto.WeaponType_WeaponTypeAxe:     "Axe",
	proto.WeaponType_WeaponTypeDagger:  "Dagger",
	proto.WeaponType_WeaponTypeFist:    "Fist",
	proto.WeaponType_WeaponTypeMace:    "Mace",
	proto.WeaponType_WeaponTypeOffHand: "Frill",
	proto.WeaponType_WeaponTypePolearm: "Polearm",
	proto.WeaponType_WeaponTypeShield:  "Shield",
	proto.WeaponType_WeaponTypeStaff:   "Staff",
	proto.WeaponType_WeaponTypeSword:   "Sword",
}

var comboTableHandTypeNames = map[proto.HandType]string{
	proto.HandType_HandTypeMainHand: "MHonly",
	proto.HandType_HandTypeOneHand:  "1H",
	proto.HandType_HandTypeOffHand:  "OHonly",
	proto.HandType_HandTypeTwoHand:  "2H",
}

var comboTableRangedTypeNames = map[proto.RangedWeaponType]string{
	proto.RangedWeaponType_RangedWeaponTypeBow:      "Bow",
	proto.RangedWeaponType_RangedWeaponTypeCrossbow: "Crossbow",
	proto.RangedWeaponType_RangedWeaponTypeGun:      "Gun",
	proto.RangedWeaponType_RangedWeaponTypeThrown:   "Thrown",
	proto.RangedWeaponType_RangedWeaponTypeWand:     "Wand",
}

func comboTableWeaponID(weaponType proto.WeaponType, handType proto.HandType, copyIdx int) int32 {
	return 990000 + int32(weaponType)*100 + int32(handType)*10 + int32(copyIdx)
}

func comboTableRangedID(rangedType proto.RangedWeaponType, copyIdx int) int32 {
	return 991000 + int32(rangedType)*10 + int32(copyIdx)
}

// Two copies of every shape: a single copy can never produce a same-item-in-both-hands combo,
// so the pool would silently skip that half of the matrix.
const comboTableCopiesPerShape = 2

func registerComboTableItems() {
	items := make([]*proto.SimItem, 0, 64)
	for _, weaponType := range comboTableWeaponTypes {
		for _, handType := range comboTableWeaponShapes[weaponType] {
			for copyIdx := range comboTableCopiesPerShape {
				items = append(items, &proto.SimItem{
					Id:             comboTableWeaponID(weaponType, handType, copyIdx),
					Name:           fmt.Sprintf("%s-%s#%d", comboTableWeaponTypeNames[weaponType], comboTableHandTypeNames[handType], copyIdx),
					Type:           proto.ItemType_ItemTypeWeapon,
					WeaponType:     weaponType,
					HandType:       handType,
					ScalingOptions: map[int32]*proto.ScalingItemProperties{0: {}},
				})
			}
		}
	}
	for _, rangedType := range comboTableRangedTypes {
		for copyIdx := range comboTableCopiesPerShape {
			items = append(items, &proto.SimItem{
				Id:               comboTableRangedID(rangedType, copyIdx),
				Name:             fmt.Sprintf("%s#%d", comboTableRangedTypeNames[rangedType], copyIdx),
				Type:             proto.ItemType_ItemTypeRanged,
				RangedWeaponType: rangedType,
				ScalingOptions:   map[int32]*proto.ScalingItemProperties{0: {}},
			})
		}
	}
	core.AddToDatabase(&proto.SimDatabase{Items: items})
}

var comboTableSpecs = []struct {
	spec  proto.Spec
	class proto.Class
	label string
}{
	{proto.Spec_SpecBloodDeathKnight, proto.Class_ClassDeathKnight, "Blood Death Knight"},
	{proto.Spec_SpecFrostDeathKnight, proto.Class_ClassDeathKnight, "Frost Death Knight"},
	{proto.Spec_SpecUnholyDeathKnight, proto.Class_ClassDeathKnight, "Unholy Death Knight"},
	{proto.Spec_SpecBalanceDruid, proto.Class_ClassDruid, "Balance Druid"},
	{proto.Spec_SpecFeralDruid, proto.Class_ClassDruid, "Feral Druid"},
	{proto.Spec_SpecGuardianDruid, proto.Class_ClassDruid, "Guardian Druid"},
	{proto.Spec_SpecRestorationDruid, proto.Class_ClassDruid, "Restoration Druid"},
	{proto.Spec_SpecBeastMasteryHunter, proto.Class_ClassHunter, "Beast Mastery Hunter"},
	{proto.Spec_SpecMarksmanshipHunter, proto.Class_ClassHunter, "Marksmanship Hunter"},
	{proto.Spec_SpecSurvivalHunter, proto.Class_ClassHunter, "Survival Hunter"},
	{proto.Spec_SpecArcaneMage, proto.Class_ClassMage, "Arcane Mage"},
	{proto.Spec_SpecFireMage, proto.Class_ClassMage, "Fire Mage"},
	{proto.Spec_SpecFrostMage, proto.Class_ClassMage, "Frost Mage"},
	{proto.Spec_SpecBrewmasterMonk, proto.Class_ClassMonk, "Brewmaster Monk"},
	{proto.Spec_SpecMistweaverMonk, proto.Class_ClassMonk, "Mistweaver Monk"},
	{proto.Spec_SpecWindwalkerMonk, proto.Class_ClassMonk, "Windwalker Monk"},
	{proto.Spec_SpecHolyPaladin, proto.Class_ClassPaladin, "Holy Paladin"},
	{proto.Spec_SpecProtectionPaladin, proto.Class_ClassPaladin, "Protection Paladin"},
	{proto.Spec_SpecRetributionPaladin, proto.Class_ClassPaladin, "Retribution Paladin"},
	{proto.Spec_SpecDisciplinePriest, proto.Class_ClassPriest, "Discipline Priest"},
	{proto.Spec_SpecHolyPriest, proto.Class_ClassPriest, "Holy Priest"},
	{proto.Spec_SpecShadowPriest, proto.Class_ClassPriest, "Shadow Priest"},
	{proto.Spec_SpecAssassinationRogue, proto.Class_ClassRogue, "Assassination Rogue"},
	{proto.Spec_SpecCombatRogue, proto.Class_ClassRogue, "Combat Rogue"},
	{proto.Spec_SpecSubtletyRogue, proto.Class_ClassRogue, "Subtlety Rogue"},
	{proto.Spec_SpecElementalShaman, proto.Class_ClassShaman, "Elemental Shaman"},
	{proto.Spec_SpecEnhancementShaman, proto.Class_ClassShaman, "Enhancement Shaman"},
	{proto.Spec_SpecRestorationShaman, proto.Class_ClassShaman, "Restoration Shaman"},
	{proto.Spec_SpecAfflictionWarlock, proto.Class_ClassWarlock, "Affliction Warlock"},
	{proto.Spec_SpecDemonologyWarlock, proto.Class_ClassWarlock, "Demonology Warlock"},
	{proto.Spec_SpecDestructionWarlock, proto.Class_ClassWarlock, "Destruction Warlock"},
	{proto.Spec_SpecArmsWarrior, proto.Class_ClassWarrior, "Arms Warrior"},
	{proto.Spec_SpecFuryWarrior, proto.Class_ClassWarrior, "Fury Warrior"},
	{proto.Spec_SpecProtectionWarrior, proto.Class_ClassWarrior, "Protection Warrior"},
}

// classComboTableItems returns every synthetic weapon the class can actually equip somewhere, so
// the selection fed to the generator mirrors what the item search would let through.
func classComboTableItems(class proto.Class) []core.Item {
	items := make([]core.Item, 0, 32)
	for _, weaponType := range comboTableWeaponTypes {
		if _, ok := core.ClassWeaponTypeCapabilities[class][weaponType]; !ok {
			continue
		}
		for _, handType := range comboTableWeaponShapes[weaponType] {
			for copyIdx := range comboTableCopiesPerShape {
				items = append(items, core.NewItem(core.ItemSpec{ID: comboTableWeaponID(weaponType, handType, copyIdx)}))
			}
		}
	}
	for _, rangedType := range comboTableRangedTypes {
		if !slices.Contains(core.ClassRangedWeaponTypeCapabilities[class], rangedType) {
			continue
		}
		for copyIdx := range comboTableCopiesPerShape {
			items = append(items, core.NewItem(core.ItemSpec{ID: comboTableRangedID(rangedType, copyIdx)}))
		}
	}
	return items
}

func itemsToSpecs(items []core.Item) []*proto.ItemSpec {
	specs := make([]*proto.ItemSpec, 0, len(items))
	for _, item := range items {
		specs = append(specs, &proto.ItemSpec{Id: item.ID})
	}
	return specs
}

// Mirrors newBulkSimCandidateGenerator's field setup for a player with empty base gear, so the
// matrix exercises the real initSelectedItems / getAllWeaponCombos path.
func newComboTableGenerator(class proto.Class, spec proto.Spec, selected []*proto.ItemSpec) *bulkSimCandidateGenerator {
	return &bulkSimCandidateGenerator{
		settings:            &proto.BulkSettings{Items: selected},
		playerClass:         class,
		playerSpec:          spec,
		playerCanDualWield:  core.SpecCanDualWieldCapabilities[spec] && class != proto.Class_ClassHunter,
		playerIsFuryWarrior: spec == proto.Spec_SpecFuryWarrior,
		baseEquipment:       core.Equipment{},
		selectedByBulkSlot:  make(map[BulkSimItemSlot][]bulkSimCandidateOption),
		groupedPairsBySlot:  make(map[BulkSimItemSlot][][2]bulkSimCandidateOption),
		frozenItems:         make(map[BulkSimItemSlot]*core.Item),
		weaponTypeFilters:   make(map[proto.ItemSlot][]proto.WeaponType),
	}
}

// Titan's Grip is the only way a two-hander leaves the mainhand, and in MoP it covers every
// two-hander Fury can wield - spell 46917's subclass mask includes polearms and staves.
func titansGripAllows(spec proto.Spec) bool {
	return spec == proto.Spec_SpecFuryWarrior
}

// Real in-game equip rules, slot aware, kept separate from the production predicates on purpose so
// a wrong rule there does not silently become the expectation here. It also carries weight the
// production side cannot: the missing-item half of the matrix needs to know which hands an item
// *should* reach, which no generator rule implies.
func comboSlotLegal(item core.Item, class proto.Class, spec proto.Spec, slot proto.ItemSlot) bool {
	if item.Type == proto.ItemType_ItemTypeRanged {
		// MoP has no ranged slot: bows and wands are worn in the mainhand.
		return slot == proto.ItemSlot_ItemSlotMainHand &&
			slices.Contains(core.ClassRangedWeaponTypeCapabilities[class], item.RangedWeaponType)
	}
	capability, ok := core.ClassWeaponTypeCapabilities[class][item.WeaponType]
	if !ok {
		return false
	}
	switch slot {
	case proto.ItemSlot_ItemSlotMainHand:
		switch item.HandType {
		case proto.HandType_HandTypeMainHand, proto.HandType_HandTypeOneHand:
			return true
		case proto.HandType_HandTypeTwoHand:
			return capability.CanUseTwoHand
		}
		return false
	case proto.ItemSlot_ItemSlotOffHand:
		switch item.HandType {
		case proto.HandType_HandTypeOffHand:
			// Shields and off-hand frills need no dual wield; an off-hand-only dagger does.
			if item.WeaponType == proto.WeaponType_WeaponTypeShield || item.WeaponType == proto.WeaponType_WeaponTypeOffHand {
				return true
			}
			return core.SpecCanDualWieldCapabilities[spec]
		case proto.HandType_HandTypeOneHand:
			return core.SpecCanDualWieldCapabilities[spec]
		case proto.HandType_HandTypeTwoHand:
			return capability.CanUseTwoHand && titansGripAllows(spec)
		}
		return false
	}
	return false
}

func comboLabel(option *bulkSimCandidateOption) string {
	if option == nil {
		return "(empty)"
	}
	return option.item.Name
}

// Returns "" when the combo is wearable, otherwise why it is not.
func comboIllegalReason(combo [2]*bulkSimCandidateOption, class proto.Class, spec proto.Spec) string {
	mh, oh := combo[0], combo[1]
	if mh != nil && !comboSlotLegal(mh.item, class, spec, proto.ItemSlot_ItemSlotMainHand) {
		return fmt.Sprintf("%s cannot be worn in the mainhand", mh.item.Name)
	}
	if oh != nil && !comboSlotLegal(oh.item, class, spec, proto.ItemSlot_ItemSlotOffHand) {
		return fmt.Sprintf("%s cannot be worn in the offhand", oh.item.Name)
	}
	if mh == nil || oh == nil {
		return ""
	}
	if mh.item.Type == proto.ItemType_ItemTypeRanged && mh.item.RangedWeaponType != proto.RangedWeaponType_RangedWeaponTypeWand {
		return fmt.Sprintf("%s occupies both hands, so %s cannot be worn", mh.item.Name, oh.item.Name)
	}
	if mh.item.HandType == proto.HandType_HandTypeTwoHand && !titansGripAllows(spec) {
		return fmt.Sprintf("%s is two-handed, so %s cannot be worn", mh.item.Name, oh.item.Name)
	}
	return ""
}

func handTypeShape(option *bulkSimCandidateOption) string {
	if option == nil {
		return "none"
	}
	if option.item.Type == proto.ItemType_ItemTypeRanged {
		if option.item.RangedWeaponType == proto.RangedWeaponType_RangedWeaponTypeWand {
			return "Wand"
		}
		return "Ranged"
	}
	switch option.item.HandType {
	case proto.HandType_HandTypeOffHand:
		if option.item.WeaponType == proto.WeaponType_WeaponTypeShield {
			return "Shield"
		}
		return "OHonly"
	}
	if name, ok := comboTableHandTypeNames[option.item.HandType]; ok {
		return name
	}
	return "unknown"
}

func shapeOf(combo [2]*bulkSimCandidateOption) string {
	return fmt.Sprintf("MH=%-6s OH=%s", handTypeShape(combo[0]), handTypeShape(combo[1]))
}

func sortedShapeKeys(shapes map[string]int) []string {
	keys := make([]string, 0, len(shapes))
	for key := range shapes {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func TestWeaponComboMatrixPerSpec(t *testing.T) {
	registerComboTableItems()

	type matrixRow struct {
		label      string
		dualWield  bool
		pool       int
		mhSlot     int
		ohSlot     int
		handSlot   int
		combos     int
		illegal    int
		missing    int
		shapes     map[string]int
		illegalEgs []string
		missingEgs []string
	}
	rows := make([]matrixRow, 0, len(comboTableSpecs))

	for _, testCase := range comboTableSpecs {
		pool := classComboTableItems(testCase.class)
		generator := newComboTableGenerator(testCase.class, testCase.spec, itemsToSpecs(pool))
		if err := generator.initSelectedItems(); err != nil {
			t.Fatalf("%s: initSelectedItems: %v", testCase.label, err)
		}

		combos := generator.getAllWeaponCombos()
		shapes := make(map[string]int, 16)
		illegal := make([]string, 0)
		usedInMainHand := make(map[int32]struct{}, len(pool))
		usedInOffHand := make(map[int32]struct{}, len(pool))
		for _, combo := range combos {
			shapes[shapeOf(combo)]++
			if reason := comboIllegalReason(combo, testCase.class, testCase.spec); reason != "" {
				illegal = append(illegal, reason)
			}
			if combo[0] != nil {
				usedInMainHand[combo[0].item.ID] = struct{}{}
			}
			if combo[1] != nil {
				usedInOffHand[combo[1].item.ID] = struct{}{}
			}
		}

		// Every item the spec can legally wear in a hand has to reach that hand: an item that
		// never shows up in any combo was dropped from the batch entirely.
		missing := make([]string, 0)
		for _, item := range pool {
			if comboSlotLegal(item, testCase.class, testCase.spec, proto.ItemSlot_ItemSlotMainHand) {
				if _, ok := usedInMainHand[item.ID]; !ok {
					missing = append(missing, item.Name+" (mainhand)")
				}
			}
			if comboSlotLegal(item, testCase.class, testCase.spec, proto.ItemSlot_ItemSlotOffHand) {
				if _, ok := usedInOffHand[item.ID]; !ok {
					missing = append(missing, item.Name+" (offhand)")
				}
			}
		}

		rows = append(rows, matrixRow{
			label:      testCase.label,
			dualWield:  generator.playerCanDualWield,
			pool:       len(pool),
			mhSlot:     len(generator.selectedByBulkSlot[BulkSimItemSlotMainHand]),
			ohSlot:     len(generator.selectedByBulkSlot[BulkSimItemSlotOffHand]),
			handSlot:   len(generator.selectedByBulkSlot[BulkSimItemSlotHandWeapon]),
			combos:     len(combos),
			illegal:    len(illegal),
			missing:    len(missing),
			shapes:     shapes,
			illegalEgs: illegal[:min(len(illegal), 6)],
			missingEgs: missing[:min(len(missing), 6)],
		})

		if len(illegal) > 0 {
			t.Errorf("%s: %d unwearable combos, e.g. %s", testCase.label, len(illegal), strings.Join(illegal[:min(len(illegal), 6)], "; "))
		}
		if len(missing) > 0 {
			t.Errorf("%s: %d equippable items never reached a combo, e.g. %s", testCase.label, len(missing), strings.Join(missing[:min(len(missing), 6)], "; "))
		}
	}

	t.Logf("| %-20s | %-2s | %4s | %2s | %2s | %2s | %6s | %7s | %7s |", "spec", "DW", "pool", "MH", "OH", "HW", "combos", "illegal", "missing")
	t.Logf("| %-20s | %-2s | %4s | %2s | %2s | %2s | %6s | %7s | %7s |", strings.Repeat("-", 20), "--", "----", "--", "--", "--", "------", "-------", "-------")
	for _, row := range rows {
		dualWield := "no"
		if row.dualWield {
			dualWield = "yes"
		}
		t.Logf("| %-20s | %-2s | %4d | %2d | %2d | %2d | %6d | %7d | %7d |",
			row.label, dualWield, row.pool, row.mhSlot, row.ohSlot, row.handSlot, row.combos, row.illegal, row.missing)
	}
	for _, row := range rows {
		t.Logf("=== %s (dualWield=%v, combos=%d)", row.label, row.dualWield, row.combos)
		for _, key := range sortedShapeKeys(row.shapes) {
			t.Logf("    %-24s x%d", key, row.shapes[key])
		}
		for _, reason := range row.illegalEgs {
			t.Logf("    ILLEGAL: %s", reason)
		}
		for _, name := range row.missingEgs {
			t.Logf("    MISSING: %s", name)
		}
	}
}

// Per-spec paired-slot (ring / trinket / both hands) matrix.

// Covers the paired bulk slots for every spec: which same-slot pairings the candidate generator
// offers for two copies of one item, two items sharing a limit category, unique items, and plain
// distinct items. Run with -v to print the table.

const (
	pairRingPlainID   int32 = 992001
	pairRingOtherID   int32 = 992002
	pairRingUniqueID  int32 = 992003
	pairRingLimitAID  int32 = 992004
	pairRingLimitBID  int32 = 992005
	pairTrinketPlain  int32 = 992011
	pairTrinketOther  int32 = 992012
	pairTrinketUnique int32 = 992013
	pairWeaponPlainID int32 = 992021
	pairWeaponUniqID  int32 = 992022
)

const pairLimitCategory int32 = 4242

// Every dual-wielding class can use one-handed axes, so the same-weapon-in-both-hands row is
// about the generator rather than about weapon proficiency.
const pairWeaponType = proto.WeaponType_WeaponTypeAxe

func registerPairedSlotItems() {
	item := func(id int32, itemType proto.ItemType, unique bool, limitCategory int32) *proto.SimItem {
		return &proto.SimItem{
			Id:             id,
			Name:           fmt.Sprintf("PairTest-%d", id),
			Type:           itemType,
			Unique:         unique,
			LimitCategory:  limitCategory,
			ScalingOptions: map[int32]*proto.ScalingItemProperties{0: {}},
		}
	}
	weapon := func(id int32, unique bool) *proto.SimItem {
		simItem := item(id, proto.ItemType_ItemTypeWeapon, unique, 0)
		simItem.WeaponType = pairWeaponType
		simItem.HandType = proto.HandType_HandTypeOneHand
		return simItem
	}

	core.AddToDatabase(&proto.SimDatabase{Items: []*proto.SimItem{
		item(pairRingPlainID, proto.ItemType_ItemTypeFinger, false, 0),
		item(pairRingOtherID, proto.ItemType_ItemTypeFinger, false, 0),
		item(pairRingUniqueID, proto.ItemType_ItemTypeFinger, true, 0),
		item(pairRingLimitAID, proto.ItemType_ItemTypeFinger, false, pairLimitCategory),
		item(pairRingLimitBID, proto.ItemType_ItemTypeFinger, false, pairLimitCategory),
		item(pairTrinketPlain, proto.ItemType_ItemTypeTrinket, false, 0),
		item(pairTrinketOther, proto.ItemType_ItemTypeTrinket, false, 0),
		item(pairTrinketUnique, proto.ItemType_ItemTypeTrinket, true, 0),
		weapon(pairWeaponPlainID, false),
		weapon(pairWeaponUniqID, true),
	}})
}

// Two copies of everything that may legitimately be doubled, one copy of the rest.
func pairedSlotSelection() []*proto.ItemSpec {
	ids := []int32{
		pairRingPlainID, pairRingPlainID,
		pairRingOtherID,
		pairRingUniqueID, pairRingUniqueID,
		pairRingLimitAID, pairRingLimitBID,
		pairTrinketPlain, pairTrinketPlain,
		pairTrinketOther,
		pairTrinketUnique, pairTrinketUnique,
		pairWeaponPlainID, pairWeaponPlainID,
		pairWeaponUniqID, pairWeaponUniqID,
	}
	specs := make([]*proto.ItemSpec, 0, len(ids))
	for _, id := range ids {
		specs = append(specs, &proto.ItemSpec{Id: id})
	}
	return specs
}

type pairKey struct {
	first  int32
	second int32
}

func newPairKey(first int32, second int32) pairKey {
	if second < first {
		first, second = second, first
	}
	return pairKey{first: first, second: second}
}

func TestPairedSlotMatrixPerSpec(t *testing.T) {
	registerPairedSlotItems()

	// asserted == false rows are printed but not enforced: whether a second copy of the same
	// ring or trinket is offered is a product decision, not an equip rule.
	cases := []struct {
		label    string
		pair     pairKey
		want     bool
		asserted bool
	}{
		{label: "ring: two copies of a plain item", pair: newPairKey(pairRingPlainID, pairRingPlainID), want: true, asserted: false},
		{label: "ring: one copy of a plain item", pair: newPairKey(pairRingOtherID, pairRingOtherID), want: false, asserted: true},
		{label: "ring: two copies of a unique item", pair: newPairKey(pairRingUniqueID, pairRingUniqueID), want: false, asserted: true},
		{label: "ring: two items sharing a limit category", pair: newPairKey(pairRingLimitAID, pairRingLimitBID), want: false, asserted: true},
		{label: "ring: two distinct plain items", pair: newPairKey(pairRingPlainID, pairRingOtherID), want: true, asserted: true},
		{label: "ring: distinct plain + unique items", pair: newPairKey(pairRingPlainID, pairRingUniqueID), want: true, asserted: true},
		{label: "trinket: two copies of a plain item", pair: newPairKey(pairTrinketPlain, pairTrinketPlain), want: true, asserted: false},
		{label: "trinket: two copies of a unique item", pair: newPairKey(pairTrinketUnique, pairTrinketUnique), want: false, asserted: true},
		{label: "trinket: two distinct plain items", pair: newPairKey(pairTrinketPlain, pairTrinketOther), want: true, asserted: true},
	}

	for _, testCase := range comboTableSpecs {
		generator := newComboTableGenerator(testCase.class, testCase.spec, pairedSlotSelection())
		if err := generator.initSelectedItems(); err != nil {
			t.Fatalf("%s: initSelectedItems: %v", testCase.label, err)
		}
		generator.initGroupedSlotPairs()

		offered := make(map[pairKey]bool)
		for _, bulkSlot := range []BulkSimItemSlot{BulkSimItemSlotFinger, BulkSimItemSlotTrinket} {
			for _, pair := range generator.groupedPairsBySlot[bulkSlot] {
				offered[newPairKey(pair[0].spec.GetId(), pair[1].spec.GetId())] = true
			}
		}
		// Both hands are a paired slot too, just built by getAllWeaponCombos instead.
		weaponPairs := make(map[pairKey]bool)
		for _, combo := range generator.getAllWeaponCombos() {
			if combo[0] == nil || combo[1] == nil {
				continue
			}
			weaponPairs[newPairKey(combo[0].spec.GetId(), combo[1].spec.GetId())] = true
		}

		t.Logf("=== %s (dualWield=%v)", testCase.label, generator.playerCanDualWield)
		for _, expectation := range cases {
			got := offered[expectation.pair]
			if expectation.asserted && got != expectation.want {
				t.Errorf("%s: %s = %v, want %v", testCase.label, expectation.label, got, expectation.want)
			}
			t.Logf("    %-46s %v", expectation.label, got)
		}

		// A 1H weapon may fill both hands only for a dual-wielder, and never when it is unique.
		_, classUsesPairWeapon := core.ClassWeaponTypeCapabilities[testCase.class][pairWeaponType]
		wantSameWeapon := generator.playerCanDualWield && classUsesPairWeapon
		samePlain := weaponPairs[newPairKey(pairWeaponPlainID, pairWeaponPlainID)]
		sameUnique := weaponPairs[newPairKey(pairWeaponUniqID, pairWeaponUniqID)]
		if samePlain != wantSameWeapon {
			t.Errorf("%s: two copies of a plain 1H weapon in both hands = %v, want %v", testCase.label, samePlain, wantSameWeapon)
		}
		if sameUnique {
			t.Errorf("%s: two copies of a unique 1H weapon wielded in both hands", testCase.label)
		}
		t.Logf("    %-46s %v", "weapon: two copies of a plain 1H item", samePlain)
		t.Logf("    %-46s %v", "weapon: two copies of a unique 1H item", sameUnique)
		t.Logf("    pairs: finger=%d trinket=%d, weaponCombos=%d",
			len(generator.groupedPairsBySlot[BulkSimItemSlotFinger]),
			len(generator.groupedPairsBySlot[BulkSimItemSlotTrinket]),
			len(generator.getAllWeaponCombos()))
	}
}
