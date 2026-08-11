// Implements a generic resource bar that can be used to implement secondary resources
// TODO: Check whether pre-pull OOC resource loss needs to be supported for DemonicFury
package core

import (
	"github.com/wowsims/mop/sim/core/proto"
)

type OnGainCallback func(sim *Simulation, gain float64, realGain float64, actionID ActionID)
type OnSpendCallback func(sim *Simulation, amount float64, actionID ActionID)

type SecondaryResourceBar interface {
	CanSpend(limit float64) bool                                       // Check whether the current resource is available or not
	Spend(sim *Simulation, amount float64, action ActionID)            // Spend the specified amount of resource
	SpendUpTo(sim *Simulation, limit float64, action ActionID) float64 // Spends as much resource as possible up to the speciefied limit; Returns the amount of resource spent
	Gain(sim *Simulation, amount float64, action ActionID)             // Gain the amount specified from the action
	Reset(sim *Simulation)                                             // Resets the current resource bar
	ResetBarTo(sim *Simulation, resourcesToKeep float64)               // Resets the current resource bar to the specified value
	Value() float64                                                    // Returns the current amount of resource
	RegisterOnGain(callback OnGainCallback)                            // Registers a callback that will be called. Gain = amount gained, realGain = actual amount gained due to caps
	RegisterOnSpend(callback OnSpendCallback)                          // Registers a callback that will be called when the resource was spend
}

type SecondaryResourceConfig struct {
	Type    proto.SecondaryResourceType // The type of resource the bar tracks
	Max     float64                     // The maximum amount the bar tracks
	Default float64                     // The default value this bar should be initialized with
}

// Default implementation of SecondaryResourceBar
// Use RegisterSecondaryResourceBar to intantiate the resource bar
type DefaultSecondaryResourceBarImpl struct {
	config  SecondaryResourceConfig
	value   float64
	unit    *Unit
	metrics map[ActionID]*ResourceMetrics
	onGain  []OnGainCallback
	onSpend []OnSpendCallback
}

// CanSpend implements SecondaryResourceBar.
func (bar *DefaultSecondaryResourceBarImpl) CanSpend(limit float64) bool {
	return bar.value >= limit
}

// Gain implements SecondaryResourceBar.
func (bar *DefaultSecondaryResourceBarImpl) Gain(sim *Simulation, amount float64, action ActionID) {
	if amount < 0 {
		panic("Can not gain negative amount")
	}

	oldValue := bar.value
	bar.value = min(bar.value+amount, bar.config.Max)
	amountGained := bar.value - oldValue
	metrics := bar.GetMetric(action)
	metrics.AddEvent(float64(amount), float64(amountGained))
	if sim.Log != nil {
		bar.unit.Log(
			sim,
			"Gained %0.01f %s from %s (%0.01f --> %0.01f) of %0.01f total.",
			amountGained,
			proto.SecondaryResourceType_name[int32(bar.config.Type)],
			action,
			oldValue,
			bar.value,
			bar.config.Max,
		)
	}

	bar.invokeOnGain(sim, amount, amountGained, action)
}

// Reset implements SecondaryResourceBar.
// Initialization is not a resource event: set the value directly so no metrics
// event is recorded and no OnGain callback fires.
func (bar *DefaultSecondaryResourceBarImpl) Reset(_ *Simulation) {
	bar.value = bar.config.Default
}

var encounterStartActionID = ActionID{OtherID: proto.OtherAction_OtherActionEncounterStart}

func (bar *DefaultSecondaryResourceBarImpl) ResetBarTo(sim *Simulation, resourcesToKeep float64) {
	if bar.value > resourcesToKeep {
		bar.Spend(sim, bar.value-resourcesToKeep, encounterStartActionID)
	} else if resourcesToKeep > bar.value {
		bar.Gain(sim, resourcesToKeep-bar.value, encounterStartActionID)
	}
}

// Spend implements SecondaryResourceBar.
func (bar *DefaultSecondaryResourceBarImpl) Spend(sim *Simulation, amount float64, action ActionID) {
	if amount > bar.value {
		panic("Trying to spend more resource than is available.")
	}

	if amount < 0 {
		panic("Trying to spend negative amount.")
	}

	metrics := bar.GetMetric(action)
	if sim.Log != nil {
		bar.unit.Log(
			sim,
			"Spent %0.01f %s from %s (%0.01f --> %0.01f) of %0.01f total.",
			amount,
			proto.SecondaryResourceType_name[int32(bar.config.Type)],
			metrics.ActionID,
			bar.value,
			bar.value-amount,
			bar.config.Max,
		)
	}

	metrics.AddEvent(float64(-amount), float64(-amount))
	bar.invokeOnSpend(sim, amount, action)
	bar.value -= amount
}

// SpendUpTo implements SecondaryResourceBar.
func (bar *DefaultSecondaryResourceBarImpl) SpendUpTo(sim *Simulation, limit float64, action ActionID) float64 {
	if bar.value > limit {
		bar.Spend(sim, limit, action)
		return limit
	}

	value := bar.value
	bar.Spend(sim, value, action)
	return value
}

// Value implements SecondaryResourceBar.
func (bar *DefaultSecondaryResourceBarImpl) Value() float64 {
	return bar.value
}

func (bar *DefaultSecondaryResourceBarImpl) Max() float64 {
	return bar.config.Max
}

func (bar *DefaultSecondaryResourceBarImpl) GetMetric(action ActionID) *ResourceMetrics {
	metric, ok := bar.metrics[action]
	if !ok {
		metric = bar.unit.NewGenericMetric(action)
		bar.metrics[action] = metric
	}

	return metric
}

func (bar *DefaultSecondaryResourceBarImpl) RegisterOnGain(callback OnGainCallback) {
	if callback == nil {
		panic("Can not register nil callback")
	}

	bar.onGain = append(bar.onGain, callback)
}

func (bar *DefaultSecondaryResourceBarImpl) RegisterOnSpend(callback OnSpendCallback) {
	if callback == nil {
		panic("Can not register nil callback")
	}

	bar.onSpend = append(bar.onSpend, callback)
}

func (bar *DefaultSecondaryResourceBarImpl) invokeOnGain(sim *Simulation, gain float64, realGain float64, actionID ActionID) {
	for _, callback := range bar.onGain {
		callback(sim, gain, realGain, actionID)
	}
}

func (bar *DefaultSecondaryResourceBarImpl) invokeOnSpend(sim *Simulation, amount float64, actionID ActionID) {
	for _, callback := range bar.onSpend {
		callback(sim, amount, actionID)
	}
}

func (unit *Unit) NewDefaultSecondaryResourceBar(config SecondaryResourceConfig) *DefaultSecondaryResourceBarImpl {
	if config.Type <= 0 {
		panic("Invalid SecondaryResourceType given.")
	}

	if config.Max <= 0 {
		panic("Invalid maximum resource value given.")
	}

	if config.Default < 0 || config.Default > config.Max {
		panic("Invalid default value given for resource bar")
	}

	return &DefaultSecondaryResourceBarImpl{
		config:  config,
		unit:    unit,
		metrics: make(map[ActionID]*ResourceMetrics),
		onGain:  []OnGainCallback{},
		onSpend: []OnSpendCallback{},
	}
}

func (unit *Unit) RegisterSecondaryResourceBar(config SecondaryResourceBar) {
	if unit.secondaryResourceBar != nil {
		panic("A secondary resource bar has already been registered.")
	}

	unit.secondaryResourceBar = config
}

func (unit *Unit) RegisterNewDefaultSecondaryResourceBar(config SecondaryResourceConfig) SecondaryResourceBar {
	bar := unit.NewDefaultSecondaryResourceBar(config)
	unit.RegisterSecondaryResourceBar(bar)
	return bar
}

func (unit *Unit) GetSecondaryResourceBar() SecondaryResourceBar {
	return unit.secondaryResourceBar
}
