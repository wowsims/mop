package restoration

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/druid"
)

func RegisterRestorationDruid() {
	core.RegisterAgentFactory(
		proto.Player_RestorationDruid{},
		proto.Spec_SpecRestorationDruid,
		func(character *core.Character, options *proto.Player) core.Agent {
			return NewRestorationDruid(character, options)
		},
		func(player *proto.Player, spec interface{}) {
			playerSpec, ok := spec.(*proto.Player_RestorationDruid)
			if !ok {
				panic("Invalid spec value for Restoration Druid!")
			}
			player.Spec = playerSpec
		},
	)
}

func NewRestorationDruid(character *core.Character, options *proto.Player) *RestorationDruid {
	restoOptions := options.GetRestorationDruid()
	selfBuffs := druid.SelfBuffs{}

	resto := &RestorationDruid{
		Druid: druid.New(character, druid.Tree, selfBuffs, options.TalentsString),
	}

	resto.SelfBuffs.InnervateTarget = &proto.UnitReference{}
	if restoOptions.Options.ClassOptions.InnervateTarget != nil {
		resto.SelfBuffs.InnervateTarget = restoOptions.Options.ClassOptions.InnervateTarget
	}

	return resto
}

type RestorationDruid struct {
	*druid.Druid
}

func (resto *RestorationDruid) GetDruid() *druid.Druid {
	return resto.Druid
}

func (resto *RestorationDruid) Initialize() {
	resto.Druid.Initialize()
	resto.registerPassives()
}

func (resto *RestorationDruid) ApplyTalents() {
	resto.Druid.ApplyTalents()
	resto.ApplyArmorSpecializationEffect(stats.Intellect, proto.ArmorType_ArmorTypeLeather, 86093)
}

// Stat-affecting Restoration passives. Healing spells are not implemented;
// this spec is a gear planner only.
func (resto *RestorationDruid) registerPassives() {
	// Natural Insight (112857): increases mana pool by 400%.
	core.MakePermanent(resto.RegisterAura(core.Aura{
		Label:      "Natural Insight" + resto.Label,
		ActionID:   core.ActionID{SpellID: 112857},
		BuildPhase: core.CharacterBuildPhaseTalents,
	})).AttachStatDependency(resto.NewDynamicMultiplyStat(stats.Mana, 5))

	// Meditation (85101): 50% of mana regeneration from Spirit continues in combat.
	core.MakePermanent(resto.RegisterAura(core.Aura{
		Label:      "Meditation" + resto.Label,
		ActionID:   core.ActionID{SpellID: 85101},
		BuildPhase: core.CharacterBuildPhaseTalents,
	})).AttachAdditivePseudoStatBuff(&resto.PseudoStats.SpiritRegenRateCombat, 0.5)

	// Restoration Hotfix Passive (137012): mana regeneration from Spirit in
	// combat increased by 5%, so Meditation keeps 55% instead of 50%.
	// https://www.wowhead.com/mop-classic/spell=137012/hotfix-passive
	core.MakePermanent(resto.RegisterAura(core.Aura{
		Label:      "Hotfix Passive" + resto.Label,
		ActionID:   core.ActionID{SpellID: 137012},
		BuildPhase: core.CharacterBuildPhaseTalents,
	})).AttachAdditivePseudoStatBuff(&resto.PseudoStats.SpiritRegenRateCombat, 0.05)
}

func (resto *RestorationDruid) Reset(sim *core.Simulation) {
	resto.Druid.Reset(sim)
}
