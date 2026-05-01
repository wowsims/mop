package soo

import (
	"fmt"
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const ironJuggernautBossID int32 = 71466

type ironJuggernautDamageConfig struct {
	MinDamage float64
	MaxDamage float64
}

type ironJuggernautPresetConfig struct {
	RaidSize        int32
	IsHeroic        bool
	BossHealth      float64
	MeleeMinDamage  float64
	MeleeDamageSpan float64

	IgniteArmor  ironJuggernautDamageConfig
	LaserBurn    ironJuggernautDamageConfig
	LaserBurnDoT ironJuggernautDamageConfig
	FlameVents   ironJuggernautDamageConfig
}

func addIronJuggernaut(raidPrefix string) {
	createIronJuggernautPreset(raidPrefix, ironJuggernautPresetConfig{
		RaidSize:        25,
		IsHeroic:        true,
		BossHealth:      1_500_000_000,
		MeleeMinDamage:  823_479,
		MeleeDamageSpan: 1.128,
		IgniteArmor: ironJuggernautDamageConfig{
			MinDamage: 46_800,
			MaxDamage: 49_200,
		},
		LaserBurn: ironJuggernautDamageConfig{
			MinDamage: 341_249,
			MaxDamage: 358_750,
		},
		LaserBurnDoT: ironJuggernautDamageConfig{
			MinDamage: 53_625,
			MaxDamage: 56_375,
		},
		FlameVents: ironJuggernautDamageConfig{
			MinDamage: 585_000,
			MaxDamage: 615_000,
		},
	})

	createIronJuggernautPreset(raidPrefix, ironJuggernautPresetConfig{
		RaidSize:        10,
		IsHeroic:        true,
		BossHealth:      600_000_000,
		MeleeMinDamage:  582_961,
		MeleeDamageSpan: 0.749,
		IgniteArmor: ironJuggernautDamageConfig{
			MinDamage: 39_000,
			MaxDamage: 41_000,
		},
		LaserBurn: ironJuggernautDamageConfig{
			MinDamage: 341_249,
			MaxDamage: 358_750,
		},
		LaserBurnDoT: ironJuggernautDamageConfig{
			MinDamage: 73_124,
			MaxDamage: 76_875,
		},
		FlameVents: ironJuggernautDamageConfig{
			MinDamage: 390_000,
			MaxDamage: 410_000,
		},
	})
}

func ironJuggernautTargetInputs() []*proto.TargetInput {
	return []*proto.TargetInput{
		{
			Label:       "Ignite Armor tank swap stacks",
			Tooltip:     "Taunt swap when the current tank reaches this many Ignite Armor stacks. Set to 0 to disable simulated tank swaps.",
			InputType:   proto.InputType_Number,
			NumberValue: 5,
		},
		{
			Label:     "Swap back when Ignite Armor expires",
			Tooltip:   "Automatically swap back to the main tank when Ignite Armor expires on the main tank. If disabled, swap after stacks build up on the off-tank.",
			InputType: proto.InputType_Bool,
			BoolValue: true,
		},
	}
}

func createIronJuggernautPreset(raidPrefix string, config ironJuggernautPresetConfig) {
	bossName := fmt.Sprintf("Iron Juggernaut %d", config.RaidSize)

	if config.IsHeroic {
		bossName += " H"
	}

	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: raidPrefix,

		Config: &proto.Target{
			Id:              ironJuggernautBossID,
			Name:            bossName,
			Level:           93,
			MobType:         proto.MobType_MobTypeMechanical,
			TankIndex:       0,
			SecondTankIndex: 1,

			Stats: stats.Stats{
				stats.Health:      config.BossHealth,
				stats.Armor:       24835,
				stats.AttackPower: 0,
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    1.5,
			MinBaseDamage: config.MeleeMinDamage,
			DamageSpread:  config.MeleeDamageSpan,
			TargetInputs:  ironJuggernautTargetInputs(),
		},

		AI: makeIronJuggernautAI(config),
	})

	core.AddPresetEncounter(bossName+" - P1", []string{
		raidPrefix + "/" + bossName,
	})
}

func makeIronJuggernautAI(config ironJuggernautPresetConfig) core.AIFactory {
	return func() core.TargetAI {
		return &IronJuggernautAI{
			config: config,
		}
	}
}

type IronJuggernautAI struct {
	Target   *core.Target
	TankUnit *core.Unit
	OffTank  *core.Unit

	config ironJuggernautPresetConfig

	SwapAtStackCount       int32
	SwapBackOnDebuffExpire bool

	priorVengeanceEstimate int32

	targetSwapPendingAction *core.PendingAction
	fakeTauntPendingAction  *core.PendingAction

	IgniteArmor *core.Spell
	LaserBurn   *core.Spell
	FlameVents  *core.Spell

	VengeanceAura   *core.Aura
	IgniteArmorAura map[*core.Unit]*core.Aura
}

func (ai *IronJuggernautAI) Initialize(target *core.Target, config *proto.Target) {
	ai.Target = target
	ai.TankUnit = target.CurrentTarget
	ai.OffTank = target.SecondaryTarget
	ai.IgniteArmorAura = make(map[*core.Unit]*core.Aura)
	ai.SwapAtStackCount = int32(config.TargetInputs[0].NumberValue)
	ai.SwapBackOnDebuffExpire = config.TargetInputs[1].BoolValue
	ai.targetSwapPendingAction = &core.PendingAction{}
	ai.fakeTauntPendingAction = &core.PendingAction{}

	for _, tank := range ai.Target.Env.Raid.AllPlayerUnits {
		ai.registerIgniteArmorAura(tank)
	}

	ai.registerLaserBurn()
	ai.registerFlameVents()
}

func (ai *IronJuggernautAI) scheduleFakeTaunt(sim *core.Simulation) {
	fakeTauntDelay := time.Second*15 + core.DurationFromSeconds(sim.RandomFloat("Vengeance Taunt Timing")*5)

	ai.fakeTauntPendingAction.NextActionAt = sim.CurrentTime + fakeTauntDelay
	ai.fakeTauntPendingAction.Priority = core.ActionPriorityDOT
	ai.fakeTauntPendingAction.OnAction = func(sim *core.Simulation) {
		ai.applyFakeTauntVengeance(sim)

		if ai.Target.CurrentTarget != ai.TankUnit {
			ai.scheduleFakeTaunt(sim)
		}
	}

	sim.AddPendingAction(ai.fakeTauntPendingAction)
}

func (ai *IronJuggernautAI) applyFakeTauntVengeance(sim *core.Simulation) {
	if ai.Target.CurrentTarget == ai.TankUnit || ai.VengeanceAura == nil {
		return
	}

	minTauntVengeance := ai.priorVengeanceEstimate / 2

	if minTauntVengeance <= ai.VengeanceAura.GetStacks() {
		return
	}

	ai.VengeanceAura.Activate(sim)
	ai.VengeanceAura.SetStacks(sim, minTauntVengeance)
}

func (ai *IronJuggernautAI) swapTargets(sim *core.Simulation, newTankTarget *core.Unit) {
	if ai.Target.CurrentTarget == newTankTarget {
		return
	}

	oldtarget := ai.Target.CurrentTarget

	if oldtarget != nil {
		oldtarget.PseudoStats.InFrontOfTarget = false
		if ai.VengeanceAura != nil {
			ai.priorVengeanceEstimate = ai.VengeanceAura.GetStacks()
			if ai.SwapAtStackCount > 2 {
				ai.scheduleFakeTaunt(sim)
			}
		}
	}

	ai.Target.AutoAttacks.CancelAutoSwing(sim)
	ai.Target.CurrentTarget = newTankTarget

	if !ai.SwapBackOnDebuffExpire {
		ai.targetSwapPendingAction.NextActionAt = sim.CurrentTime + (ai.rollFlameVentsCD(sim) * time.Duration(ai.SwapAtStackCount))
		ai.targetSwapPendingAction.Priority = core.ActionPriorityDOT
		ai.targetSwapPendingAction.OnAction = func(sim *core.Simulation) {
			ai.swapTargets(sim, oldtarget)
		}

		sim.AddPendingAction(ai.targetSwapPendingAction)
	}

	if ai.Target.CurrentTarget == nil {
		return
	}

	ai.Target.AutoAttacks.EnableAutoSwing(sim)
	ai.Target.AutoAttacks.RandomizeMeleeTiming(sim)
	ai.Target.CurrentTarget.PseudoStats.InFrontOfTarget = true

	if ai.VengeanceAura != nil {
		minTauntVengeance := ai.priorVengeanceEstimate / 2
		if minTauntVengeance >= ai.VengeanceAura.GetStacks() {
			ai.VengeanceAura.Activate(sim)
			ai.VengeanceAura.SetStacks(sim, minTauntVengeance)
		}
	}
}

func (ai *IronJuggernautAI) rollFlameVentsCD(sim *core.Simulation) time.Duration {
	return ai.FlameVents.CD.Duration + core.DurationFromSeconds(sim.RandomFloat("Flame Vents Timing"))
}

func (ai *IronJuggernautAI) rollLaserBurnCD(sim *core.Simulation) time.Duration {
	if sim.Proc(0.75, "Short Laser Burn CD") {
		return core.DurationFromSeconds(6 + sim.RandomFloat("Laser Burn Timing")*2)
	}
	return core.DurationFromSeconds(8.5 + sim.RandomFloat("Laser Burn Timing")*10)
}

func (ai *IronJuggernautAI) registerLaserBurn() {
	spellConfig := ai.config.LaserBurn
	dotConfig := ai.config.LaserBurnDoT
	// Rounded average of WCL Heroic logs observed
	// per-player instant-hit rates across 10m and 25m.
	procChance := 0.077

	ai.LaserBurn = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 144459},
		SpellSchool: core.SpellSchoolFire,
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

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Laser Burn",
			},
			NumberOfTicks: 8,
			TickLength:    time.Second * 2,
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				damageRoll := sim.RollWithLabel(dotConfig.MinDamage, dotConfig.MaxDamage, "Laser Burn DoT Damage")
				dot.Snapshot(target, damageRoll)
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeTick)
			},
		},

		ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
			for _, aoeTarget := range sim.Environment.Raid.AllPlayerUnits {
				if sim.Proc(procChance, "Laser Burn Proc") {
					damageRoll := sim.RollWithLabel(spellConfig.MinDamage, spellConfig.MaxDamage, "Laser Burn Damage")
					spell.CalcAndDealDamage(sim, aoeTarget, damageRoll, spell.OutcomeAlwaysHit)
					spell.Dot(aoeTarget).Apply(sim)
				}
			}

			spell.CD.Set(sim.CurrentTime + ai.rollLaserBurnCD(sim))
		},
	})

	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.LaserBurn.CD.Set(sim.CurrentTime + ai.rollLaserBurnCD(sim))
	})
}

func (ai *IronJuggernautAI) registerFlameVents() {
	spellConfig := ai.config.FlameVents

	ai.FlameVents = ai.Target.RegisterSpell(core.SpellConfig{
		ActionID:         core.ActionID{SpellID: 144464},
		SpellSchool:      core.SpellSchoolFire,
		ProcMask:         core.ProcMaskSpellDamage,
		Flags:            core.SpellFlagAPL,
		DamageMultiplier: 1,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: core.BossGCD,
			},
			IgnoreHaste: true,
			CD: core.Cooldown{
				Timer:    ai.Target.NewTimer(),
				Duration: time.Millisecond * 9500,
			},
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			damageRoll := sim.RollWithLabel(spellConfig.MinDamage, spellConfig.MaxDamage, "Flame Vents Damage")
			spell.CalcAndDealDamage(sim, target, damageRoll, spell.OutcomeAlwaysHit)

			igniteArmorAura := ai.IgniteArmorAura[target]
			igniteArmorAura.Activate(sim)
			igniteArmorAura.AddStack(sim)
			spell.CD.Set(sim.CurrentTime + ai.rollFlameVentsCD(sim))
		},
	})

	ai.Target.RegisterResetEffect(func(sim *core.Simulation) {
		ai.FlameVents.CD.Set(sim.CurrentTime + ai.rollFlameVentsCD(sim))
	})
}

func (ai *IronJuggernautAI) registerIgniteArmorAura(target *core.Unit) {
	const ignitePeriod = time.Second
	const igniteDuration = time.Second * 30

	spellConfig := ai.config.IgniteArmor

	ai.IgniteArmor = ai.Target.GetOrRegisterSpell(core.SpellConfig{
		ActionID:    core.ActionID{SpellID: 144467}.WithTag(1),
		SpellSchool: core.SpellSchoolFire,
		ProcMask:    core.ProcMaskSpellDamage,
		Flags:       core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell,

		DamageMultiplier: 1,
		ThreatMultiplier: 1,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label: "Ignite Armor (DoT)",
			},
			NumberOfTicks: 30,
			TickLength:    ignitePeriod,

			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				damageRoll := sim.RollWithLabel(spellConfig.MinDamage, spellConfig.MaxDamage, "Ignite Armor Damage") * float64(ai.IgniteArmorAura[target].GetStacks()) // Damage is increased by 10% per stack, but we handle that with a multiplier on the aura instead of modifying the damage roll.
				dot.Snapshot(target, damageRoll)
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
				dot.CalcAndDealPeriodicSnapshotDamage(sim, target, dot.OutcomeTick)
			},
		},

		ApplyEffects: func(sim *core.Simulation, tankTarget *core.Unit, spell *core.Spell) {
			ai.IgniteArmor.Dot(target).Apply(sim)
		},
	})

	ai.IgniteArmorAura[target] = target.GetOrRegisterAura(core.Aura{
		Label:     "Ignite Armor",
		ActionID:  core.ActionID{SpellID: 144467},
		Duration:  igniteDuration,
		MaxStacks: math.MaxInt32,

		OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks int32, newStacks int32) {
			if newStacks != 0 {
				ai.IgniteArmor.Cast(sim, target)
			}

			aura.Unit.PseudoStats.SchoolDamageTakenMultiplier[stats.SchoolIndexFire] *= (1.0 + 0.1*float64(newStacks)) / (1.0 + 0.1*float64(oldStacks))
			if ai.SwapAtStackCount != 0 && (newStacks >= ai.SwapAtStackCount) {
				pa := sim.GetConsumedPendingActionFromPool()
				pa.NextActionAt = sim.CurrentTime + core.DurationFromSeconds(ai.FlameVents.TimeToReady(sim).Seconds()*0.5)
				pa.Priority = core.ActionPriorityDOT
				pa.OnAction = func(sim *core.Simulation) {
					ai.swapTargets(sim, ai.OffTank)
				}
				sim.AddPendingAction(pa)
			}
		},

		OnExpire: func(aura *core.Aura, sim *core.Simulation) {
			// If "swap on Ignite Armor expired" is enabled schedule a swap back
			if ai.SwapBackOnDebuffExpire {
				ai.swapTargets(sim, ai.TankUnit)
			}
		},
	})
}

func (ai *IronJuggernautAI) Reset(sim *core.Simulation) {
	ai.Target.CurrentTarget = ai.TankUnit
	ai.Target.Enable(sim)
	ai.Target.AutoAttacks.EnableAutoSwing(sim)
	ai.Target.AutoAttacks.RandomizeMeleeTiming(sim)
	ai.TankUnit.PseudoStats.InFrontOfTarget = true

	ai.fakeTauntPendingAction.Cancel(sim)
	ai.targetSwapPendingAction.Cancel(sim)

	ai.VengeanceAura = ai.TankUnit.GetAura("Vengeance")
	ai.priorVengeanceEstimate = 0
}

func (ai *IronJuggernautAI) ExecuteCustomRotation(sim *core.Simulation) {
	target := ai.Target.CurrentTarget

	if ai.LaserBurn.IsReady(sim) {
		ai.LaserBurn.Cast(sim, ai.TankUnit)
	} else if target != nil && ai.FlameVents.IsReady(sim) {
		ai.FlameVents.Cast(sim, target)
	}

	ai.Target.ExtendGCDUntil(sim, sim.CurrentTime+core.BossGCD)
}
