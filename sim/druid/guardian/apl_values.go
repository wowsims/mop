package guardian

import (
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
)


func (bear *GuardianDruid) NewAPLAction(rot *core.APLRotation, config *proto.APLAction) core.APLActionImpl {
	switch config.Action.(type) {
	case *proto.APLAction_GuardianHotwDpsRotation:
		return bear.newActionGuardianHotwDpsRotation(rot, config.GetGuardianHotwDpsRotation())
	default:
		return nil
	}
}

type APLActionGuardianHotwDpsRotation struct {
	bear         *GuardianDruid
	strategy     proto.APLActionGuardianHotwDpsRotation_Strategy
	lastAction   time.Duration
	nextActionAt time.Duration
}

func (impl *APLActionGuardianHotwDpsRotation) GetInnerActions() []*core.APLAction { return nil }
func (impl *APLActionGuardianHotwDpsRotation) GetAPLValues() []core.APLValue      { return nil }
func (impl *APLActionGuardianHotwDpsRotation) Finalize(*core.APLRotation)         {}
func (impl *APLActionGuardianHotwDpsRotation) PostFinalize(*core.APLRotation)     {}
func (impl *APLActionGuardianHotwDpsRotation) GetNextAction(*core.Simulation) *core.APLAction {
	return nil
}

func (bear *GuardianDruid) newActionGuardianHotwDpsRotation(_ *core.APLRotation, config *proto.APLActionGuardianHotwDpsRotation) core.APLActionImpl {
	return &APLActionGuardianHotwDpsRotation{
		bear:     bear,
		strategy: config.GetStrategy(),
	}
}

func (action *APLActionGuardianHotwDpsRotation) IsReady(sim *core.Simulation) bool {
	return sim.CurrentTime > action.lastAction
}

func (action *APLActionGuardianHotwDpsRotation) Execute(sim *core.Simulation) {
	action.lastAction = sim.CurrentTime
	bear := action.bear
	bear.CancelQueuedSpell(sim)

	if !bear.GCD.IsReady(sim) {
		bear.WaitUntil(sim, bear.NextGCDAt())
		return
	}

	if bear.HeartOfTheWildAura.RemainingDuration(sim) < core.GCDDefault {
		bear.BearForm.Cast(sim, nil)
		return
	}

	if sim.CurrentTime < action.nextActionAt {
		bear.WaitUntil(sim, action.nextActionAt)
		return
	}

	if action.strategy == proto.APLActionGuardianHotwDpsRotation_Caster {
		bear.Wrath.Cast(sim, bear.CurrentTarget)
		return
	}

	curCp := bear.ComboPoints()
	ripDot := bear.Rip.CurDot()
	ripNow := (curCp == 5) && (!ripDot.IsActive() || (ripDot.RemainingDuration(sim) < ripDot.BaseTickLength)) 
	rakeDot := bear.Rake.CurDot()
	rakeNow := !rakeDot.IsActive() || (rakeDot.RemainingDuration(sim) < rakeDot.BaseTickLength)

	if !bear.CatFormAura.IsActive() && (ripNow || rakeNow) {
		bear.CatForm.Cast(sim, nil)
		return
	}

	var poolingTime time.Duration

	curEnergy := bear.CurrentEnergy()
	regenRate := bear.EnergyRegenPerSecond()

	if ripNow {
		if bear.Rip.CanCast(sim, bear.CurrentTarget) {
			bear.Rip.Cast(sim, bear.CurrentTarget)
			return
		} else {
			poolingTime = core.DurationFromSeconds((bear.CurrentRipCost() - curEnergy) / regenRate)
		}
	} else if rakeNow {
		if bear.Rake.CanCast(sim, bear.CurrentTarget) {
			bear.Rake.Cast(sim, bear.CurrentTarget)
			return
		} else {
			poolingTime = core.DurationFromSeconds((bear.CurrentRakeCost() - curEnergy) / regenRate)
		}
	} else if (curCp < 5) || (action.strategy == proto.APLActionGuardianHotwDpsRotation_Cat) {
		if bear.MangleCat.CanCast(sim, bear.CurrentTarget) {
			bear.MangleCat.Cast(sim, bear.CurrentTarget)
			return
		} else {
			poolingTime = core.DurationFromSeconds((bear.CurrentMangleCatCost() - curEnergy) / regenRate)
		}
	} else {
		bear.Wrath.Cast(sim, bear.CurrentTarget)
		return
	}
	
	action.nextActionAt = sim.CurrentTime + poolingTime + bear.ReactionTime
	bear.WaitUntil(sim, action.nextActionAt)
}

func (action *APLActionGuardianHotwDpsRotation) Reset(_ *core.Simulation) {
	action.lastAction = -core.NeverExpires
	action.nextActionAt = 0
}

func (action *APLActionGuardianHotwDpsRotation) String() string {
	return "Execute Guardian HotW DPS Rotation()"
}
