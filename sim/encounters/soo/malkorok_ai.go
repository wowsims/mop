package soo

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const malkorokBossID int32 = 846

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

func createMalkorokPreset(raidPrefix string, config malkorokPresetConfig) {
	bossName := fmt.Sprintf("Malkorok (AMS) %d", config.RaidSize)

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

	AncientMiasma    *core.Spell
	ImplodingEnergy  *core.Spell
	EssenceOfYShaarj *core.Spell
}

func (ai *MalkorokAI) Initialize(target *core.Target, config *proto.Target) {
	ai.Target = target
	ai.isIndividualSim = target.Env.Raid.Size() == 1

	ai.registerAncientMiasma()
	ai.registerImplodingEnergy()
	ai.registerEssenceOfYShaarj()
}

func (ai *MalkorokAI) Reset(sim *core.Simulation) {}

// HasImminentMagicAbility implements core.ImminentMagicAbilityProvider.
func (ai *MalkorokAI) HasImminentMagicAbility(sim *core.Simulation, reactionWindow time.Duration) bool {
	return core.SpellbookHasImminentMagicAbility(ai.Target, sim, reactionWindow)
}

func (ai *MalkorokAI) ExecuteCustomRotation(sim *core.Simulation) {
	target := ai.Target.CurrentTarget
	if target == nil {
		target = &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
	}

	if ai.AncientMiasma.IsReady(sim) {
		ai.AncientMiasma.Cast(sim, target)
	} else if ai.ImplodingEnergy.IsReady(sim) {
		ai.ImplodingEnergy.Cast(sim, target)
	} else if ai.EssenceOfYShaarj.IsReady(sim) {
		ai.EssenceOfYShaarj.Cast(sim, target)
	}

	ai.Target.ExtendGCDUntil(sim, sim.CurrentTime+core.BossGCD)
}

// hitRandomTargets: see immerseus_ai.go's identical helper for the full rationale.
func (ai *MalkorokAI) hitRandomTargets(sim *core.Simulation, numTargets int32, label string, onHit func(*core.Unit)) {
	if ai.isIndividualSim {
		chance := float64(numTargets) / float64(ai.config.RaidSize)
		if sim.Proc(chance, label) {
			onHit(sim.Raid.AllPlayerUnits[0])
		}
		return
	}

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
// grossly overweight those rare gaps, so this rolls within roughly mean+-1stddev instead of the
// full min/max). Hits ~22 of 25 targets, flat damage within observed min/max (CV ~0.05, no ramp).
func (ai *MalkorokAI) registerAncientMiasma() {
	const numTargets = 22 // avgDistinctTargetsPerOccurrence: 21.93

	ai.AncientMiasma = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 142906},
		SpellSchool: core.SpellSchoolShadow, // TODO: verify actual spell school
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
			ai.hitRandomTargets(sim, numTargets, "Ancient Miasma Target", func(target *core.Unit) {
				spell.CalcAndDealDamage(sim, target, sim.RollWithLabel(40095, 69609, "Ancient Miasma Damage"), spell.OutcomeAlwaysHit)
			})

			spell.CD.Set(sim.CurrentTime + ai.rollAncientMiasmaCD(sim))
		},
	})

	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.AncientMiasma.CD.Set(sim.CurrentTime + ai.rollAncientMiasmaCD(sim))
	})
}

func (ai *MalkorokAI) rollAncientMiasmaCD(sim *core.Simulation) time.Duration {
	return core.DurationFromSeconds(sim.RollWithLabel(0.89, 3.93, "Ancient Miasma Timing"))
}

// Imploding Energy (142986): synchronized multi-instance batch every ~23s (observed range
// 18.58-63.58s), hits ~9 of 25 targets, large flat hit within observed min/max.
func (ai *MalkorokAI) registerImplodingEnergy() {
	const numTargets = 9 // avgDistinctTargetsPerOccurrence: 8.91

	ai.ImplodingEnergy = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 142986},
		SpellSchool: core.SpellSchoolShadow, // TODO: verify actual spell school
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagAPL,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Cast: core.CastConfig{
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Second * 23,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			ai.hitRandomTargets(sim, numTargets, "Imploding Energy Target", func(target *core.Unit) {
				spell.CalcAndDealDamage(sim, target, sim.RollWithLabel(585000, 731250, "Imploding Energy Damage"), spell.OutcomeAlwaysHit)
			})

			spell.CD.Set(sim.CurrentTime + ai.rollImplodingEnergyCD(sim))
		},
	})

	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.ImplodingEnergy.CD.Set(sim.CurrentTime + ai.rollImplodingEnergyCD(sim))
	})
}

func (ai *MalkorokAI) rollImplodingEnergyCD(sim *core.Simulation) time.Duration {
	return core.DurationFromSeconds(sim.RollWithLabel(18.58, 63.58, "Imploding Energy Timing"))
}

// Essence of Y'Shaarj (143857): per-player soak mechanic, nearly always single-target (avg 1.12
// distinct targets), exactly flat damage (150000, damageStddev observed as 0). AMS-absorption
// sample for this ability is thin (n=2 in the original pull) -- raid-wide interval/damage
// characterization (n=388/313) is solid, but treat DK-specific exposure as lower-confidence
// than the other two abilities here.
func (ai *MalkorokAI) registerEssenceOfYShaarj() {
	const numTargets = 1 // avgDistinctTargetsPerOccurrence: 1.12, min 1, max 4

	ai.EssenceOfYShaarj = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 143857},
		SpellSchool: core.SpellSchoolShadow, // TODO: verify actual spell school
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
			ai.hitRandomTargets(sim, numTargets, "Essence of Y'Shaarj Target", func(target *core.Unit) {
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
	return core.DurationFromSeconds(sim.RollWithLabel(0.51, 46.86, "Essence of Y'Shaarj Timing"))
}
