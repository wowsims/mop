package toes

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

func addSha(raidPrefix string) {
	createHeroicShaPreset(raidPrefix, 25, 1_632_111_860, 620_921)
}

func createHeroicShaPreset(raidPrefix string, raidSize int32, bossHealth float64, bossMinBaseDamage float64) {
	bossName := fmt.Sprintf("Sha of Fear %d H", raidSize)

	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: raidPrefix,

		Config: &proto.Target{
			Id:        60999,
			Name:      bossName,
			Level:     93,
			MobType:   proto.MobType_MobTypeElemental,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      bossHealth,
				stats.Armor:       24835,
				stats.AttackPower: 0, // actual value doesn't matter in MoP, as long as damage parameters are fit consistently
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    2.5,
			MinBaseDamage: bossMinBaseDamage,
			DamageSpread:  0.6195,
			TargetInputs:  []*proto.TargetInput{},
		},

		AI: makeShaAI(raidSize),
	})

	core.AddPresetEncounter(bossName+" P2", []string{
		raidPrefix + "/" + bossName,
	})
}

func makeShaAI(raidSize int32) core.AIFactory {
	return func() core.TargetAI {
		return &ShaAI{
			raidSize: raidSize,
		}
	}
}

type ShaAI struct {
	// Unit references
	Target   *core.Target
	TankUnit *core.Unit

	// Static parameters associated with a given preset
	raidSize int32

	// Bookkeeping variables
	numAutosSinceLastThrash         int32
	lastAutoTime                    time.Duration
	numThrashesSinceLastDreadThrash int32

	// Spell + aura references
	ThrashAura      *core.Aura
	DreadThrashAura *core.Aura
	TankSwapDebuff  *core.Aura
	TankSwapSpell   *core.Spell
	Submerge        *core.Spell
	Emerge          *core.Spell
}

func (ai *ShaAI) Initialize(target *core.Target, config *proto.Target) {
	// Save unit references
	ai.Target = target
	ai.TankUnit = target.CurrentTarget

	// Register relevant spells and auras
	ai.registerThrash()
	ai.registerTankSwaps()
	ai.registerSubmerge()
}

func (ai *ShaAI) registerThrash() {
	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.numThrashesSinceLastDreadThrash = 0
		ai.lastAutoTime = -core.NeverExpires
		ai.numAutosSinceLastThrash = int32(sim.RandomFloat("Thrash Timing") * 3.0)
	})

	ai.ThrashAura = ai.Target.RegisterAura(core.Aura{
		Label:    "Thrash",
		ActionID: core.ActionID{SpellID: 131996},
		Duration: core.NeverExpires,

		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.ProcMask.Matches(core.ProcMaskMeleeWhiteHit) && (sim.CurrentTime > ai.lastAutoTime) {
				ai.lastAutoTime = sim.CurrentTime

				for range 2 {
					aura.Unit.AutoAttacks.MHAuto().Cast(sim, result.Target)
				}

				ai.numThrashesSinceLastDreadThrash += 1
				ai.numAutosSinceLastThrash = 0
				aura.Deactivate(sim)
			}
		},
	})

	ai.DreadThrashAura = ai.Target.RegisterAura(core.Aura{
		Label:    "Dread Thrash",
		ActionID: core.ActionID{SpellID: 132007},
		Duration: core.NeverExpires,

		OnSpellHitDealt: func(aura *core.Aura, sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			if spell.ProcMask.Matches(core.ProcMaskMeleeWhiteHit) && (sim.CurrentTime > ai.lastAutoTime) {
				ai.lastAutoTime = sim.CurrentTime

				for range 4 {
					aura.Unit.AutoAttacks.MHAuto().Cast(sim, result.Target)
				}

				ai.numThrashesSinceLastDreadThrash = 0
				ai.numAutosSinceLastThrash = 0
				aura.Deactivate(sim)
			}
		},
	})

	ai.Target.MakeProcTriggerAura(core.ProcTrigger{
		Name:               "Thrash Listener",
		Callback:           core.CallbackOnSpellHitDealt,
		ProcMask:           core.ProcMaskMeleeWhiteHit,
		TriggerImmediately: true,

		Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
			if !ai.ThrashAura.IsActive() && !ai.DreadThrashAura.IsActive() {
				ai.lastAutoTime = sim.CurrentTime
				ai.numAutosSinceLastThrash += 1

				if ai.numAutosSinceLastThrash == 3 {
					if ai.numThrashesSinceLastDreadThrash == 3 {
						ai.DreadThrashAura.Activate(sim)
					} else {
						ai.ThrashAura.Activate(sim)
					}
				}
			}
		},
	})
}

func (ai *ShaAI) registerTankSwaps() {
	if ai.TankUnit == nil {
		return
	}

	actionID := core.ActionID{SpellID: 120669}

	var oldArmorMultiplier float64

	ai.TankSwapDebuff = ai.TankUnit.RegisterAura(core.Aura{
		Label:    "Naked and Afraid",
		ActionID: actionID,
		Duration: time.Second * 55,

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			ai.Target.AutoAttacks.CancelAutoSwing(sim)
			ai.Target.CurrentTarget = nil
			aura.Unit.PseudoStats.InFrontOfTarget = false
			oldArmorMultiplier = aura.Unit.PseudoStats.ArmorMultiplier
			aura.Unit.PseudoStats.ArmorMultiplier -= oldArmorMultiplier
			aura.Unit.PseudoStats.BaseDodgeChance -= 1
			aura.Unit.PseudoStats.BaseParryChance -= 1
		},

		OnExpire: func(aura *core.Aura, _ *core.Simulation) {
			aura.Unit.PseudoStats.ArmorMultiplier += oldArmorMultiplier
			aura.Unit.PseudoStats.BaseDodgeChance += 1
			aura.Unit.PseudoStats.BaseParryChance += 1
		},
	})

	ai.TankSwapSpell = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID: actionID,
		ProcMask: core.ProcMaskEmpty,
		Flags:    core.SpellFlagAPL,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.BossGCD,
			},

			IgnoreHaste: true,

			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Second * 30,
			},
		},

		ApplyEffects: func(sim *core.Simulation, tankTarget *core.Unit, _ *core.Spell) {
			if ai.TankSwapDebuff.IsActive() {
				return
			}

			if tankTarget == ai.Target.CurrentTarget {
				ai.TankSwapDebuff.Activate(sim)
			} else {
				ai.Target.CurrentTarget = tankTarget
				ai.Target.AutoAttacks.EnableAutoSwing(sim)
				ai.Target.AutoAttacks.RandomizeMeleeTiming(sim)
				tankTarget.PseudoStats.InFrontOfTarget = true
			}
		},
	})
}

func (ai *ShaAI) registerSubmerge() {
	// These casts don't do anything in the sim model, they're just modeled
	// in order to introduce gaps in the damage profile and Thrash sequence
	// like what happens in-game.
	ai.Emerge = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 120458},
		ProcMask: core.ProcMaskEmpty,
		Flags:    core.SpellFlagAPL,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.BossGCD * 3,
				CastTime: time.Second * 4,
			},

			IgnoreHaste: true,
		},

		ApplyEffects: func(sim *core.Simulation, tankTarget *core.Unit, _ *core.Spell) {
			if tankTarget == ai.Target.CurrentTarget {
				ai.Target.AutoAttacks.EnableAutoSwing(sim)
				ai.Target.AutoAttacks.RandomizeMeleeTiming(sim)
			}
		},
	})

	ai.Submerge = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID: core.ActionID{SpellID: 120455},
		ProcMask: core.ProcMaskEmpty,
		Flags:    core.SpellFlagAPL,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.BossGCD,
				CastTime: time.Second * 2,
			},

			IgnoreHaste: true,

			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Second * 55,
			},

			ModifyCast: func(sim *core.Simulation, spell *core.Spell, _ *core.Cast) {
				ai.Target.AutoAttacks.CancelAutoSwing(sim)
			},
		},

		ApplyEffects: func(sim *core.Simulation, tankTarget *core.Unit, _ *core.Spell) {
			ai.Emerge.Cast(sim, tankTarget)
		},
	})
}

func (ai *ShaAI) Reset(sim *core.Simulation) {
	ai.Target.Enable(sim)
	if ai.TankUnit != nil {
		ai.TankSwapSpell.CD.Use(sim)
	}
	ai.Submerge.CD.Set(core.DurationFromSeconds(sim.RandomFloat("Submerge Timing") * ai.Submerge.CD.Duration.Seconds()))
}

func (ai *ShaAI) ExecuteCustomRotation(sim *core.Simulation) {
	if (ai.TankUnit == nil) || (ai.Target.Hardcast.Expires >= sim.CurrentTime) {
		return
	}

	if ai.Submerge.IsReady(sim) && sim.Proc(0.75, "Submerge Timing") {
		ai.Submerge.Cast(sim, ai.TankUnit)
	} else if ai.TankSwapSpell.IsReady(sim) {
		ai.TankSwapSpell.Cast(sim, ai.TankUnit)
	} else {
		ai.Target.ExtendGCDUntil(sim, sim.CurrentTime+core.BossGCD)
	}
}
