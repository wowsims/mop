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

	implodingEnergyWave     int
	scheduleImplodingEnergy func(sim *core.Simulation)
	ImplodingEnergy         *core.Spell

	AncientMiasma         *core.Spell
	scheduleAncientMiasma func(sim *core.Simulation, delay time.Duration)

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

	ai.implodingEnergyWave = 0
	ai.scheduleImplodingEnergy(sim)
	// Acient Miasma's first tick is ~5s after encounter start
	ai.scheduleAncientMiasma(sim, time.Second*3)
}

func (ai *MalkorokAI) ExecuteCustomRotation(sim *core.Simulation) {
	target := ai.Target.CurrentTarget
	if target == nil {
		target = &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
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

// Ancient Miasma (142906): Fast raid-wide tick every 2s
func (ai *MalkorokAI) registerAncientMiasma() {
	ai.scheduleAncientMiasma = func(sim *core.Simulation, delay time.Duration) {
		target := ai.Target.CurrentTarget
		if target == nil {
			target = &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
		}

		pa := sim.GetConsumedPendingActionFromPool()
		pa.NextActionAt = sim.CurrentTime + time.Millisecond*2000 + delay
		pa.Priority = core.ActionPriorityDOT
		pa.OnAction = func(sim *core.Simulation) {
			ai.AncientMiasma.Cast(sim, target)
		}
		sim.AddPendingAction(pa)
	}

	ai.AncientMiasma = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 142906},
		SpellSchool: core.SpellSchoolShadow,
		ProcMask:    core.ProcMaskSpellDamage,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			for _, playerUnit := range sim.Raid.AllPlayerUnits {
				spell.CalcAndDealDamage(sim, playerUnit, 44550, spell.OutcomeAlwaysHit)
			}

			ai.scheduleAncientMiasma(sim, 0)
		},
	})
}

// Imploding Energy (142986): synchronized multi-instance batch. One wave is ~9 separate damage
// events inside a 17ms burst, which is why it's measured wave-to-wave and modeled as a single cast
// here. Hits ~9 of 25 targets (the "Imploding Energy Soak %" target input's 36% default), flat
// 585000 damage with 0 variance.
//
// The soak is not on a random cooldown -- it runs on a fixed grid, measured over 200 SoO 25-man
// kills (190 Heroic / 10 Normal, 1200 waves) from the pull to the first Blood Rage:
//
//	soak(k) = 21.010 + 20*k + 10*floor(k/3)   seconds from the pull, +-0.9s
//
// 20s between waves, stretching to 30s on every third one because a Breath of Y'Shaarj falls inside
// that interval. The observed sample stops at the first Blood Rage (~144.9s) after exactly six
// waves; past that the grid is simply continued, matching how this preset already loops Phase 1 for
// the whole fight (see createMalkorokPreset).
//
// The 4s cast time is the in-game warning: the energy lingers before it detonates, so the cast bar
// is how a player knows to react. Damage lands on cast completion, i.e. at soak(k).
func (ai *MalkorokAI) registerImplodingEnergy() {
	const (
		damage         = 585000.0
		castTime       = time.Millisecond * 4000
		firstSoak      = 21.010 // soak(0)
		wavePeriod     = 20.0
		breathStretch  = 10.0 // added to the gap once every wavesPerBreath waves
		wavesPerBreath = 3
		jitter         = 0.9 // soak(k) is +-this; all of it inherited from Arcing Smash's own roll
	)

	soakAt := func(sim *core.Simulation, wave int) time.Duration {
		grid := firstSoak + wavePeriod*float64(wave) + breathStretch*float64(wave/wavesPerBreath)
		return core.DurationFromSeconds(grid + sim.RollWithLabel(-jitter, jitter, "Imploding Energy Timing"))
	}

	// The wave times are absolute, so this owns the timing outright -- the spell has no cooldown and
	// no GCD. Going through the boss GCD instead would quantise every wave up to the next 1620ms
	// tick and lose the grid this whole schedule exists to reproduce.
	ai.scheduleImplodingEnergy = func(sim *core.Simulation) {
		target := ai.Target.CurrentTarget
		if target == nil {
			target = &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
		}

		// Start casting early enough that the detonation lands on the measured soak time.
		castAt := soakAt(sim, ai.implodingEnergyWave) - castTime

		pa := sim.GetConsumedPendingActionFromPool()
		pa.NextActionAt = max(castAt, sim.CurrentTime)
		pa.Priority = core.ActionPriorityDOT
		pa.OnAction = func(sim *core.Simulation) {
			ai.ImplodingEnergy.Cast(sim, target)
		}
		sim.AddPendingAction(pa)
	}

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
				CastTime: castTime,
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			ai.hitRandomTargets(sim, ai.ImplodingEnergySoakChance, "Imploding Energy Target", func(target *core.Unit) {
				spell.CalcAndDealDamage(sim, target, damage, spell.OutcomeAlwaysHit)
			})

			ai.implodingEnergyWave++
			ai.scheduleImplodingEnergy(sim)
		},
	})
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
