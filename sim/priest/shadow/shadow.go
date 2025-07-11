package shadow

import (
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/priest"
)

func RegisterShadowPriest() {
	core.RegisterAgentFactory(
		proto.Player_ShadowPriest{},
		proto.Spec_SpecShadowPriest,
		func(character *core.Character, options *proto.Player) core.Agent {
			return NewShadowPriest(character, options)
		},
		func(player *proto.Player, spec interface{}) {
			playerSpec, ok := spec.(*proto.Player_ShadowPriest)
			if !ok {
				panic("Invalid spec value for Shadow Priest!")
			}
			player.Spec = playerSpec
		},
	)
}

const MaxShadowOrbs = 3

func NewShadowPriest(character *core.Character, options *proto.Player) *ShadowPriest {
	shadowOptions := options.GetShadowPriest()

	selfBuffs := priest.SelfBuffs{
		UseShadowfiend: true,
		UseInnerFire:   shadowOptions.Options.ClassOptions.Armor == proto.PriestOptions_InnerFire,
	}

	basePriest := priest.New(character, selfBuffs, options.TalentsString)
	basePriest.Latency = float64(basePriest.ChannelClipDelay.Milliseconds())
	spriest := &ShadowPriest{
		Priest:  basePriest,
		options: shadowOptions.Options,
	}

	spriest.ShadowOrbs = spriest.NewDefaultSecondaryResourceBar(core.SecondaryResourceConfig{
		Type:    proto.SecondaryResourceType_SecondaryResourceTypeShadowOrbs,
		Default: MaxShadowOrbs, // We now generate 1 orb every 6 seconds out of combat, so should pretty much start with 3 always
		Max:     MaxShadowOrbs,
	})
	spriest.RegisterSecondaryResourceBar(spriest.ShadowOrbs)
	return spriest
}

type ShadowPriest struct {
	*priest.Priest
	options      *proto.ShadowPriest_Options
	ShadowOrbs   core.SecondaryResourceBar
	orbsConsumed int32 // Number of orbs consumed by the last devouring plague cast

	// Shadow Spells
	DevouringPlague *core.Spell
	MindSpike       *core.Spell
	MindBlast       *core.Spell
	SurgeOfDarkness *core.Aura // Required for dummy effect
}

func (spriest *ShadowPriest) GetPriest() *priest.Priest {
	return spriest.Priest
}

func (spriest *ShadowPriest) Initialize() {
	spriest.Priest.Initialize()

	spriest.AddStat(stats.HitRating, -spriest.GetBaseStats()[stats.Spirit])
	spriest.AddStatDependency(stats.Spirit, stats.HitRating, 1)
	spriest.registerMindBlastSpell()
	spriest.registerDevouringPlagueSpell()
	spriest.registerMindSpike()
	spriest.registerShadowWordDeathSpell()
	spriest.registerMindFlaySpell()
	spriest.registerShadowyRecall() // Mastery
	spriest.registerShadowyApparition()
}

func (spriest *ShadowPriest) Reset(sim *core.Simulation) {
	spriest.Priest.Reset(sim)
}

func (spriest *ShadowPriest) OnEncounterStart(sim *core.Simulation) {
	spriest.ShadowOrbs.ResetBarTo(sim, MaxShadowOrbs)
	spriest.Priest.OnEncounterStart(sim)
}

func (spriest *ShadowPriest) ApplyTalents() {
	spriest.Priest.ApplyTalents()

	// apply shadow spec specific auras
	spriest.AddStaticMod(core.SpellModConfig{
		FloatValue: 0.3 + 0.05, // 2025-07-01 - Shadowform damage increase raised to 35% (was 30%)
		School:     core.SpellSchoolShadow,
		Kind:       core.SpellMod_DamageDone_Pct,
	})

	core.MakePermanent(spriest.RegisterAura(core.Aura{
		Label: "Shadowform",
		ActionID: core.ActionID{
			SpellID: 15473,
		},
	}))

	core.MakePermanent(core.MindQuickeningAura(&spriest.Unit))

	spriest.registerTwistOfFate()
	spriest.registerSolaceAndInstanity()
	spriest.registerSurgeOfDarkness()
	spriest.registerDivineInsight()
	spriest.registerHalo()
	spriest.registerCascade()
	spriest.registerDivineStar()
}
