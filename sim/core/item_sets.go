package core

import (
	"fmt"
	"slices"

	"github.com/wowsims/mop/sim/core/proto"
)

type ApplySetBonus func(agent Agent, setBonusAura *Aura)

type ItemSet struct {
	ID                      int32
	Name                    string
	AlternativeName         string
	DisabledInChallengeMode bool
	// Maps set piece requirement to an ApplyEffect function that will be called
	// before the Sim starts.
	//
	// The function should apply any benefits provided by the set bonus.
	Bonuses map[int32]ApplySetBonus

	// Optional field to override the DefaultItemSetSlots
	// For Example: The set contains of 2 weapons
	Slots []proto.ItemSlot
}

func DefaultItemSetSlots() []proto.ItemSlot {
	return []proto.ItemSlot{
		proto.ItemSlot_ItemSlotHead,
		proto.ItemSlot_ItemSlotShoulder,
		proto.ItemSlot_ItemSlotChest,
		proto.ItemSlot_ItemSlotHands,
		proto.ItemSlot_ItemSlotLegs,
	}
}

func (set ItemSet) Items() []Item {
	var items []Item
	forEachSetItem(func(item Item) bool {
		if item.SetName == set.Name || item.SetName == set.AlternativeName {
			items = append(items, item)
		}
		return true
	})
	// Sort so the order of IDs is always consistent, for tests.
	slices.SortFunc(items, func(a, b Item) int {
		return int(a.ID - b.ID)
	})
	return items
}

var sets []*ItemSet

// Registers a new ItemSet with item IDs populated.
func NewItemSet(set ItemSet) *ItemSet {
	foundID := set.ID == 0
	foundName := false
	foundAlternativeName := set.AlternativeName == ""

	if len(set.Slots) == 0 {
		set.Slots = DefaultItemSetSlots()
	}

	forEachSetItem(func(item Item) bool {
		foundID = foundID || (item.SetID > 0 && item.SetID == set.ID)
		foundName = foundName || item.SetName == set.Name
		foundAlternativeName = foundAlternativeName || item.SetName == set.AlternativeName
		return !(foundID && foundName && foundAlternativeName)
	})

	if WITH_DB {
		if !foundID {
			panic(fmt.Sprintf("No items found for set id %d", set.ID))
		}
		if !foundName {
			panic("No items found for set " + set.Name)
		}
		if len(set.AlternativeName) > 0 && !foundAlternativeName {
			panic("No items found for set alternative " + set.AlternativeName)
		}
	}

	sets = append(sets, &set)
	return &set
}

type SetBonus struct {
	// Name of the set.
	Name string

	// Number of pieces required for this bonus.
	NumPieces int32

	// Function for applying the effects of this set bonus.
	BonusEffect ApplySetBonus

	// Optional field to override the DefaultItemSetSlots
	// For Example: The set contains of 2 weapons
	Slots []proto.ItemSlot
}

type SetBonusCollection []SetBonus

// Returns a list describing all active set bonuses.
func (equipment *Equipment) getSetBonuses() SetBonusCollection {
	var activeBonuses SetBonusCollection

	setItemCount := make(map[*ItemSet]int32)
	for _, item := range equipment {
		if item.SetName == "" {
			continue
		}

		var foundSet *ItemSet = nil

		if item.SetID > 0 {
			// Try finding by ID first to make sure sets with different names but share id all point to the same count.
			for _, set := range sets {
				if set.ID == item.SetID {
					foundSet = set
					break
				}
			}
		}

		if foundSet == nil {
			for _, set := range sets {
				if set.Name == item.SetName || set.AlternativeName == item.SetName {
					foundSet = set
					break
				}
			}
		}

		if foundSet != nil {
			if foundSet.DisabledInChallengeMode && item.ChallengeMode {
				continue
			}

			setItemCount[foundSet]++
			if bonusEffect, ok := foundSet.Bonuses[setItemCount[foundSet]]; ok {
				activeBonuses = append(activeBonuses, SetBonus{
					Name:        foundSet.Name,
					NumPieces:   setItemCount[foundSet],
					BonusEffect: bonusEffect,
					Slots:       foundSet.Slots,
				})
			}
		}
	}

	return activeBonuses
}

func (character *Character) getActiveSetBonuses() SetBonusCollection {
	return character.Equipment.getSetBonuses()
}

func (character *Character) getUnequippedSetBonuses() SetBonusCollection {
	return character.ItemSwap.unEquippedItems.getSetBonuses()
}

func (collection SetBonusCollection) ContainsBonus(setName string, count int32) bool {
	for _, bonus := range collection {
		if (bonus.Name == setName) && (bonus.NumPieces >= count) {
			return true
		}
	}

	return false
}

// Checks whether the character has an equipped set bonus
func (character *Character) hasActiveSetBonus(setName string, count int32) bool {
	return character.getActiveSetBonuses().ContainsBonus(setName, count)
}

func (character *Character) hasUnequippedSetBonus(setName string, count int32) bool {
	return character.getUnequippedSetBonuses().ContainsBonus(setName, count)
}

func (character *Character) CouldHaveSetBonus(set *ItemSet, numItems int32) bool {
	if character.Env != nil && character.Env.IsFinalized() {
		panic("CouldHaveSetBonus is very slow and should never be called after finalization. Try caching the value during construction instead!")
	}

	if _, ok := set.Bonuses[numItems]; !ok {
		panic(fmt.Sprintf("Item set %s does not have a bonus with %d pieces.", set.Name, numItems))
	}

	if character.hasActiveSetBonus(set.Name, numItems) {
		return true
	}

	if character.ItemSwap.IsEnabled() {
		return character.hasUnequippedSetBonus(set.Name, numItems)
	}

	return false
}

// Apply effects from item set bonuses.
func (character *Character) applyItemSetBonusEffects(agent Agent) {
	activeSetBonuses := character.getActiveSetBonuses()

	for _, activeSetBonus := range activeSetBonuses {
		setBonusAura := character.makeSetBonusStatusAura(activeSetBonus.Name, activeSetBonus.NumPieces, activeSetBonus.Slots, true)
		activeSetBonus.BonusEffect(agent, setBonusAura)
	}

	if character.ItemSwap.IsEnabled() {
		for _, unequippedSetBonus := range character.getUnequippedSetBonuses() {
			if activeSetBonuses.ContainsBonus(unequippedSetBonus.Name, unequippedSetBonus.NumPieces) {
				continue
			}
			setBonusAura := character.makeSetBonusStatusAura(unequippedSetBonus.Name, unequippedSetBonus.NumPieces, unequippedSetBonus.Slots, false)
			unequippedSetBonus.BonusEffect(agent, setBonusAura)
		}
	}
}

func (character *Character) makeSetBonusStatusAura(setName string, numPieces int32, slots []proto.ItemSlot, activeAtStart bool) *Aura {
	statusAura := character.GetOrRegisterAura(Aura{
		Label:      fmt.Sprintf("%s %dP", setName, numPieces),
		BuildPhase: Ternary(activeAtStart, CharacterBuildPhaseGear, CharacterBuildPhaseNone),
		Duration:   NeverExpires,
	})

	if activeAtStart {
		statusAura = MakePermanent(statusAura)
	}

	character.RegisterItemSwapCallback(slots, func(sim *Simulation, _ proto.ItemSlot) {
		if character.hasActiveSetBonus(setName, numPieces) {
			if !statusAura.IsActive() {
				statusAura.Activate(sim)
			}
		} else {
			statusAura.Deactivate(sim)
		}
	})

	return statusAura
}

// Returns the names of all active set bonuses.
func (character *Character) GetActiveSetBonusNames() []string {
	activeSetBonuses := character.getActiveSetBonuses()

	names := make([]string, len(activeSetBonuses))
	for i, activeSetBonus := range activeSetBonuses {
		names[i] = fmt.Sprintf("%s (%dpc)", activeSetBonus.Name, activeSetBonus.NumPieces)
	}
	return names
}

// Adds a spellID to the set bonus so it can be exposed to the APL
func (setBonusTracker *Aura) ExposeToAPL(spellID int32) *Aura {
	setBonusTracker.ActionID = ActionID{SpellID: spellID}
	return setBonusTracker
}

// Adds a Spellmod to PVP GLoves
// Registers the MoP PvP glove bonus as a real item effect on every glove that grants it, so
// the items are recognised as implemented like any other item effect.
//
// The bonus keys off whatever is worn in the hands slot rather than off one specific item, so
// the effect body builds that single character-wide mod and then lets it follow item swaps.
func NewPvPGloveEffect(itemIDs []int32, config SpellModConfig) {
	// These lists are hand-maintained and carry some IDs the database does not ship - the pre-MoP
	// Bloodthirsty gloves among them. Those cannot be equipped and so have nothing to register, but
	// a typo'd or renumbered ID is indistinguishable from one of those from here, and the only
	// symptom is a player quietly losing the bonus. So name the ones being dropped.
	missing := FilterSlice(itemIDs, func(itemID int32) bool {
		if !WITH_DB {
			return false
		}
		return GetItemByID(itemID) == nil
	})
	if len(missing) > 0 {
		fmt.Printf("WARN: PvP glove effect has no database item for %v, bonus not registered for those\n", missing)
	}

	registered := FilterSlice(itemIDs, func(itemID int32) bool {
		return !slices.Contains(missing, itemID)
	})

	// Every one of these gloves grants the same bonus, so only the newest is tested.
	ForEachItemVariant(registered, func(itemID int32) {
		NewItemEffect(itemID, func(agent Agent, _ proto.ItemLevelState) {
			agent.GetCharacter().registerPvPGloveMod(itemID, config)
		})
	})
}

// Gives each glove its own aura carrying the bonus, keyed on the item ID. A character can
// have two of these registered at once - one worn and one in the item swap
// set - but only the worn glove's aura is ever active, so keying per item means the two need
// no coordination and nothing has to be registered conditionally. The aura intentionally
// carries no ActionID, which keeps it out of the aura metrics.
func (character *Character) registerPvPGloveMod(itemID int32, config SpellModConfig) {
	if character.Env.IsChallengeMode {
		return
	}
	var aura *Aura
	apply := func(sim *Simulation) {
		if character.Hands().ID == itemID {
			aura.Activate(sim)
		} else {
			aura.Deactivate(sim)
		}
	}

	aura = character.GetOrRegisterAura(Aura{
		Label:    fmt.Sprintf("PvP Glove Bonus - %d", itemID),
		Duration: NeverExpires,
		OnReset: func(aura *Aura, sim *Simulation) {
			apply(sim)
		},
	}).
		AttachSpellMod(config)

	character.RegisterItemSwapCallback([]proto.ItemSlot{proto.ItemSlot_ItemSlotHands}, func(sim *Simulation, _ proto.ItemSlot) {
		apply(sim)
	})
}
