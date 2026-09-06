package demonology

import "github.com/wowsims/mop/sim/core"

func (demo *DemonologyWarlock) registerDrainLife() {
	demo.RegisterDrainLife(func(_ core.SpellResultSlice, spell *core.Spell, sim *core.Simulation) {
		if demo.IsInMeta() {
			if demo.CanSpendDemonicFury(30) {
				demo.SpendDemonicFury(sim, 30, spell.ActionID)
			} else {
				// Can't afford the next tick. Deactivating from inside our own tick
				// makes the dot's expire handler fire an extra tick and clears
				// ChanneledDot under periodicTick, so end the channel right after
				// this tick instead.
				dot := demo.ChanneledDot
				sim.AddPendingAction(&core.PendingAction{
					NextActionAt: sim.CurrentTime,
					OnAction: func(sim *core.Simulation) {
						if dot.IsActive() {
							dot.Deactivate(sim)
						}
					},
				})
			}
		} else {
			demo.GainDemonicFury(sim, 10, spell.ActionID)
		}
	})
}
