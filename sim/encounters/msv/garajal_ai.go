package msv

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const garajalMeleeDamageSpread = 0.4846
const garajalBossID int32 = 60143
const garajalAddID int32 = 66992

func addGarajal(raidPrefix string) {
	createGarajalHeroicPreset(raidPrefix, 25, 542_990_565, 337_865, 758_866)
}

func createGarajalHeroicPreset(raidPrefix string, raidSize int32, bossHealth float64, bossMinBaseDamage float64, addHealth float64) {
	bossName := fmt.Sprintf("Gara'jal the Spiritbinder %d H", raidSize)
	addName := fmt.Sprintf("Severer of Souls %d H", raidSize)

	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: raidPrefix,

		Config: &proto.Target{
			Id:        garajalBossID,
			Name:      bossName,
			Level:     93,
			MobType:   proto.MobType_MobTypeHumanoid,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      bossHealth,
				stats.Armor:       24835,
				stats.AttackPower: 0, // actual value doesn't matter in Cata/MoP, as long as damage parameters are fit consistently
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    1.5,
			MinBaseDamage: bossMinBaseDamage,
			DamageSpread:  garajalMeleeDamageSpread,
			TargetInputs:  garajalTargetInputs(),
		},

		AI: makeGarajalAI(raidSize, true),
	})

	targetPathNames := []string{raidPrefix + "/" + bossName}

	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: raidPrefix,

		Config: &proto.Target{
			Id:      garajalAddID,
			Name:    addName,
			Level:   92,
			MobType: proto.MobType_MobTypeDemon,

			Stats: stats.Stats{
				stats.Health: addHealth,
				stats.Armor:  24835, // TODO: verify add armor
			}.ToProtoArray(),

			TargetInputs:    []*proto.TargetInput{},
			DisabledAtStart: true,
		},

		AI: makeGarajalAI(raidSize, false),
	})

	targetPathNames = append(targetPathNames, raidPrefix + "/" + addName)
	core.AddPresetEncounter(bossName, targetPathNames)
}

func garajalTargetInputs() []*proto.TargetInput {
	return []*proto.TargetInput{
		{
			Label:       "Frenzy time",
			Tooltip:     "Simulation time (in seconds) at which to disable tank swaps and enable the boss Frenzy buff",
			InputType:   proto.InputType_Number,
			NumberValue: 256,
		},
	}
}

func makeGarajalAI(raidSize int32, isBoss bool) core.AIFactory {
	return func() core.TargetAI {
		return &GarajalAI{
			raidSize: raidSize,
			isBoss:   isBoss,
		}
	}
}

type GarajalAI struct {
	// Unit references
	Target   *core.Target
	BossUnit *core.Unit
	AddUnits []*core.Unit
	TankUnit *core.Unit

	// Static parameters associated with a given preset
	raidSize int32
	isBoss   bool

	// Dynamic parameters taken from user inputs
	enableFrenzyAt time.Duration

	// Spell + aura references
	SharedShadowyAttackTimer *core.Timer
	ShadowyAttackSpells      []*core.Spell
	BanishmentAura           *core.Aura
	VoodooDollsAura          *core.Aura
	ShadowBolt               *core.Spell
	FrenzyAura               *core.Aura
}

func (ai *GarajalAI) Initialize(target *core.Target, config *proto.Target) {
	// Save unit references
	ai.Target = target
	ai.BossUnit = target.Env.Encounter.AllTargetUnits[0]
	ai.AddUnits = target.Env.Encounter.AllTargetUnits[1:]
	ai.TankUnit = ai.BossUnit.CurrentTarget

	// Save user input parameters
	if ai.isBoss {
		ai.enableFrenzyAt = core.DurationFromSeconds(config.TargetInputs[0].NumberValue)
	}

	// Register relevant spells and auras
	ai.registerShadowyAttacks()
	ai.registerTankSwapAuras()
	ai.registerShadowBolt()
	ai.registerFrenzy()
}

func (ai *GarajalAI) registerShadowyAttacks() {
	if !ai.isBoss {
		return
	}

	ai.ShadowyAttackSpells = make([]*core.Spell, 4)
	spellIDs := []int32{117218, 117219, 117215, 117222}

	const shadowAttackCastTime = time.Second * 2

	for idx, spellID := range spellIDs {
		ai.ShadowyAttackSpells[idx] = ai.BossUnit.RegisterSpell(core.SpellConfig{
			ActionID:         core.ActionID{SpellID: spellID},
			SpellSchool:      core.SpellSchoolShadow,
			ProcMask:         core.ProcMaskSpellDamage,
			Flags:            core.SpellFlagMeleeMetrics,
			DamageMultiplier: 0.7,

			Cast: core.CastConfig{
				DefaultCast: core.Cast{
					GCD:      shadowAttackCastTime,
					CastTime: shadowAttackCastTime,
				},

				SharedCD: core.Cooldown{
					Timer:    ai.BossUnit.GetOrInitTimer(&ai.SharedShadowyAttackTimer),
					Duration: time.Second * 6,
				},

				ModifyCast: func(sim *core.Simulation, spell *core.Spell, curCast *core.Cast) {
					hastedCastTime := spell.Unit.ApplyCastSpeedForSpell(curCast.CastTime, spell).Round(time.Millisecond)
					spell.Unit.AutoAttacks.StopMeleeUntil(sim, sim.CurrentTime+hastedCastTime)
				},
			},

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				baseDamage := spell.Unit.AutoAttacks.MH().EnemyWeaponDamage(sim, spell.MeleeAttackPower(), garajalMeleeDamageSpread)
				spell.CalcAndDealDamage(sim, target, baseDamage, spell.OutcomeEnemyMeleeWhite)
			},
		})
	}
}

func (ai *GarajalAI) registerTankSwapAuras() {
	if !ai.isBoss || (ai.TankUnit == nil) {
		return
	}

	const voodooDollsDuration = time.Second * 71
	const banishmentDuration = time.Second * 30

	ai.BanishmentAura = ai.TankUnit.RegisterAura(core.Aura{
		Label:    "Banishment",
		ActionID: core.ActionID{SpellID: 116272},
		Duration: banishmentDuration,

		OnGain: func(_ *core.Aura, sim *core.Simulation) {
			for _, addUnit := range ai.AddUnits {
				sim.EnableTargetUnit(addUnit)
			}

			sim.DisableTargetUnit(ai.BossUnit, false)
			ai.TankUnit.CurrentTarget = ai.AddUnits[0]
		},

		OnExpire: func(_ *core.Aura, sim *core.Simulation) {
			sim.EnableTargetUnit(ai.BossUnit)

			for _, addUnit := range ai.AddUnits {
				sim.DisableTargetUnit(addUnit, true)
			}

			ai.BossUnit.AutoAttacks.CancelAutoSwing(sim)
		},
	})

	var priorVengeanceEstimate int32

	ai.VoodooDollsAura = ai.TankUnit.RegisterAura(core.Aura{
		Label:    "Voodoo Dolls",
		ActionID: core.ActionID{SpellID: 116000},
		Duration: voodooDollsDuration,

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			sim.EnableTargetUnit(ai.BossUnit)
			ai.SharedShadowyAttackTimer.Set(sim.CurrentTime + core.DurationFromSeconds(8.0*sim.RandomFloat("Shadowy Attack Timing")))
			ai.syncBossGCDToSwing(sim)

			if sim.CurrentTime+voodooDollsDuration > ai.enableFrenzyAt {
				core.StartPeriodicAction(sim, core.PeriodicActionOptions{
					Period:   voodooDollsDuration - 1,
					Priority: core.ActionPriorityDOT,

					OnAction: func(sim *core.Simulation) {
						aura.Refresh(sim)
					},
				})
			}

			// Model the Vengeance gain from a taunt
			vengeanceAura := aura.Unit.GetAura("Vengeance")

			if (vengeanceAura == nil) || (sim.CurrentTime == 0) {
				return
			}

			vengeanceAura.Activate(sim)
			vengeanceAura.SetStacks(sim, priorVengeanceEstimate/2)
		},

		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			ai.BanishmentAura.Activate(sim)

			// Store the final Vengeance value for the next swap
			vengeanceAura := aura.Unit.GetAura("Vengeance")

			if vengeanceAura == nil {
				return
			}

			priorVengeanceEstimate = vengeanceAura.GetStacks()
		},

		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			priorVengeanceEstimate = 0
			aura.Activate(sim)
			activationPeriod := voodooDollsDuration * 2
			numActivations := ai.enableFrenzyAt / activationPeriod

			if numActivations > 0 {
				core.StartPeriodicAction(sim, core.PeriodicActionOptions{
					Period:   activationPeriod,
					NumTicks: int(numActivations),
					Priority: core.ActionPriorityDOT,

					OnAction: func(sim *core.Simulation) {
						aura.Activate(sim)
					},
				})
			}

			finalActivation := activationPeriod * numActivations

			if finalActivation+voodooDollsDuration <= ai.enableFrenzyAt {
				core.StartDelayedAction(sim, core.DelayedActionOptions{
					DoAt:     ai.enableFrenzyAt - 1,
					Priority: core.ActionPriorityDOT,

					OnAction: func(sim *core.Simulation) {
						if ai.BanishmentAura.IsActive() {
							ai.BanishmentAura.Deactivate(sim)
						}

						aura.Activate(sim)
					},
				})
			}
		},
	})
}

func (ai *GarajalAI) syncBossGCDToSwing(sim *core.Simulation) {
	ai.BossUnit.ExtendGCDUntil(sim, ai.BossUnit.AutoAttacks.NextAttackAt()+core.DurationFromSeconds(0.2*sim.RandomFloat("Specials Timing")))
}

func (ai *GarajalAI) registerShadowBolt() {
	// These are actually cast by the Shadowy Minions, but we have the tank
	// adds cast them in the sim model for simplicity. The details of the
	// damage profile don't really matter here, as these casts are really
	// just used to decay the tank's Vengeance at a reasonable rate while
	// downstairs.
	if ai.isBoss {
		return
	}

	// 0 - 10H, 1 - 25H
	scalingIndex := core.TernaryInt(ai.raidSize == 10, 0, 1)

	// https://wago.tools/db2/SpellEffect?build=5.5.0.61767&filter%5BSpellID%5D=122118&page=1
	shadowBoltBase := []float64{22200, 24050}[scalingIndex]
	shadowBoltVariance := []float64{3600, 3900}[scalingIndex]

	ai.ShadowBolt = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:         core.ActionID{SpellID: 122118},
		SpellSchool:      core.SpellSchoolShadow,
		ProcMask:         core.ProcMaskSpellDamage,
		DamageMultiplier: 1,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD:      core.BossGCD * 5,
				CastTime: time.Second * 3,
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			damageRoll := shadowBoltBase + shadowBoltVariance*sim.RandomFloat("Shadow Bolt Damage")
			spell.CalcAndDealDamage(sim, target, damageRoll, spell.OutcomeAlwaysHit)
		},
	})
}

func (ai *GarajalAI) registerFrenzy() {
	if !ai.isBoss {
		return
	}

	ai.FrenzyAura = ai.BossUnit.RegisterAura(core.Aura{
		Label:    "Frenzy",
		ActionID: core.ActionID{SpellID: 117752},
		Duration: core.NeverExpires,

		OnGain: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.PseudoStats.DamageDealtMultiplier *= 1.25
			aura.Unit.MultiplyAttackSpeed(sim, 1.5)
			aura.Unit.MultiplyCastSpeed(sim, 1.5)
		},

		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			aura.Unit.PseudoStats.DamageDealtMultiplier /= 1.25
			aura.Unit.MultiplyAttackSpeed(sim, 1.0/1.5)
			aura.Unit.MultiplyCastSpeed(sim, 1.0/1.5)
		},

		OnReset: func(aura *core.Aura, sim *core.Simulation) {
			core.StartDelayedAction(sim, core.DelayedActionOptions{
				DoAt:     ai.enableFrenzyAt,
				Priority: core.ActionPriorityDOT,

				OnAction: func(sim *core.Simulation) {
					aura.Activate(sim)
				},
			})
		},
	})
}

func (ai *GarajalAI) Reset(sim *core.Simulation) {}

func (ai *GarajalAI) ExecuteCustomRotation(sim *core.Simulation) {
	if ai.TankUnit == nil {
		return
	}

	if !ai.isBoss {
		ai.ShadowBolt.Cast(sim, ai.TankUnit)
		return
	}

	if ai.VoodooDollsAura.IsActive() && ai.SharedShadowyAttackTimer.IsReady(sim) {
		ai.ShadowyAttackSpells[int(4.0*sim.RandomFloat("Shadowy Attack Selection"))].Cast(sim, ai.TankUnit)
	}

	if ai.VoodooDollsAura.IsActive() {
		ai.syncBossGCDToSwing(sim)
	}
}
