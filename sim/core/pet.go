package core

import (
	"fmt"
	"math"
	"slices"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

// Extension of Agent interface, for Pets.
type PetAgent interface {
	Agent

	// The Pet controlled by this PetAgent.
	GetPet() *Pet
}

type OnPetEnable func(sim *Simulation)
type OnPetDisable func(sim *Simulation)

type PetStatInheritance func(ownerStats stats.Stats) stats.Stats
type PetSpeedInheritance func(sim *Simulation, ownerSpeedMultiplier float64)

type PetConfig struct {
	Name      string
	Owner     *Character
	BaseStats stats.Stats
	// Hit and Expertise are always inherited by combining the owners physical hit and expertise, then halving it
	// For casters this will automatically give spell hit cap at 7.5% physical hit and exp
	NonHitExpStatInheritance        PetStatInheritance
	EnabledOnStart                  bool
	IsGuardian                      bool
	HasDynamicMeleeSpeedInheritance bool
	HasDynamicCastSpeedInheritance  bool
	HasResourceRegenInheritance     bool
}

// Pet is an extension of Character, for any entity created by a player that can
// take actions on its own.
type Pet struct {
	Character

	Owner *Character

	isGuardian     bool
	enabledOnStart bool

	OnPetEnable  OnPetEnable
	OnPetDisable OnPetDisable

	// Calculates inherited stats based on owner stats or stat changes.
	statInheritance        PetStatInheritance
	dynamicStatInheritance PetStatInheritance
	inheritedStats         stats.Stats

	// In MoP pets inherit their owners melee speed and cast speed
	// rather than having auras such as Heroism being applied to them.
	dynamicMeleeSpeedInheritance  PetSpeedInheritance
	inheritedMeleeSpeedMultiplier float64
	dynamicCastSpeedInheritance   PetSpeedInheritance
	inheritedCastSpeedMultiplier  float64

	// If true the pet will automatically inherit the owner's melee speed
	hasDynamicMeleeSpeedInheritance bool
	// If true the pet will automatically inherit the owner's cast speed
	hasDynamicCastSpeedInheritance bool
	// If true the pet will automatically inherit the owner's regen speed multiplier
	hasResourceRegenInheritance bool

	isReset bool

	// Some pets expire after a certain duration. This is the pending action that disables
	// the pet on expiration.
	timeoutAction *PendingAction

	// Examples:
	// DK Raise Dead is doing its whole RP thing by climbing out of the ground before attacking.
	// Monk clones Rush towards targets before attacking.
	startAttackDelay time.Duration
}

func NewPet(config PetConfig) Pet {
	pet := Pet{
		Character: Character{
			Unit: Unit{
				Type:        PetUnit,
				Index:       config.Owner.Party.Raid.getNextPetIndex(),
				Label:       fmt.Sprintf("%s - %s", config.Owner.Label, config.Name),
				Level:       CharacterLevel,
				PseudoStats: stats.NewPseudoStats(),
				auraTracker: newAuraTracker(),
				Metrics:     NewUnitMetrics(),

				StatDependencyManager: stats.NewStatDependencyManager(),

				ReactionTime: config.Owner.ReactionTime,

				StartDistanceFromTarget: MaxMeleeRange, // TODO: Match to owner and add movement logic to pet rotations
			},
			Name:       config.Name,
			Party:      config.Owner.Party,
			PartyIndex: config.Owner.PartyIndex,
			baseStats:  config.BaseStats,
		},
		Owner:                           config.Owner,
		statInheritance:                 makeStatInheritanceFunc(config.NonHitExpStatInheritance),
		hasDynamicMeleeSpeedInheritance: config.HasDynamicMeleeSpeedInheritance,
		inheritedMeleeSpeedMultiplier:   1,
		hasDynamicCastSpeedInheritance:  config.HasDynamicCastSpeedInheritance,
		inheritedCastSpeedMultiplier:    1,
		hasResourceRegenInheritance:     config.HasResourceRegenInheritance,
		enabledOnStart:                  config.EnabledOnStart,
		isGuardian:                      config.IsGuardian,
	}

	pet.GCD = pet.NewTimer()
	pet.RotationTimer = pet.NewTimer()

	pet.AddStats(config.BaseStats)
	pet.addUniversalStatDependencies()
	pet.PseudoStats.InFrontOfTarget = config.Owner.PseudoStats.InFrontOfTarget
	return pet
}

func (pet *Pet) Initialize() {
	if pet.hasResourceRegenInheritance {
		pet.enableResourceRegenInheritance()
	}
}

func makeStatInheritanceFunc(nonHitExpStatInheritance PetStatInheritance) PetStatInheritance {
	return func(ownerStats stats.Stats) stats.Stats {
		inheritedStats := nonHitExpStatInheritance(ownerStats)

		hitRating := ownerStats[stats.HitRating]
		expertiseRating := ownerStats[stats.ExpertiseRating]
		combined := (hitRating + expertiseRating) * 0.5

		inheritedStats[stats.HitRating] = combined
		inheritedStats[stats.ExpertiseRating] = combined

		return inheritedStats
	}
}

func (pet *Pet) enableDynamicStats(sim *Simulation) {
	if slices.Contains(pet.Owner.DynamicStatsPets, pet) {
		panic("Pet already present in dynamic stats pet list!")
	}

	pet.inheritedStats = pet.statInheritance(pet.Owner.GetStats())
	pet.AddStatsDynamic(sim, pet.inheritedStats)
	pet.Owner.DynamicStatsPets = append(pet.Owner.DynamicStatsPets, pet)
	pet.dynamicStatInheritance = pet.statInheritance
}

// Updates the stats for this pet in response to a stat change on the owner.
// addedStats is the amount of stats added to the owner (will be negative if the
// owner lost stats).
func (pet *Pet) AddOwnerStats(sim *Simulation, addedStats stats.Stats) {
	inheritedChange := pet.dynamicStatInheritance(addedStats)

	pet.inheritedStats.AddInplace(&inheritedChange)
	pet.AddStatsDynamic(sim, inheritedChange)
}

func (pet *Pet) resetDynamicStats(sim *Simulation) {
	if pet.dynamicStatInheritance == nil {
		return
	}

	if idx := slices.Index(pet.Owner.DynamicStatsPets, pet); idx != -1 {
		pet.Owner.DynamicStatsPets = removeBySwappingToBack(pet.Owner.DynamicStatsPets, idx)
	}

	pet.dynamicStatInheritance = nil
	pet.AddStatsDynamic(sim, pet.inheritedStats.Invert())
	pet.inheritedStats = stats.Stats{}
}

func (pet *Pet) reset(sim *Simulation, agent PetAgent) {
	if pet.isReset {
		return
	}
	pet.isReset = true

	pet.Character.reset(sim, agent)

	pet.CancelGCDTimer(sim)
	pet.AutoAttacks.CancelAutoSwing(sim)

	pet.enabled = false
	if pet.enabledOnStart {
		pet.Enable(sim, agent)
	}
}
func (pet *Pet) doneIteration(sim *Simulation) {
	pet.Character.doneIteration(sim)
	pet.Disable(sim)
	pet.isReset = false
}

func (pet *Pet) IsGuardian() bool {
	return pet.isGuardian
}

// petAgent should be the PetAgent which embeds this Pet.
func (pet *Pet) Enable(sim *Simulation, petAgent PetAgent) {
	if pet.enabled {
		if sim.Log != nil {
			pet.Log(sim, "Pet already summoned")
		}
		return
	}

	// In case of Pre-pull guardian summoning we need to reset
	// TODO: Check if this has side effects
	if !pet.isReset {
		pet.reset(sim, petAgent)
	}

	pet.enableDynamicStats(sim)

	//reset current mana after applying stats
	pet.manaBar.reset()

	//reset current health after applying stats
	pet.healthBar.reset(sim)

	// Call onEnable callbacks before enabling auto swing
	// to not have to reorder PAs multiple times
	pet.enabled = true

	if pet.OnPetEnable != nil {
		pet.OnPetEnable(sim)
	}

	if pet.hasDynamicMeleeSpeedInheritance {
		pet.enableDynamicMeleeSpeed(sim)
	}

	if pet.hasDynamicCastSpeedInheritance {
		pet.enableDynamicCastSpeed(sim)
	}

	pet.SetGCDTimer(sim, max(0, sim.CurrentTime+pet.startAttackDelay, sim.CurrentTime))
	pet.AutoAttacks.EnableAutoSwing(sim)

	if (sim.CurrentTime < 0) || (pet.startAttackDelay > 0) {
		pet.AutoAttacks.StopMeleeUntil(sim, max(0, sim.CurrentTime+pet.startAttackDelay)-pet.AutoAttacks.MainhandSwingSpeed())
	}

	if sim.Log != nil {
		pet.Log(sim, "Pet stats: %s", pet.GetStats().FlatString())
		pet.Log(sim, "Pet inherited stats: %s", pet.ApplyStatDependencies(pet.inheritedStats).FlatString())
		pet.Log(sim, "Pet summoned")
	}

	sim.addTracker(&pet.auraTracker)

	if pet.HasFocusBar() {
		// make sure to reset it to refresh focus
		pet.focusBar.reset(sim)
		pet.focusBar.enable(sim, sim.CurrentTime)
		pet.focusBar.focusRegenMultiplier *= pet.Owner.PseudoStats.AttackSpeedMultiplier
	}

	if pet.HasEnergyBar() {
		// make sure to reset it to refresh energy
		pet.energyBar.reset(sim)
		pet.energyBar.enable(sim, sim.CurrentTime)
		pet.energyBar.energyRegenMultiplier *= pet.Owner.PseudoStats.AttackSpeedMultiplier
	}
}

func (pet *Pet) EnableWithStartAttackDelay(sim *Simulation, petAgent PetAgent, startAttackDelay time.Duration) {
	pet.startAttackDelay = startAttackDelay
	pet.Enable(sim, petAgent)
}

// Helper for enabling a pet that will expire after a certain duration.
func (pet *Pet) EnableWithTimeout(sim *Simulation, petAgent PetAgent, petDuration time.Duration) {
	pet.Enable(sim, petAgent)
	pet.SetTimeoutAction(sim, petDuration)
}

func (pet *Pet) SetTimeoutAction(sim *Simulation, duration time.Duration) {
	pet.timeoutAction = sim.GetConsumedPendingActionFromPool()
	pet.timeoutAction.NextActionAt = sim.CurrentTime + duration
	pet.timeoutAction.OnAction = pet.Disable
	sim.AddPendingAction(pet.timeoutAction)
}

func (pet *Pet) SetStartAttackDelay(startAttackDelay time.Duration) {
	pet.startAttackDelay = startAttackDelay
}

func (pet *Pet) enableDynamicMeleeSpeed(sim *Simulation) {
	if slices.Contains(pet.Owner.DynamicMeleeSpeedPets, pet) {
		panic("Pet already present in dynamic melee speed pet list!")
	}

	if math.Abs(pet.inheritedMeleeSpeedMultiplier - 1) > 1e-14 {
		panic(fmt.Sprintf("Pet melee speed multiplier was not reset properly! Current inherited value = %.17f", pet.inheritedMeleeSpeedMultiplier))
	}

	pet.dynamicMeleeSpeedInheritance = func(sim *Simulation, ownerSpeedMultiplier float64) {
		pet.inheritedMeleeSpeedMultiplier *= ownerSpeedMultiplier
		pet.MultiplyMeleeSpeed(sim, ownerSpeedMultiplier)
	}

	pet.dynamicMeleeSpeedInheritance(sim, pet.Owner.PseudoStats.MeleeSpeedMultiplier)
	pet.dynamicMeleeSpeedInheritance(sim, pet.Owner.PseudoStats.AttackSpeedMultiplier)
}

func (pet *Pet) resetDynamicMeleeSpeed(sim *Simulation) {
	if pet.dynamicMeleeSpeedInheritance == nil {
		return
	}

	if idx := slices.Index(pet.Owner.DynamicMeleeSpeedPets, pet); idx != -1 {
		pet.Owner.DynamicMeleeSpeedPets = removeBySwappingToBack(pet.Owner.DynamicMeleeSpeedPets, idx)
	}

	pet.dynamicMeleeSpeedInheritance(sim, 1 / pet.inheritedMeleeSpeedMultiplier)
	pet.dynamicMeleeSpeedInheritance = nil
}

func (pet *Pet) enableDynamicCastSpeed(sim *Simulation) {
	if slices.Contains(pet.Owner.DynamicCastSpeedPets, pet) {
		panic("Pet already present in dynamic cast speed pet list!")
	}

	if math.Abs(pet.inheritedCastSpeedMultiplier - 1) > 1e-14 {
		panic(fmt.Sprintf("Pet cast speed multiplier was not reset properly! Current inherited value = %.17f", pet.inheritedCastSpeedMultiplier))
	}

	pet.dynamicCastSpeedInheritance = func(sim *Simulation, ownerSpeedMultiplier float64) {
		pet.inheritedCastSpeedMultiplier *= ownerSpeedMultiplier
		pet.MultiplyCastSpeed(sim, ownerSpeedMultiplier)
	}

	pet.dynamicCastSpeedInheritance(sim, pet.Owner.PseudoStats.CastSpeedMultiplier)
}

func (pet *Pet) resetDynamicCastSpeed(sim *Simulation) {
	if pet.dynamicCastSpeedInheritance == nil {
		return
	}

	if idx := slices.Index(pet.Owner.DynamicCastSpeedPets, pet); idx != -1 {
		pet.Owner.DynamicCastSpeedPets = removeBySwappingToBack(pet.Owner.DynamicCastSpeedPets, idx)
	}

	pet.dynamicCastSpeedInheritance(sim, 1 / pet.inheritedCastSpeedMultiplier)
	pet.dynamicCastSpeedInheritance = nil
}

func (pet *Pet) enableResourceRegenInheritance() {
	if !slices.Contains(pet.Owner.RegenInheritancePets, pet) {
		pet.Owner.RegenInheritancePets = append(pet.Owner.RegenInheritancePets, pet)
	}
}

func (pet *Pet) Disable(sim *Simulation) {
	if !pet.enabled {
		if sim.Log != nil {
			pet.Log(sim, "No pet summoned")
		}
		return
	}

	pet.resetDynamicStats(sim)
	pet.resetDynamicMeleeSpeed(sim)
	pet.resetDynamicCastSpeed(sim)
	pet.CancelGCDTimer(sim)
	pet.focusBar.disable(sim)
	pet.energyBar.disable(sim)
	pet.AutoAttacks.CancelAutoSwing(sim)
	pet.enabled = false

	// If a pet is immediately re-summoned it might try to use GCD, so we need to clear it.
	pet.Hardcast = Hardcast{}

	if (pet.timeoutAction != nil) && !pet.timeoutAction.consumed {
		pet.timeoutAction.Cancel(sim)
	}

	if pet.OnPetDisable != nil {
		pet.OnPetDisable(sim)
	}

	pet.auraTracker.expireAll(sim)

	sim.removeTracker(&pet.auraTracker)

	if sim.Log != nil {
		pet.Log(sim, "Pet dismissed")
		pet.Log(sim, pet.GetStats().FlatString())
	}
}

func (pet *Pet) ChangeStatInheritance(nonHitExpStatInheritance PetStatInheritance) {
	pet.statInheritance = makeStatInheritanceFunc(nonHitExpStatInheritance)
}

func (pet *Pet) GetInheritedStats() stats.Stats {
	return pet.inheritedStats
}

func (pet *Pet) DisableOnStart() {
	pet.enabledOnStart = false
}

// Default implementations for some Agent functions which most Pets don't need.
func (pet *Pet) GetCharacter() *Character {
	return &pet.Character
}
func (pet *Pet) AddRaidBuffs(_ *proto.RaidBuffs)   {}
func (pet *Pet) AddPartyBuffs(_ *proto.PartyBuffs) {}
func (pet *Pet) ApplyTalents()                     {}
func (pet *Pet) OnGCDReady(_ *Simulation)          {}

func (env *Environment) TriggerDelayedPetInheritance(sim *Simulation, dynamicPets []*Pet, inheritanceFunc func(*Simulation, *Pet)) {
	for _, pet := range dynamicPets {
		if !pet.IsEnabled() {
			continue
		}

		numHeartbeats := (sim.CurrentTime - env.heartbeatOffset) / PetUpdateInterval
		nextHeartbeat := PetUpdateInterval*(numHeartbeats+1) + env.heartbeatOffset

		pa := sim.GetConsumedPendingActionFromPool()
		pa.NextActionAt = nextHeartbeat
		pa.Priority = ActionPriorityDOT

		pa.OnAction = func(sim *Simulation) {
			if pet.enabled {
				inheritanceFunc(sim, pet)
			}
		}

		sim.AddPendingAction(pa)
	}
}
