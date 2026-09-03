package restoration

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/shaman"
)

func RegisterRestorationShaman() {
	core.RegisterAgentFactory(
		proto.Player_RestorationShaman{},
		proto.Spec_SpecRestorationShaman,
		func(character *core.Character, options *proto.Player) core.Agent {
			return NewRestorationShaman(character, options)
		},
		func(player *proto.Player, spec interface{}) {
			playerSpec, ok := spec.(*proto.Player_RestorationShaman)
			if !ok {
				panic("Invalid spec value for Restoration Shaman!")
			}
			player.Spec = playerSpec
		},
	)
}

func NewRestorationShaman(character *core.Character, options *proto.Player) *RestorationShaman {
	restoOptions := options.GetRestorationShaman().Options

	selfBuffs := shaman.SelfBuffs{
		Shield: restoOptions.ClassOptions.Shield,
	}

	resto := &RestorationShaman{
		Shaman: shaman.NewShaman(character, options.TalentsString, selfBuffs, false, restoOptions.ClassOptions.FeleAutocast),
	}

	return resto
}

type RestorationShaman struct {
	*shaman.Shaman
}

func (resto *RestorationShaman) GetShaman() *shaman.Shaman {
	return resto.Shaman
}

func (resto *RestorationShaman) Reset(sim *core.Simulation) {
	resto.Shaman.Reset(sim)
}

func (resto *RestorationShaman) Initialize() {
	resto.Shaman.Initialize()
	resto.Shaman.RegisterHealingSpells()
	resto.registerPassives()
}

func (resto *RestorationShaman) ApplyTalents() {
	resto.Shaman.ApplyTalents()
	resto.ApplyArmorSpecializationEffect(stats.Intellect, proto.ArmorType_ArmorTypeMail, 86529)
}

// Stat-affecting Restoration passives. Healing spells are not implemented;
// this spec is a gear planner only.
func (resto *RestorationShaman) registerPassives() {
	// Spiritual Insight (112858): increases mana pool by 400%.
	resto.MultiplyStat(stats.Mana, 5)

	// Meditation (95862): 50% of mana regeneration from Spirit continues in combat.
	resto.PseudoStats.SpiritRegenRateCombat = 0.5
}
