package affliction

import (
	"math"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/warlock"
)

func RegisterAfflictionWarlock() {
	core.RegisterAgentFactory(
		proto.Player_AfflictionWarlock{},
		proto.Spec_SpecAfflictionWarlock,
		func(character *core.Character, options *proto.Player) core.Agent {
			return NewAfflictionWarlock(character, options)
		},
		func(player *proto.Player, spec interface{}) {
			playerSpec, ok := spec.(*proto.Player_AfflictionWarlock)
			if !ok {
				panic("Invalid spec value for Affliction Warlock!")
			}
			player.Spec = playerSpec
		},
	)
}

func NewAfflictionWarlock(character *core.Character, options *proto.Player) *AfflictionWarlock {
	affOptions := options.GetAfflictionWarlock().Options
	affliction := &AfflictionWarlock{
		Warlock: warlock.NewWarlock(character, options, affOptions.ClassOptions),
	}

	affliction.MaleficGraspMaleficEffectMultiplier = 0.3
	affliction.DrainSoulMaleficEffectMultiplier = 0.6

	return affliction
}

type AfflictionWarlock struct {
	*warlock.Warlock

	SoulShards         core.SecondaryResourceBar
	Agony              *core.Spell
	UnstableAffliction *core.Spell

	SoulBurnAura *core.Aura

	LastCorruptionTarget *core.Unit // Tracks the last target we've applied corruption to
	LastInhaleTarget     *core.Unit

	DrainSoulMaleficEffectMultiplier    float64
	MaleficGraspMaleficEffectMultiplier float64
	ProcMaleficEffect                   func(target *core.Unit, coeff float64, sim *core.Simulation)
}

func (affliction AfflictionWarlock) getMasteryBonus() float64 {
	return (8 + affliction.GetMasteryPoints()) * 3.1
}

func (affliction *AfflictionWarlock) GetWarlock() *warlock.Warlock {
	return affliction.Warlock
}

const MaxSoulShards = int32(4)

func (affliction *AfflictionWarlock) Initialize() {
	affliction.Warlock.Initialize()

	affliction.SoulShards = affliction.RegisterNewDefaultSecondaryResourceBar(core.SecondaryResourceConfig{
		Type:    proto.SecondaryResourceType_SecondaryResourceTypeSoulShards,
		Max:     MaxSoulShards,
		Default: MaxSoulShards,
	})

	affliction.registerPotentAffliction()
	affliction.registerHaunt()
	affliction.RegisterCorruption(func(resultList core.SpellResultSlice, spell *core.Spell, sim *core.Simulation) {
		if resultList[0].Landed() {
			affliction.LastCorruptionTarget = resultList[0].Target
		}
	}, nil)

	affliction.registerAgony()
	affliction.registerNightfall()
	affliction.registerUnstableAffliction()
	affliction.registerMaleficEffect()
	affliction.registerMaleficGrasp()
	affliction.registerDrainSoul()
	affliction.registerDarkSoulMisery()
	affliction.registerSoulburn()
	affliction.registerSeed()
	affliction.registerSoulSwap()

	affliction.registerGlyphs()

	affliction.registerHotfixes()
}

func (affliction *AfflictionWarlock) ApplyTalents() {
	affliction.Warlock.ApplyTalents()
}

func (affliction *AfflictionWarlock) Reset(sim *core.Simulation) {
	affliction.Warlock.Reset(sim)

	affliction.LastCorruptionTarget = nil
}

func (affliction *AfflictionWarlock) OnEncounterStart(sim *core.Simulation) {
	defaultShards := MaxSoulShards
	if affliction.SoulBurnAura.IsActive() {
		defaultShards -= 1
	}

	haunt := affliction.GetSpell(core.ActionID{SpellID: HauntSpellID})
	count := affliction.SpellsInFlight[haunt]
	defaultShards -= count

	affliction.SoulShards.ResetBarTo(sim, defaultShards)
	affliction.Warlock.OnEncounterStart(sim)
}

func calculateDoTBaseTickDamage(dot *core.Dot) float64 {
	stacks := math.Max(float64(dot.Aura.GetStacks()), 1)
	return dot.SnapshotBaseDamage * dot.SnapshotAttackerMultiplier * stacks
}
