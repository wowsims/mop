package mistweaver

import (
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/stats"
	"github.com/wowsims/mop/sim/monk"
)

func (mw *MistweaverMonk) registerManaTea() {

	buffActionID := core.ActionID{SpellID: 115294}
	stackActionID := core.ActionID{SpellID: 123766}
	manaMetrics := mw.NewManaMetrics(buffActionID)
	manaPerTick := 0.0
	//numerOFTicks := 6

	mw.Monk.RegisterOnChiSpent(func(sim *core.Simulation, chiSpent int32) {
		accumulatedChi := mw.outstandingChi + chiSpent

		for accumulatedChi >= 4 {

			mw.AddBrewStacks(sim, 1)
			accumulatedChi -= 4
		}

		mw.outstandingChi = accumulatedChi

	})

	mw.ManaTeaStackAura = mw.RegisterAura(core.Aura{
		Label:     "Mana Tea Stacks" + mw.Label,
		ActionID:  stackActionID,
		Duration:  time.Hour,
		MaxStacks: 10,
	})

	mw.Monk.RegisterOnNewBrewStacks(func(sim *core.Simulation, stacksToAdd int32) {
		mw.ManaTeaStackAura.Activate(sim)

		procChance := mw.GetStat(stats.SpellCritPercent)

		if sim.Proc(math.Mod(procChance, 1), "Mana Tea") {
			stacksToAdd += 1
		}

		mw.ManaTeaStackAura.SetStacks(sim, mw.ManaTeaStackAura.GetStacks()+stacksToAdd)
	})

	mw.RegisterSpell(core.SpellConfig{
		ActionID:       buffActionID,
		Flags:          core.SpellFlagAPL | core.SpellFlagNoOnCastComplete | core.SpellFlagHelpful | core.SpellFlagChanneled,
		ClassSpellMask: monk.MonkSpellManaTea,

		Cast: core.CastConfig{
			DefaultCast: core.Cast{
				GCD: time.Millisecond * 1000,
			},
		},

		Hot: core.DotConfig{
			SelfOnly: true,
			Aura: core.Aura{
				Label:    "Mana Tea",
				Duration: 3 * time.Second, //Set at activation
			},
			NumberOfTicks:       6,
			TickLength:          500 * time.Millisecond,
			AffectedByCastSpeed: false, //?
			OnSnapshot: func(sim *core.Simulation, target *core.Unit, dot *core.Dot, isRollover bool) {
				mw.manaTeaAura = dot.Aura
			},
			OnTick: func(sim *core.Simulation, target *core.Unit, spell *core.Dot) {
				mw.AddMana(sim, manaPerTick, manaMetrics)

				mw.ManaTeaStackAura.SetStacks(sim, mw.ManaTeaStackAura.GetStacks()-1)

			},
		},

		ExtraCastCondition: func(sim *core.Simulation, target *core.Unit) bool {

			return mw.ManaTeaStackAura.GetStacks() > 0
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			manaPerTick = mw.MaxMana() * 0.05 //Patched to restore 5% instead of original 4%

			hot := spell.SelfHot()
			stacksToUse := min(mw.ManaTeaStackAura.GetStacks(), 6.0)
			hot.Duration = time.Duration(stacksToUse) * 500 * time.Millisecond
			hot.BaseTickCount = stacksToUse
			hot.Activate(sim)
			//mw.ManaTeaStackAura.SetStacks(sim, mw.ManaTeaStackAura.GetStacks()-1)

			//spell.SelfHot().Apply(sim)

		},
	})
}
