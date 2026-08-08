package soo

import (
	"fmt"
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const malkorokBossID int32 = 71454

// Default soak rate for Imploding Energy: ~9 of 25 players hit per batch (see
// registerImplodingEnergy).
const defaultImplodingEnergySoakPercent = 36.0

type malkorokPresetConfig struct {
	RaidSize int32
	IsHeroic bool

	// TODO: verify -- no boss health/armor/melee data was gathered for this pilot (the WCL
	// pull characterized magic-damage mechanics only, since that's all AMS interacts with).
	BossHealth      float64
	BossArmor       float64
	MeleeMinDamage  float64
	MeleeDamageSpan float64
}

func addMalkorok(raidPrefix string) {
	createMalkorokPreset(raidPrefix, malkorokPresetConfig{
		RaidSize:        25,
		IsHeroic:        true,
		BossHealth:      900_000_000,
		BossArmor:       24835,
		MeleeMinDamage:  250_000,
		MeleeDamageSpan: 0.5,
	})
}

func malkorokTargetInputs() []*proto.TargetInput {
	return []*proto.TargetInput{
		{
			Label:       "Imploding Energy Soak %",
			Tooltip:     "Percentage of Imploding Energy batches this player soaks. The default 36% matches the ~9 of 25 players hit per batch in the reference log; raise it if you're always assigned to soak, lower it if you rarely are.",
			InputType:   proto.InputType_Number,
			NumberValue: defaultImplodingEnergySoakPercent,
		},
	}
}

// createMalkorokPreset registers a Malkorok target that intentionally never models the
// intermission/Phase 2 -- it just loops Phase 1's three abilities on their own CD rolls for
// however long the fight runs, the same simplification Iron Juggernaut makes (see
// iron_juggernaut_ai.go). All CD ranges below are Phase 1 timings taken from WCL report
// CzZAMTXx1nW9Pygm fight 27 (which has a real Blood Rage cast into an intermission at ~142s), but
// since that transition isn't modeled here, they're applied as if Phase 1 continues indefinitely
// regardless of the configured fight length.
func createMalkorokPreset(raidPrefix string, config malkorokPresetConfig) {
	bossName := fmt.Sprintf("Malkorok (DPS) %d", config.RaidSize)

	if config.IsHeroic {
		bossName += " H"
	}

	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: raidPrefix,

		Config: &proto.Target{
			Id:        malkorokBossID,
			Name:      bossName,
			Level:     93,
			MobType:   proto.MobType_MobTypeHumanoid,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      config.BossHealth,
				stats.Armor:       config.BossArmor,
				stats.AttackPower: 0,
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    2.0,
			MinBaseDamage: config.MeleeMinDamage,
			DamageSpread:  config.MeleeDamageSpan,
			TargetInputs:  malkorokTargetInputs(),
		},

		AI: makeMalkorokAI(config),
	})

	core.AddPresetEncounter(bossName+" - P1", []string{
		raidPrefix + "/" + bossName,
	})
}

func makeMalkorokAI(config malkorokPresetConfig) core.AIFactory {
	return func() core.TargetAI {
		return &MalkorokAI{
			config: config,
		}
	}
}

type MalkorokAI struct {
	Target *core.Target
	config malkorokPresetConfig

	isIndividualSim bool

	ImplodingEnergySoakChance float64

	AncientMiasma    *core.Spell
	ImplodingEnergy  *core.Spell
	EssenceOfYShaarj *core.Spell
}

func (ai *MalkorokAI) Initialize(target *core.Target, config *proto.Target) {
	ai.Target = target
	ai.isIndividualSim = target.Env.Raid.Size() == 1

	// Encounter settings saved before this input existed come through with no inputs at all.
	soakPercent := defaultImplodingEnergySoakPercent
	if len(config.TargetInputs) > 0 {
		soakPercent = config.TargetInputs[0].NumberValue
	}
	ai.ImplodingEnergySoakChance = min(max(soakPercent, 0), 100) / 100

	ai.registerAncientMiasma()
	ai.registerImplodingEnergy()
	ai.registerEssenceOfYShaarj()
}

func (ai *MalkorokAI) Reset(sim *core.Simulation) {
	ai.Target.RandomizeGCDTiming(sim)
}

func (ai *MalkorokAI) ExecuteCustomRotation(sim *core.Simulation) {
	target := ai.Target.CurrentTarget
	if target == nil {
		target = &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
	}

	// Independent periodic mechanics, not a single GCD-locked cast -- fire every one that's ready.
	if ai.AncientMiasma.IsReady(sim) {
		ai.AncientMiasma.Cast(sim, target)
	}
	if ai.ImplodingEnergy.IsReady(sim) {
		ai.ImplodingEnergy.Cast(sim, target)
	}
	if ai.EssenceOfYShaarj.IsReady(sim) {
		ai.EssenceOfYShaarj.Cast(sim, target)
	}

	ai.Target.ExtendGCDUntil(sim, sim.CurrentTime+core.BossGCD)
}

// hitRandomTargets spreads onHit over the fraction of the raid an ability is observed to hit. In
// an individual sim there's only the one player, so that fraction becomes the chance they're the
// one soaking this occurrence.
func (ai *MalkorokAI) hitRandomTargets(sim *core.Simulation, soakChance float64, label string, onHit func(*core.Unit)) {
	if ai.isIndividualSim {
		if sim.Proc(soakChance, label) {
			onHit(sim.Raid.AllPlayerUnits[0])
		}
		return
	}

	numTargets := int32(math.Round(soakChance * float64(ai.config.RaidSize)))
	allUnits := sim.Raid.AllPlayerUnits
	if int(numTargets) >= len(allUnits) {
		for _, unit := range allUnits {
			onHit(unit)
		}
		return
	}

	indices := make([]int32, len(allUnits))
	for i := range indices {
		indices[i] = int32(i)
	}

	for i := int32(0); i < numTargets; i++ {
		roll := int32(sim.RandomFloat(label) * float64(len(indices)))
		onHit(allUnits[indices[roll]])
		indices[roll] = indices[len(indices)-1]
		indices = indices[:len(indices)-1]
	}
}

// Ancient Miasma (142906): fast raid-wide tick, observed mean interval 1.91s (stddev 2.1s, with
// a long tail up to 35s from rare movement/phase gaps -- using the full observed range would
// grossly overweight those rare gaps, so this rolls within roughly mean+-1stddev (clipped at 0,
// since mean-stddev is negative) instead of the full min/max). Hits ~22 of 25 targets. Damage is
// a hard 44550 unmitigated -- every 25m HC log shows exactly this value, no variance -- so it's
// dealt as a flat amount rather than rolled.
func (ai *MalkorokAI) registerAncientMiasma() {
	const numTargets = 22 // avgDistinctTargetsPerOccurrence: 21.93

	ai.AncientMiasma = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 142906},
		SpellSchool: core.SpellSchoolShadow,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagAPL,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Cast: core.CastConfig{
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Millisecond * 1900,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			ai.hitRandomTargets(sim, float64(numTargets)/float64(ai.config.RaidSize), "Ancient Miasma Target", func(target *core.Unit) {
				spell.CalcAndDealDamage(sim, target, 44550, spell.OutcomeAlwaysHit)
			})

			spell.CD.Set(sim.CurrentTime + ai.rollAncientMiasmaCD(sim))
		},
	})

	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.AncientMiasma.CD.Set(sim.CurrentTime + ai.rollAncientMiasmaCD(sim))
	})
}

func (ai *MalkorokAI) rollAncientMiasmaCD(sim *core.Simulation) time.Duration {
	return core.DurationFromSeconds(sim.RollWithLabel(1.95, 2.05, "Ancient Miasma Timing"))
}

// Imploding Energy (142986): synchronized multi-instance batch every ~23s. The CD range below
// (19.01-30.79s) is the min/max interval observed during Phase 1 of WCL report CzZAMTXx1nW9Pygm
// fight 27 (see createMalkorokPreset for why the sim just loops these Phase 1 timings for the
// whole fight rather than modeling the intermission). Hits ~9 of 25 targets (the "Imploding Energy
// Soak %" target input's 36% default), flat 585000 damage with 0 variance.
func (ai *MalkorokAI) registerImplodingEnergy() {
	ai.ImplodingEnergy = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 142986},
		SpellSchool: core.SpellSchoolShadow,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagAPL,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Cast: core.CastConfig{
			IgnoreHaste: true,
			DefaultCast: core.Cast{
				GCD:      core.GCDDefault,
				CastTime: time.Millisecond * 4000,
			},
			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Second * 21,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			ai.hitRandomTargets(sim, ai.ImplodingEnergySoakChance, "Imploding Energy Target", func(target *core.Unit) {
				spell.CalcAndDealDamage(sim, target, 585000, spell.OutcomeAlwaysHit)
			})

			spell.CD.Set(sim.CurrentTime + ai.rollImplodingEnergyCD(sim))
		},
	})

	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.ImplodingEnergy.CD.Set(sim.CurrentTime + ai.rollImplodingEnergyCD(sim))
	})
}

func (ai *MalkorokAI) rollImplodingEnergyCD(sim *core.Simulation) time.Duration {
	return core.DurationFromSeconds(sim.RollWithLabel(15.01, 26.79, "Imploding Energy Timing"))
}

// Essence of Y'Shaarj (143857): per-player soak, flat 150000 damage. Modeled as single-target --
// WCL occasionally shows 2+ hits per spawn from accidental splash, not a real raid-wide component
// -- so the CD range below is spawn-to-spawn, not raw hit-to-hit gaps. From WCL report
// CzZAMTXx1nW9Pygm fight 27, Phase 1 (see createMalkorokPreset).
//
// This is the ability a DK most wants to plan Anti-Magic Shell around, to guarantee soaking it.
func (ai *MalkorokAI) registerEssenceOfYShaarj() {
	const numTargets = 1 // modeled as single-target -- see comment above

	ai.EssenceOfYShaarj = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 143857},
		SpellSchool: core.SpellSchoolShadow,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagAPL,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Cast: core.CastConfig{
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Second * 6,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			ai.hitRandomTargets(sim, float64(numTargets)/float64(ai.config.RaidSize), "Essence of Y'Shaarj Target", func(target *core.Unit) {
				spell.CalcAndDealDamage(sim, target, 150000, spell.OutcomeAlwaysHit)
			})

			spell.CD.Set(sim.CurrentTime + ai.rollEssenceOfYShaarjCD(sim))
		},
	})

	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.EssenceOfYShaarj.CD.Set(sim.CurrentTime + ai.rollEssenceOfYShaarjCD(sim))
	})
}

func (ai *MalkorokAI) rollEssenceOfYShaarjCD(sim *core.Simulation) time.Duration {
	return core.DurationFromSeconds(sim.RollWithLabel(2.96, 26.78, "Essence of Y'Shaarj Timing"))
}
