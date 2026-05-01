package encounters

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/encounters/hof"
	"github.com/wowsims/mop/sim/encounters/msv"
	"github.com/wowsims/mop/sim/encounters/soo"
	"github.com/wowsims/mop/sim/encounters/toes"
	"github.com/wowsims/mop/sim/encounters/tot"
)

func init() {
	AddDefaultPresetEncounter()
	addMovementAI()
	addDynamicAddsAI()
	msv.Register()
	hof.Register()
	toes.Register()
	tot.Register()
	soo.Register()
}

func AddSingleTargetBossEncounter(presetTarget *core.PresetTarget) {
	core.AddPresetTarget(presetTarget)
	core.AddPresetEncounter(presetTarget.Config.Name, []string{
		presetTarget.Path(),
	})
}

func AddDefaultPresetEncounter() {
	core.AddPresetTarget(&core.PresetTarget{
		PathPrefix: "Default",
		Config: &proto.Target{
			Id:        31146,
			Name:      "Raid Target",
			Level:     93,
			MobType:   proto.MobType_MobTypeMechanical,
			TankIndex: 0,

			Stats: stats.Stats{
				stats.Health:      120_016_403,
				stats.Armor:       24835,
				stats.AttackPower: 0,
			}.ToProtoArray(),

			SpellSchool:      proto.SpellSchool_SpellSchoolPhysical,
			SwingSpeed:       2,
			MinBaseDamage:    550000,
			DamageSpread:     0.4,
			SuppressDodge:    false,
			ParryHaste:       false,
			DualWield:        false,
			DualWieldPenalty: false,
			TargetInputs:     []*proto.TargetInput{},
		},
		AI: nil,
	})
	core.AddPresetEncounter("Raid Target", []string{
		"Default/Raid Target",
	})
}
