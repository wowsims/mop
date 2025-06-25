package encounters

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

const (
	dynamicBossID int32 = 99999
	dynamicAddID  int32 = 99998
)

func addDynamicAddsAI() {
	createDynamicAddsAIPreset()
}

func createDynamicAddsAIPreset() {
	bossName := "Dynamic Boss 25"
	addName := "Dynamic Add 25"

	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: "Default",

		Config: &proto.Target{
			Id:        dynamicBossID,
			Name:      bossName,
			Level:     93,
			MobType:   proto.MobType_MobTypeMechanical,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Armor:       24835,
				stats.AttackPower: 0,
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    2.0,
			MinBaseDamage: 50000,
			DamageSpread:  0.1,
			TargetInputs:  dynamicAddsTargetInputs(),
		},

		AI: makeDynamicAddsAI(true),
	})

	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: "Default",

		Config: &proto.Target{
			Id:        dynamicAddID,
			Name:      addName,
			Level:     93,
			MobType:   proto.MobType_MobTypeMechanical,
			TankIndex: 1,

			Stats: stats.Stats{
				stats.Armor:       24835,
				stats.AttackPower: 0,
			}.ToProtoArray(),

			SpellSchool:   proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:    1.5,
			MinBaseDamage: 25000,
			DamageSpread:  0.2,
			TargetInputs:  []*proto.TargetInput{},
		},

		AI: makeDynamicAddsAI(false),
	})

	core.AddPresetEncounter(bossName+" Dynamic", []string{
		"Default/" + bossName,
		"Default/" + addName,
	})
}

func dynamicAddsTargetInputs() []*proto.TargetInput {
	return []*proto.TargetInput{
		{
			Label:       "Add spawn interval",
			Tooltip:     "Time between add spawns (in seconds)",
			InputType:   proto.InputType_Number,
			NumberValue: 30,
		},
		{
			Label:       "Add lifetime",
			Tooltip:     "How long adds stay alive (in seconds)",
			InputType:   proto.InputType_Number,
			NumberValue: 20,
		},
		{
			Label:       "Add spawn delay",
			Tooltip:     "Initial delay before first add spawns (in seconds)",
			InputType:   proto.InputType_Number,
			NumberValue: 10,
		},
	}
}

func makeDynamicAddsAI(isBoss bool) core.AIFactory {
	return func() core.TargetAI {
		return &DynamicAddsAI{
			isBoss: isBoss,
		}
	}
}

type DynamicAddsAI struct {
	Target     *core.Target
	BossUnit   *core.Unit
	AddTargets []*core.Target
	MainTank   *core.Unit
	OffTank    *core.Unit
	ValidTanks []*core.Unit

	isBoss bool

	spawnInterval time.Duration
	addLifetime   time.Duration
	spawnDelay    time.Duration

	activeAdds    map[*core.Target]bool
	nextSpawnTime time.Duration
}

func (ai *DynamicAddsAI) Initialize(target *core.Target, config *proto.Target) {
	ai.Target = target
	ai.Target.AutoAttacks.MHConfig().ActionID.Tag = core.TernaryInt32(ai.isBoss, dynamicBossID, dynamicAddID)

	if ai.isBoss {
		ai.BossUnit = &target.Unit
		for _, encounterTarget := range target.Env.Encounter.Targets {
			if encounterTarget != target {
				ai.AddTargets = append(ai.AddTargets, encounterTarget)
			}
		}
	} else {
		for _, encounterTarget := range target.Env.Encounter.Targets {
			if encounterTarget.AI != nil {
				if bossAI, ok := encounterTarget.AI.(*DynamicAddsAI); ok && bossAI.isBoss {
					ai.BossUnit = &encounterTarget.Unit
					break
				}
			}
		}
	}

	if ai.BossUnit != nil {
		ai.MainTank = ai.BossUnit.CurrentTarget
	}
	if len(ai.AddTargets) > 0 {
		ai.OffTank = ai.AddTargets[0].CurrentTarget
	}

	ai.ValidTanks = core.FilterSlice([]*core.Unit{ai.MainTank, ai.OffTank}, func(unit *core.Unit) bool {
		return unit != nil
	})

	if ai.isBoss && len(config.TargetInputs) >= 3 {
		ai.spawnInterval = core.DurationFromSeconds(config.TargetInputs[0].NumberValue)
		ai.addLifetime = core.DurationFromSeconds(config.TargetInputs[1].NumberValue)
		ai.spawnDelay = core.DurationFromSeconds(config.TargetInputs[2].NumberValue)
	}

	ai.activeAdds = make(map[*core.Target]bool)
}

func (ai *DynamicAddsAI) Reset(sim *core.Simulation) {
	ai.Target.ExtendGCDUntil(sim, core.DurationFromSeconds(sim.RandomFloat("Specials Timing")*core.BossGCD.Seconds()))
	ai.Target.AutoAttacks.RandomizeMeleeTiming(sim)

	if !ai.isBoss {
		return
	}

	ai.activeAdds = make(map[*core.Target]bool)
	ai.nextSpawnTime = ai.spawnDelay

	for _, addTarget := range ai.AddTargets {
		addTarget.Disable(sim)
	}

	if ai.spawnDelay > 0 {
		core.StartDelayedAction(sim, core.DelayedActionOptions{
			DoAt:     ai.spawnDelay,
			Priority: core.ActionPriorityDOT,
			OnAction: func(sim *core.Simulation) {
				ai.spawnAdd(sim)
			},
		})
	} else {
		ai.spawnAdd(sim)
	}
}

func (ai *DynamicAddsAI) spawnAdd(sim *core.Simulation) {
	var addTarget *core.Target
	for _, target := range ai.AddTargets {
		if !ai.activeAdds[target] {
			addTarget = target
			break
		}
	}

	if addTarget == nil {
		ai.nextSpawnTime += ai.spawnInterval
		core.StartDelayedAction(sim, core.DelayedActionOptions{
			DoAt:     ai.nextSpawnTime,
			Priority: core.ActionPriorityDOT,
			OnAction: func(sim *core.Simulation) {
				ai.spawnAdd(sim)
			},
		})
		return
	}

	addTarget.Enable(sim)
	ai.activeAdds[addTarget] = true

	if sim.Log != nil {
		sim.Log("Spawned add (%s) at %s. Current Active adds: %d",
			addTarget.Label, sim.CurrentTime, len(ai.activeAdds))
	}

	core.StartDelayedAction(sim, core.DelayedActionOptions{
		DoAt:     sim.CurrentTime + ai.addLifetime,
		Priority: core.ActionPriorityDOT,
		OnAction: func(sim *core.Simulation) {
			ai.despawnAdd(sim, addTarget)
		},
	})

	ai.nextSpawnTime += ai.spawnInterval
	core.StartDelayedAction(sim, core.DelayedActionOptions{
		DoAt:     ai.nextSpawnTime,
		Priority: core.ActionPriorityDOT,
		OnAction: func(sim *core.Simulation) {
			ai.spawnAdd(sim)
		},
	})
}

func (ai *DynamicAddsAI) despawnAdd(sim *core.Simulation, addTarget *core.Target) {
	addTarget.Disable(sim)
	delete(ai.activeAdds, addTarget)

	if sim.Log != nil {
		sim.Log("Despawned add %s at %s. Currently Active Adds: %d",
			addTarget.Label, sim.CurrentTime, len(ai.activeAdds))
	}
}

func (ai *DynamicAddsAI) ExecuteCustomRotation(sim *core.Simulation) {
	target := ai.Target.CurrentTarget
	if target == nil {
		target = &ai.Target.Env.Raid.Parties[0].Players[0].GetCharacter().Unit
	}

	ai.Target.ExtendGCDUntil(sim, sim.CurrentTime+core.BossGCD)
}
