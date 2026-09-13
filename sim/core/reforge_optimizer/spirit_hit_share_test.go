//go:build with_db

package reforgeoptimizer

import (
	"testing"

	"github.com/wowsims/mop/sim"
	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/simsignals"
)

// The Spirit->hit share the LP model uses comes from each spec's own passive: the whole Spirit
// for Balance, Shadow and Elemental, half of it for Mistweaver and Holy Paladin, nothing for a
// spec without such a passive. The Human racial's Spirit multiplier must not leak into it.
func TestSpiritHitShare(t *testing.T) {
	sim.RegisterAll()

	cases := []struct {
		name     string
		class    proto.Class
		race     proto.Race
		spec     any
		expected float64
	}{
		{"Balance", proto.Class_ClassDruid, proto.Race_RaceTauren, &proto.Player_BalanceDruid{BalanceDruid: &proto.BalanceDruid{Options: &proto.BalanceDruid_Options{ClassOptions: &proto.DruidOptions{}}}}, 1},
		{"Shadow", proto.Class_ClassPriest, proto.Race_RaceHuman, &proto.Player_ShadowPriest{ShadowPriest: &proto.ShadowPriest{Options: &proto.ShadowPriest_Options{ClassOptions: &proto.PriestOptions{}}}}, 1},
		{"Elemental", proto.Class_ClassShaman, proto.Race_RaceDraenei, &proto.Player_ElementalShaman{ElementalShaman: &proto.ElementalShaman{Options: &proto.ElementalShaman_Options{ClassOptions: &proto.ShamanOptions{}}}}, 1},
		{"Mistweaver", proto.Class_ClassMonk, proto.Race_RaceAlliancePandaren, &proto.Player_MistweaverMonk{MistweaverMonk: &proto.MistweaverMonk{Options: &proto.MistweaverMonk_Options{ClassOptions: &proto.MonkOptions{}}}}, 0.5},
		{"HolyPaladin", proto.Class_ClassPaladin, proto.Race_RaceHuman, &proto.Player_HolyPaladin{HolyPaladin: &proto.HolyPaladin{Options: &proto.HolyPaladin_Options{ClassOptions: &proto.PaladinOptions{Seal: proto.PaladinSeal_Insight}}}}, 0.5},
		{"Arcane", proto.Class_ClassMage, proto.Race_RaceHuman, &proto.Player_ArcaneMage{ArcaneMage: &proto.ArcaneMage{Options: &proto.ArcaneMage_Options{ClassOptions: &proto.MageOptions{}}}}, 0},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			player := core.WithSpec(&proto.Player{
				Class:       c.class,
				Race:        c.race,
				Equipment:   &proto.EquipmentSpec{},
				Consumables: &proto.ConsumesSpec{},
			}, c.spec)
			request := &proto.ReforgeOptimizeRequest{
				Raid: &proto.Raid{Parties: []*proto.Party{{Players: []*proto.Player{player}}}},
			}
			optimizer, err := newReforgeOptimizer(request, simsignals.CreateSignals())
			if err != nil {
				t.Fatalf("newReforgeOptimizer: %v", err)
			}
			if got := optimizer.spiritHitShare; got != c.expected {
				t.Errorf("spiritHitShare %v, expected %v", got, c.expected)
			}
		})
	}
}
