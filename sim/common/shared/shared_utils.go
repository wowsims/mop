package shared

import (
	"fmt"
	"math"
	"time"

	"github.com/wowsims/mop/sim/core"
	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
)

type ProcStatBonusEffect struct {
	Name               string
	ItemID             int32
	EnchantID          int32
	Callback           core.AuraCallback
	ProcMask           core.ProcMask
	Outcome            core.HitOutcome
	RequireDamageDealt bool

	// Any other custom proc conditions not covered by the above fields.
	CustomProcCondition core.CustomStatBuffProcCondition
}

type DamageEffect struct {
	SpellID          int32
	School           core.SpellSchool
	MinDmg           float64
	MaxDmg           float64
	BonusCoefficient float64
	IsMelee          bool
	ProcMask         core.ProcMask
	Outcome          OutcomeType
	// Set when the client bars the damage spell from critting, which the sim has no way to know:
	// it is a spell attribute, so only the database generator can see it.
	CannotCrit bool
}

type ExtraSpellInfo struct {
	Spell   *core.Spell
	Trigger func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult)
}

type ItemVariant struct {
	ItemID   int32
	ItemName string
}

type CustomProcHandler func(sim *core.Simulation, procAura *core.StatBuffAura)

func NewProcStatBonusEffectWithDamageProc(config ProcStatBonusEffect, damage DamageEffect) {
	procMask := core.ProcMaskEmpty
	if damage.ProcMask != core.ProcMaskUnknown {
		procMask = damage.ProcMask
	}

	factory_ProcStatBonusEffect(config, func(agent core.Agent, _ proto.ItemLevelState) ExtraSpellInfo {
		character := agent.GetCharacter()

		procSpell := character.RegisterSpell(core.SpellConfig{
			ActionID:                 core.ActionID{SpellID: damage.SpellID},
			SpellSchool:              damage.School,
			ProcMask:                 procMask,
			Flags:                    core.SpellFlagNoOnCastComplete | core.SpellFlagPassiveSpell,
			DamageMultiplier:         1,
			CritMultiplier:           character.DefaultCritMultiplier(),
			DamageMultiplierAdditive: 1,
			ThreatMultiplier:         1,
			BonusCoefficient:         damage.BonusCoefficient,
			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				spell.CalcAndDealDamage(sim, target, sim.Roll(damage.MinDmg, damage.MaxDmg), GetOutcome(spell, damageOutcome(damage.School, damage.IsMelee, damage.CannotCrit, damage.Outcome)))
			},
		})

		return ExtraSpellInfo{
			Spell: procSpell,
			Trigger: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
				procSpell.Cast(sim, result.Target)
			},
		}
	})
}

func factory_ProcStatBonusEffect(config ProcStatBonusEffect, extraSpell func(agent core.Agent, _ proto.ItemLevelState) ExtraSpellInfo) {
	// Ignore empty dummy implementations
	if config.Callback == core.CallbackEmpty {
		return
	}

	source := config.effectSource()

	// Soft fail to allow for overrides for bad effects
	if source.isAlreadyImplemented() {
		return
	}

	triggerActionID := source.actionID()

	source.registerEffect(func(agent core.Agent, itemLevelState proto.ItemLevelState) {
		character := agent.GetCharacter()
		eligibleSlots := source.eligibleSlots(character)

		procEffects := source.procEffects()
		if len(procEffects) == 0 {
			panic(fmt.Sprintf("Error getting proc effects for item/enchant %v", source.id))
		}

		// Several proc effects would each register their auras under the same config.Name, and
		// GetOrRegisterAura merges by label: the last handler and the first stats would win, and
		// every effect would run at its own full proc rate rather than a share of one roll. The
		// multi-buff weapon enchants are shaped like this - Windsong declares three effects at
		// 2.2 RPPM each, Dancing Steel two - and are still hand-written, so nothing reaches here
		// today. Whoever migrates them has to decide what the combined rate means first.
		if len(procEffects) > 1 {
			panic(fmt.Sprintf("item/enchant %d declares %d proc effects sharing the aura label %q; "+
				"needs per-effect labels and a decided proc rate before it can be generated",
				source.id, len(procEffects), config.Name))
		}

		for _, effect := range procEffects {
			proc := effect.GetProc()

			// windowAura is set only for the stacking trinkets, where the trigger opens a window
			// that accumulates a separate stat aura on its own schedule. The handler then activates
			// the window rather than the stat aura, so a re-proc restarts the window instead of
			// adding a stack and refreshing a duration the game does not refresh.
			procAura, windowAura := buildProcAura(character, config, effect, itemLevelState)

			procAura.CustomProcCondition = config.CustomProcCondition

			var procSpell ExtraSpellInfo
			if extraSpell != nil {
				procSpell = extraSpell(agent, itemLevelState)
			}

			triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
				ActionID:           triggerActionID,
				Name:               config.Name,
				Callback:           config.Callback,
				ProcMask:           config.ProcMask,
				Outcome:            config.Outcome,
				RequireDamageDealt: config.RequireDamageDealt,
				ProcChance:         proc.GetProcChance(),
				DPM:                procDPM(character, config.ProcMask, source, proc),
				ICD:                time.Millisecond * time.Duration(proc.IcdMs),
				Handler:            procHandler(config, effect, procAura, windowAura, procSpell),
			})

			// Carried on the stacking path too. Nothing in the stacking machinery reads this -
			// StatBuffAura.CanProc consults only IsSwapped and CustomProcCondition, and the
			// per-tick AddStack loop never looks at Icd - so it gates nothing. What it does feed is
			// GetMatchingItemProcAuras, which drops any aura whose Icd is nil, and with it
			// ItemProcsMaxRemainingICD and AnyItemStatProcsAvailable.
			if proc.IcdMs != 0 {
				procAura.Icd = triggerAura.Icd
			}

			source.registerProc(character, triggerAura, eligibleSlots)
			source.registerWeaponEnchantBuff(character, procAura)
			character.AddStatProcBuff(source.id, procAura, source.isEnchant, eligibleSlots)
		}
	})
}

// What the proc does when it fires.
func procHandler(config ProcStatBonusEffect, effect *proto.ItemEffect, procAura *core.StatBuffAura, windowAura *core.Aura, procSpell ExtraSpellInfo) func(*core.Simulation, *core.Spell, *core.SpellResult) {
	return func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
		// When the condition refuses, the ICD is rolled back so the next opportunity still counts
		// instead of the effect being locked out by a proc that never happened.
		if config.CustomProcCondition != nil && !procAura.CanProc(sim) {
			if procAura.Icd != nil && procAura.Icd.Duration != 0 {
				procAura.Icd.Reset()
			}
			return
		}

		// Activating the window and not the stat aura is what makes a re-proc restart the window
		// instead of refreshing stacks the game would not refresh.
		if windowAura != nil {
			windowAura.Activate(sim)
		} else {
			procAura.Activate(sim)
			if effect.MaxCumulativeStacks > 0 {
				procAura.AddStack(sim)
			}
		}

		if procSpell.Spell != nil {
			procSpell.Trigger(sim, spell, result)
		}
	}
}

// The three shapes a proc buff comes in. Only the first returns a second aura: there the trigger
// opens a window and the stat aura inside it accumulates, so the caller has two things to wire.
func buildProcAura(character *core.Character, config ProcStatBonusEffect, effect *proto.ItemEffect, itemLevelState proto.ItemLevelState) (*core.StatBuffAura, *core.Aura) {
	label := config.Name + " Proc"
	action := core.ActionID{SpellID: effect.BuffId}
	duration := time.Millisecond * time.Duration(effect.EffectDurationMs)
	state := int32(itemLevelState)

	if stackingAura := effect.StackingAura; stackingAura != nil {
		return character.NewTemporaryStatBuffWithStacks(core.TemporaryStatBuffWithStacksConfig{
			AuraLabel:            label,
			ActionID:             action,
			Duration:             duration,
			MaxStacks:            stackingAura.MaxCumulativeStacks,
			TimePerStack:         time.Millisecond * time.Duration(effect.StackPeriodMs),
			BonusPerStack:        stats.FromProtoMap(stackingAura.ScalingOptions[state].GetStats()),
			StackingAuraActionID: core.ActionID{SpellID: stackingAura.BuffId},
			StackingAuraLabel:    config.Name + " Stacks",
			TickImmediately:      true,
		})
	}

	if effect.MaxCumulativeStacks > 0 {
		return core.MakeStackingAura(character, core.StackingStatAura{
			Aura: core.Aura{
				Label:     label,
				ActionID:  action,
				Duration:  duration,
				MaxStacks: effect.MaxCumulativeStacks,
			},
			BonusPerStack: stats.FromProtoMap(effect.ScalingOptions[state].GetStats()),
		}), nil
	}

	return character.NewTemporaryStatsAura(label, action, stats.FromProtoMap(effect.ScalingOptions[state].GetStats()), duration), nil
}

// The proc manager an effect's database rate calls for, or nil when the rate is a flat chance the
// caller should read off the proc instead.
func procDPM(character *core.Character, procMask core.ProcMask, source effectSource, proc *proto.ProcEffect) *core.DynamicProcManager {
	if proc.GetRppm() != nil {
		return character.NewRPPMProcManager(source.id, source.isEnchant, false, procMask, core.RppmConfigFromProcEffectProto(proc))
	}

	if proc.GetPpm() <= 0 {
		return nil
	}

	if procMask != core.ProcMaskUnknown {
		return character.NewLegacyPPMManager(proc.GetPpm(), procMask)
	}

	// With no mask of its own the rate has to be read off whatever the effect sits on.
	if source.isEnchant {
		return character.NewDynamicLegacyProcForEnchant(source.id, proc.GetPpm(), 0)
	}

	return character.NewDynamicLegacyProcForWeapon(source.id, proc.GetPpm(), 0)
}

func NewProcStatBonusEffectWithVariants(config ProcStatBonusEffect, variants []ItemVariant) {
	forEachVariant(variants, func(variant ItemVariant) {
		config.Name = variant.ItemName
		config.ItemID = variant.ItemID
		NewProcStatBonusEffect(config)
	})
}

func NewProcStatBonusEffect(config ProcStatBonusEffect) {
	factory_ProcStatBonusEffect(config, nil)
}

func NewSimpleStatActiveWithVariants(variants []ItemVariant) {
	forEachVariant(variants, func(variant ItemVariant) {
		NewSimpleStatActive(variant.ItemID)
	})
}

// Describes an on-use effect on an item or an enchant. Only the identity and the profession
// gate are stated here; the stats, buff duration, cooldown and shared cooldown all come from
// the DBC
type ActiveStatBonusEffect struct {
	ItemID    int32
	EnchantID int32

	// Registration is skipped unless the character has this profession.
	// ProfessionUnknown means there is no requirement.
	RequiredProfession proto.Profession
}

// Registers an on-use effect from its database entry.
func NewActiveStatBonusEffect(config ActiveStatBonusEffect) {
	factory_ActiveStatBonusEffect(config)
}

func NewSimpleStatActive(itemID int32) {
	factory_ActiveStatBonusEffect(ActiveStatBonusEffect{ItemID: itemID})
}

// The on-use counterpart to factory_ProcStatBonusEffect.
func factory_ActiveStatBonusEffect(config ActiveStatBonusEffect) {
	source := config.effectSource()

	// Soft fail to allow for overrides for bad effects
	if source.isAlreadyImplemented() {
		return
	}

	source.registerEffect(func(agent core.Agent, scalingSelector proto.ItemLevelState) {
		character := agent.GetCharacter()
		if config.RequiredProfession != proto.Profession_ProfessionUnknown && !character.HasProfession(config.RequiredProfession) {
			return
		}

		state := int32(source.scalingState(scalingSelector))

		registered := false
		for _, effect := range source.declaredEffects() {
			onUseData := effect.GetOnUse()
			if onUseData == nil {
				continue
			}

			// An enchant's on-use is kept for its trigger even when no stats resolve, so the ones
			// whose buff is server-scripted reach here with nothing to grant and are skipped.
			tempStats := stats.FromProtoMap(effect.ScalingOptions[state].GetStats())
			if source.isEnchant && tempStats.Equals(stats.Stats{}) {
				continue
			}

			actionID, label := source.onUseIdentity(effect)

			spellConfig := core.SpellConfig{ActionID: actionID}
			spellConfig.Cast.CD = core.Cooldown{
				Timer:    character.NewTimer(),
				Duration: time.Duration(onUseData.CooldownMs) * time.Millisecond,
			}
			spellConfig.Cast.SharedCD = sharedCooldown(character, effect)

			core.RegisterTemporaryStatsOnUseCD(character, label, tempStats, time.Millisecond*time.Duration(effect.EffectDurationMs), spellConfig)
			registered = true
		}

		if !registered && !source.isEnchant {
			panic(fmt.Sprintf("No active effects found for item with ID: %d!", source.id))
		}
	})
}

type StackingStatBonusCD struct {
	Name               string
	ItemID             int32
	AuraID             int32
	Bonus              stats.Stats
	Duration           time.Duration
	MaxStacks          int32
	CD                 time.Duration
	Callback           core.AuraCallback
	ProcMask           core.ProcMask
	SpellFlags         core.SpellFlag
	Outcome            core.HitOutcome
	RequireDamageDealt bool
	ProcChance         float64
	IsDefensive        bool
	Rppm               core.RPPMConfig

	// The stacks will only be granted as long as the trinket is active
	TrinketLimitsDuration bool
}

// Creates a new stacking stats bonus aura based on the configuration.
func NewStackingStatBonusCD(config StackingStatBonusCD) {
	core.NewItemEffect(config.ItemID, func(agent core.Agent, state proto.ItemLevelState) {
		character := agent.GetCharacter()

		auraID := core.ActionID{SpellID: config.AuraID}
		if auraID.IsEmptyAction() {
			auraID = core.ActionID{ItemID: config.ItemID}
		}

		// If we do not get a manual stat, overwrite it with scaling stats
		if config.Bonus.Equals(stats.Stats{}) {
			panic(fmt.Sprintf("Missing required Bonus stats for item with ID: %d!", config.ItemID))
		}

		var dpm *core.DynamicProcManager
		if config.Rppm.PPM > 0 {
			dpm = character.NewRPPMProcManager(config.ItemID, false, false, config.ProcMask, config.Rppm)
		}

		duration := core.TernaryDuration(config.TrinketLimitsDuration, core.NeverExpires, config.Duration)
		statAura := core.MakeStackingAura(character, core.StackingStatAura{
			Aura: core.Aura{
				Label:     config.Name + " Proc",
				ActionID:  auraID,
				Duration:  duration,
				MaxStacks: config.MaxStacks,
			},
			BonusPerStack: config.Bonus,
		})

		// If trinket limits duration create a separate proc aura
		var procAura *core.Aura = statAura.Aura
		if config.TrinketLimitsDuration {
			procAura = character.RegisterAura(core.Aura{
				Label:    config.Name + " Aura",
				ActionID: auraID,
				Duration: config.Duration,
				OnExpire: func(_ *core.Aura, sim *core.Simulation) {
					statAura.Deactivate(sim)
				},
			})
		}

		procAura.AttachProcTriggerCallback(&character.Unit, core.ProcTrigger{
			Name:               config.Name,
			Callback:           config.Callback,
			ProcMask:           config.ProcMask,
			SpellFlags:         config.SpellFlags,
			Outcome:            config.Outcome,
			RequireDamageDealt: config.RequireDamageDealt,
			ProcChance:         config.ProcChance,
			DPM:                dpm,
			Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
				statAura.AddStack(sim)
			},
		})

		var sharedTimer *core.Timer
		if config.IsDefensive {
			sharedTimer = character.GetDefensiveTrinketCD()
		} else {
			sharedTimer = character.GetOffensiveTrinketCD()
		}

		spell := character.RegisterSpell(core.SpellConfig{
			ActionID: core.ActionID{ItemID: config.ItemID},
			Flags:    core.SpellFlagNoOnCastComplete,

			Cast: core.CastConfig{
				CD: core.Cooldown{
					Timer:    character.NewTimer(),
					Duration: config.CD,
				},
				SharedCD: core.Cooldown{
					Timer:    sharedTimer,
					Duration: config.Duration,
				},
			},

			ApplyEffects: func(sim *core.Simulation, _ *core.Unit, spell *core.Spell) {
				statAura.Activate(sim)
			},
		})

		character.AddMajorCooldown(core.MajorCooldown{
			Spell: spell,
			Type:  core.CooldownTypeDPS,
		})
	})
}

type StackingStatBonusEffect struct {
	Name               string
	ItemID             int32
	AuraID             int32
	Bonus              stats.Stats
	Duration           time.Duration
	MaxStacks          int32
	Callback           core.AuraCallback
	ProcMask           core.ProcMask
	Rppm               core.RPPMConfig
	SpellFlags         core.SpellFlag
	Outcome            core.HitOutcome
	RequireDamageDealt bool
	ProcChance         float64
	Icd                time.Duration
}

func NewStackingStatBonusEffect(config StackingStatBonusEffect) {
	core.NewItemEffect(config.ItemID, func(agent core.Agent, state proto.ItemLevelState) {
		character := agent.GetCharacter()

		eligibleSlotsForItem := character.ItemSwap.EligibleSlotsForItem(config.ItemID)

		auraID := core.ActionID{SpellID: config.AuraID}
		if auraID.IsEmptyAction() {
			auraID = core.ActionID{ItemID: config.ItemID}
		}

		if config.Bonus.Equals(stats.Stats{}) {
			panic(fmt.Sprintf("Missing required Bonus stats for item with ID: %d!", config.ItemID))
		}

		var dpm *core.DynamicProcManager
		if config.Rppm.PPM > 0 {
			dpm = character.NewRPPMProcManager(config.ItemID, false, false, config.ProcMask, config.Rppm)
		}

		procAura := core.MakeStackingAura(character, core.StackingStatAura{
			Aura: core.Aura{
				Label:     config.Name + " Proc",
				ActionID:  auraID,
				Duration:  config.Duration,
				MaxStacks: config.MaxStacks,
			},
			BonusPerStack: config.Bonus,
		})

		triggerAura := character.MakeProcTriggerAura(core.ProcTrigger{
			ActionID:           core.ActionID{ItemID: config.ItemID},
			Name:               config.Name,
			Callback:           config.Callback,
			ProcMask:           config.ProcMask,
			SpellFlags:         config.SpellFlags,
			Outcome:            config.Outcome,
			RequireDamageDealt: config.RequireDamageDealt,
			ProcChance:         config.ProcChance,
			DPM:                dpm,
			ICD:                config.Icd,
			Handler: func(sim *core.Simulation, _ *core.Spell, _ *core.SpellResult) {
				procAura.Activate(sim)
				procAura.AddStack(sim)
			},
		})

		procAura.Icd = triggerAura.Icd
		character.AddStatProcBuff(config.ItemID, procAura, false, eligibleSlotsForItem)
		character.ItemSwap.RegisterProcWithSlots(config.ItemID, triggerAura, eligibleSlotsForItem)
	})
}

type OutcomeType uint64

const (
	OutcomeDefault                  = 0
	OutcomeMeleeCanCrit OutcomeType = iota
	OutcomeMeleeNoCrit
	OutcomeMeleeNoBlockDodgeParryCrit
	OutcomeSpellCanCrit
	OutcomeSpellNoCrit
	OutcomeSpellNoMissCanCrit
	OutcomeRangedCanCrit
)

type ProcDamageEffect struct {
	ItemID     int32
	SpellID    int32
	EnchantID  int32
	Trigger    core.ProcTrigger
	TriggerDPM func(*core.Character) *core.DynamicProcManager
	School     core.SpellSchool
	MinDmg     float64
	MaxDmg     float64
	IsMelee    bool
	Flags      core.SpellFlag
	Outcome    OutcomeType
	// Set when the client bars the damage spell from critting, which the sim has no way to know:
	// it is a spell attribute, so only the database generator can see it.
	CannotCrit bool
}

// Whether a proc's damage is dealt as a melee hit. The school decides it: anything non-physical
// rolls against the spell tables. IsMelee stays honoured on top of that for a caller that means
// physical damage without saying so through the school.
func isMeleeDamage(school core.SpellSchool, isMelee bool) bool {
	return isMelee || school.Matches(core.SpellSchoolPhysical)
}

// The outcome a proc's damage rolls when the caller states none. Physical damage goes through the
// melee table, everything else through the spell one, and a spell the client bars from critting
// takes the no-crit variant of whichever it rolls against.
func damageOutcome(school core.SpellSchool, isMelee bool, cannotCrit bool, outcome OutcomeType) OutcomeType {
	if outcome != OutcomeDefault {
		return outcome
	}

	if isMeleeDamage(school, isMelee) {
		if cannotCrit {
			return OutcomeMeleeNoCrit
		}

		return OutcomeMeleeCanCrit
	}

	if cannotCrit {
		return OutcomeSpellNoCrit
	}

	return OutcomeSpellCanCrit
}

func GetOutcome(spell *core.Spell, outcome OutcomeType) core.OutcomeApplier {
	switch outcome {
	case OutcomeMeleeCanCrit:
		return spell.OutcomeMeleeSpecialHitAndCrit
	case OutcomeMeleeNoCrit:
		return spell.OutcomeMeleeSpecialHit
	case OutcomeMeleeNoBlockDodgeParryCrit:
		return spell.OutcomeMeleeSpecialNoBlockDodgeParryNoCrit
	case OutcomeSpellCanCrit:
		return spell.OutcomeMagicHitAndCrit
	case OutcomeSpellNoMissCanCrit:
		return spell.OutcomeMagicCrit
	case OutcomeSpellNoCrit:
		return spell.OutcomeMagicHit
	case OutcomeRangedCanCrit:
		return spell.OutcomeRangedHitAndCrit
	default:
		return spell.OutcomeMagicHitAndCrit
	}
}

// Fills a trigger's proc rate, internal cooldown and proc chance from the item or enchant's
// database entry, so that a generated effect only has to state what the database cannot
// carry.
func getProcFromDBC(character *core.Character, trigger *core.ProcTrigger, source effectSource) {
	for _, effect := range source.declaredEffects() {
		proc := effect.GetProc()
		if proc == nil {
			continue
		}

		// Through procDPM rather than reading the rate again here. A second copy had already lost
		// the ProcMaskUnknown fallback, and a legacy PPM manager built with a zero mask matches
		// nothing and never procs at all.
		if dpm := procDPM(character, trigger.ProcMask, source, proc); dpm != nil {
			trigger.DPM = dpm
		} else {
			trigger.ProcChance = proc.GetProcChance()
		}

		if trigger.ICD == 0 {
			trigger.ICD = time.Millisecond * time.Duration(proc.IcdMs)
		}
		return
	}
}

func NewProcDamageEffect(config ProcDamageEffect) {
	source := config.effectSource()

	// Soft fail to allow for overrides for bad effects, same as factory_ProcStatBonusEffect.
	// Without this, hand-writing an effect that is also generated panics on the duplicate
	// registration instead of letting the manual one win.
	if source.isAlreadyImplemented() {
		return
	}

	// Not source.actionID(): an enchant's damage proc is identified by the spell it casts rather
	// than by the enchantment, because the enchantment ID is not something the client shows.
	triggerActionID := core.ActionID{ItemID: config.ItemID}
	if source.isEnchant {
		triggerActionID = core.ActionID{SpellID: config.SpellID}
	}

	source.registerEffect(func(agent core.Agent, _ proto.ItemLevelState) {
		character := agent.GetCharacter()

		triggerConfig := config.Trigger
		minDmg := config.MinDmg
		maxDmg := config.MaxDmg

		if core.ActionID.IsEmptyAction(triggerConfig.ActionID) {
			triggerConfig.ActionID = triggerActionID
		}

		if config.TriggerDPM != nil {
			triggerConfig.DPM = config.TriggerDPM(character)
		} else if triggerConfig.DPM == nil && triggerConfig.ProcChance == 0 {
			// Damage amounts are not carried in the database, but proc rates are, so a
			// generated damage proc does not have to restate its rate. Same source as
			// factory_ProcStatBonusEffect uses.
			getProcFromDBC(character, &triggerConfig, source)
		}

		damageSpell := character.RegisterSpell(core.SpellConfig{
			ActionID:    core.ActionID{SpellID: config.SpellID},
			SpellSchool: config.School,
			ProcMask:    core.ProcMaskEmpty,
			Flags:       config.Flags,

			DamageMultiplier: 1,
			CritMultiplier:   character.DefaultCritMultiplier(),
			ThreatMultiplier: 1,

			ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
				spell.CalcAndDealDamage(sim, target, sim.Roll(minDmg, maxDmg), GetOutcome(spell, damageOutcome(config.School, config.IsMelee, config.CannotCrit, config.Outcome)))
			},
		})

		triggerConfig.TriggerImmediately = true
		triggerConfig.Handler = func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			// Land the extra damage on whatever was hit, not on the primary target.
			target := character.CurrentTarget
			if result != nil && result.Target != nil {
				target = result.Target
			}

			// On a hit-taken proc the wearer is what was hit - core dispatches those through
			// result.Target.OnSpellHitTaken - so the retaliation has to go back to the attacker
			// instead of into the wearer's own health. This is the shield spike shape.
			if target == &character.Unit && spell != nil && spell.Unit != nil {
				target = spell.Unit
			}

			damageSpell.Cast(sim, target)
		}
		triggerAura := character.MakeProcTriggerAura(triggerConfig)
		source.registerProcAnySlot(character, triggerAura)
	})
}

// Takes in the SpellResult for the triggering spell, and returns the total damage
// of a *fresh* Ignite triggered by that spell. Roll-over damage
// calculations for existing Ignites are handled internally.
type IgniteDamageCalculator func(result *core.SpellResult) float64

type IgniteConfig struct {
	ActionID           core.ActionID
	ClassSpellMask     int64
	SpellSchool        core.SpellSchool
	CritMultiplier     float64 // Optional crit multiplier in case the Ignite DoT can crit (Such as the legendary caster cloak)
	DisableCastMetrics bool
	DotAuraLabel       string
	DotAuraTag         string
	ProcTrigger        core.ProcTrigger // Ignores the Handler field and creates a custom one, but uses all others.
	DamageCalculator   IgniteDamageCalculator
	IncludeAuraDelay   bool // "munching" and "free roll-over" interactions
	NumberOfTicks      int32
	TickImmediately    bool
	OnTick             core.OnTick // Overrides default OnTick
	TickLength         time.Duration
	ParentAura         *core.Aura
}

func RegisterIgniteEffect(unit *core.Unit, config IgniteConfig) *core.Spell {
	spellFlags := core.SpellFlagIgnoreModifiers | core.SpellFlagNoSpellMods | core.SpellFlagNoOnCastComplete

	if config.DisableCastMetrics {
		spellFlags |= core.SpellFlagPassiveSpell
	}

	if config.SpellSchool == 0 {
		config.SpellSchool = core.SpellSchoolFire
	}

	if config.NumberOfTicks == 0 {
		config.NumberOfTicks = 2
	}

	if config.OnTick == nil {
		config.OnTick = func(sim *core.Simulation, target *core.Unit, dot *core.Dot) {
			dot.Spell.CalcAndDealPeriodicDamage(sim, target, dot.SnapshotBaseDamage, dot.OutcomeTick)
		}
	}

	if config.TickLength == 0 {
		config.TickLength = time.Second * 2
	}

	igniteSpell := unit.RegisterSpell(core.SpellConfig{
		ActionID:         config.ActionID,
		SpellSchool:      config.SpellSchool,
		ProcMask:         core.ProcMaskSpellProc,
		ClassSpellMask:   config.ClassSpellMask,
		Flags:            spellFlags,
		DamageMultiplier: 1,
		ThreatMultiplier: 1,
		CritMultiplier:   config.CritMultiplier,

		Dot: core.DotConfig{
			Aura: core.Aura{
				Label:     config.DotAuraLabel,
				Tag:       config.DotAuraTag,
				MaxStacks: math.MaxInt32,
			},

			NumberOfTicks:       config.NumberOfTicks,
			TickLength:          config.TickLength,
			AffectedByCastSpeed: false,

			OnTick: config.OnTick,
		},

		ApplyEffects: func(sim *core.Simulation, target *core.Unit, spell *core.Spell) {
			dot := spell.Dot(target)
			dot.Apply(sim)

			if config.TickImmediately {
				dot.TickOnce(sim)
			}
		},
	})

	refreshIgnite := func(sim *core.Simulation, target *core.Unit, damagePerTick float64) {
		// Cata Ignite
		// 1st ignite application = 4s, split into 2 ticks (2s, 0s)
		// Ignite refreshes: Duration = 4s + MODULO(remaining duration, 2), max 6s. Split damage over 3 ticks at 4s, 2s, 0s.
		dot := igniteSpell.Dot(target)
		dot.SnapshotBaseDamage = damagePerTick
		igniteSpell.Cast(sim, target)
		dot.Aura.SetStacks(sim, int32(dot.SnapshotBaseDamage))
	}

	var scheduledRefresh *core.PendingAction
	procTrigger := config.ProcTrigger
	procTrigger.TriggerImmediately = true
	procTrigger.Handler = func(sim *core.Simulation, _ *core.Spell, result *core.SpellResult) {
		target := result.Target
		dot := igniteSpell.Dot(target)
		outstandingDamage := dot.OutstandingDmg()
		newDamage := config.DamageCalculator(result)
		totalDamage := outstandingDamage + newDamage
		newTickCount := dot.BaseTickCount + core.TernaryInt32(dot.IsActive(), 1, 0)
		damagePerTick := totalDamage / float64(newTickCount)

		if config.IncludeAuraDelay {
			// Rough 2-bucket model for the aura update delay distribution based
			// on PTR measurements. Most updates occur on either the same or very
			// next spell batch after the proc, and can therefore be modeled by a
			// 0-10 ms random draw. But a reasonable minority fraction take ~10x
			// longer than this to fire. The origin of these longer delays is
			// likely not actually random in reality, but can be treated that way
			// in practice since the player cannot play around them.
			var delaySeconds float64

			if sim.Proc(0.75, "Aura Delay") {
				delaySeconds = 0.010 * sim.RandomFloat("Aura Delay")
			} else {
				delaySeconds = 0.090 + 0.020*sim.RandomFloat("Aura Delay")
			}

			applyDotAt := sim.CurrentTime + core.DurationFromSeconds(delaySeconds)

			// Cancel any prior aura updates already in the queue
			if (scheduledRefresh != nil) && (scheduledRefresh.NextActionAt > sim.CurrentTime) {
				scheduledRefresh.Cancel(sim)

				if sim.Log != nil {
					unit.Log(sim, "Previous %s proc was munched due to server aura delay", config.DotAuraLabel)
				}
			}

			// Schedule a delayed refresh of the DoT with cached damagePerTick value (allowing for "free roll-overs")
			if sim.Log != nil {
				unit.Log(sim, "Schedule travel (%0.1f ms) for %s", delaySeconds*1000, config.DotAuraLabel)

				if dot.IsActive() && (dot.NextTickAt() < applyDotAt) {
					unit.Log(sim, "%s rolled with %0.3f damage both ticking and rolled into next", config.DotAuraLabel, outstandingDamage)
				}
			}

			scheduledRefresh = core.NewDelayedAction(core.DelayedActionOptions{
				DoAt:     applyDotAt,
				Priority: core.ActionPriorityDOT,

				OnAction: func(_ *core.Simulation) {
					refreshIgnite(sim, target, damagePerTick)
				},
			})

			sim.AddPendingAction(scheduledRefresh)
		} else {
			refreshIgnite(sim, target, damagePerTick)
		}
	}

	if config.ParentAura != nil {
		config.ParentAura.AttachProcTrigger(procTrigger)
	} else {
		unit.MakeProcTriggerAura(procTrigger)
	}

	return igniteSpell
}

type ItemVersion byte

const (
	ItemVersionLFR = iota
	ItemVersionNormal
	ItemVersionHeroic
	ItemVersionThunderforged
	ItemVersionHeroicThunderforged
	ItemVersionWarforged
	ItemVersionHeroicWarforged
	ItemVersionFlexible
)

type ItemVersionMap map[ItemVersion]int32
type ItemVersionFactory func(version ItemVersion, id int32, versionLabel string)

func (version ItemVersion) GetLabel() string {
	switch version {
	case ItemVersionLFR:
		return "(Celestial)"
	case ItemVersionHeroic:
		return "(Heroic)"
	case ItemVersionThunderforged:
		return "(Thunderforged)"
	case ItemVersionHeroicThunderforged:
		return "(Heroic Thunderforged)"
	case ItemVersionWarforged:
		return "(Warforged)"
	case ItemVersionHeroicWarforged:
		return "(Heroic Warforged)"
	case ItemVersionFlexible:
		return "(Flex)"
	}
	return ""
}

func (versions ItemVersionMap) RegisterAll(fac ItemVersionFactory) {
	var maxItemID int32

	for _, id := range versions {
		maxItemID = max(maxItemID, id)
	}

	for version, id := range versions {
		core.AddEffectsToTest = (id == maxItemID)
		fac(version, id, version.GetLabel())
	}

	core.AddEffectsToTest = true
}

///////////////////////////////////////////////////////////////////////////
//							Item and enchant plumbing
///////////////////////////////////////////////////////////////////////////

// Which of the two registries an effect belongs to, item or enchant, and its ID within it. Those
// are the only things the two differ in; every helper above treats them identically. Resolving it
// once keeps the same isEnchant branch from being written out at each of the places that would
// otherwise need it.
type effectSource struct {
	id        int32
	isEnchant bool
}

// An enchant ID wins when both are set, because only a generated enchant effect fills it in.
func newEffectSource(itemID int32, enchantID int32) effectSource {
	if enchantID != 0 {
		return effectSource{id: enchantID, isEnchant: true}
	}

	return effectSource{id: itemID}
}

func (config ProcStatBonusEffect) effectSource() effectSource {
	return newEffectSource(config.ItemID, config.EnchantID)
}

func (config ActiveStatBonusEffect) effectSource() effectSource {
	return newEffectSource(config.ItemID, config.EnchantID)
}

func (config ProcDamageEffect) effectSource() effectSource {
	return newEffectSource(config.ItemID, config.EnchantID)
}

func (s effectSource) registerEffect(apply core.ApplyEffect) {
	if s.isEnchant {
		core.NewEnchantEffect(s.id, apply)
	} else {
		core.NewItemEffect(s.id, apply)
	}
}

// Whether a hand-written effect already covers this. That is the soft fail letting an override win
// over the generated registration, and it is why deleting one hands the generated version back.
func (s effectSource) isAlreadyImplemented() bool {
	if s.isEnchant {
		return core.HasEnchantEffect(s.id)
	}

	return core.HasItemEffect(s.id)
}

func (s effectSource) actionID() core.ActionID {
	if s.isEnchant {
		return core.ActionID{SpellID: s.id}
	}

	return core.ActionID{ItemID: s.id}
}

func (s effectSource) eligibleSlots(character *core.Character) []proto.ItemSlot {
	if s.isEnchant {
		return character.ItemSwap.EligibleSlotsForEffect(s.id)
	}

	return character.ItemSwap.EligibleSlotsForItem(s.id)
}

// Enchants have no upgrade levels, so they only ever carry the base state.
func (s effectSource) scalingState(state proto.ItemLevelState) proto.ItemLevelState {
	if s.isEnchant {
		return proto.ItemLevelState_Base
	}

	return state
}

// Every effect this item or enchant declares. A generated registration naming an entry that is not
// in the database is a database bug rather than a runtime case, so it fails loudly and identically
// for every caller.
func (s effectSource) declaredEffects() []*proto.ItemEffect {
	if s.isEnchant {
		ench := core.GetEnchantByEffectID(s.id)
		if ench == nil {
			panic(fmt.Sprintf("No enchant with effect ID: %d", s.id))
		}

		return ench.EnchantEffects
	}

	item := core.GetItemByID(s.id)
	if item == nil {
		panic(fmt.Sprintf("No item with ID: %d", s.id))
	}
	if len(item.ItemEffects) == 0 {
		panic(fmt.Sprintf("No effects data for item with ID: %d", s.id))
	}

	return item.ItemEffects
}

// The proc-carrying effects this item or enchant declares, keyed by the aura each one applies.
func (s effectSource) procEffects() map[int32]*proto.ItemEffect {
	procEffects := make(map[int32]*proto.ItemEffect)
	for _, effect := range s.declaredEffects() {
		if effect.GetProc() != nil {
			procEffects[effect.BuffId] = effect
		}
	}

	return procEffects
}

// How a generated on-use spell identifies itself. An item keys its cooldown on the item and labels
// it per effect; an enchant keys on the buff it applies and carries a single name for the whole
// enchant, which is the only name it has.
func (s effectSource) onUseIdentity(effect *proto.ItemEffect) (core.ActionID, string) {
	if s.isEnchant {
		return core.ActionID{SpellID: effect.BuffId}, core.GetEnchantByEffectID(s.id).Name
	}

	return core.ActionID{ItemID: s.id}, effect.BuffName
}

func (s effectSource) registerProc(character *core.Character, triggerAura *core.Aura, slots []proto.ItemSlot) {
	if s.isEnchant {
		character.ItemSwap.RegisterEnchantProcWithSlots(s.id, triggerAura, slots)
	} else {
		character.ItemSwap.RegisterProcWithSlots(s.id, triggerAura, slots)
	}
}

// A weapon enchant's buff has to drop when the weapon carrying it is swapped out. AddStatProcBuff
// only flips IsSwapped, which gates the next proc but leaves a running buff up for the rest of its
// duration. Gated on the enchant being a weapon enchant: RegisterWeaponEnchantBuff watches the
// weapon slots, so handing it a cloak or shield enchant would deactivate that buff on any weapon
// swap.
func (s effectSource) registerWeaponEnchantBuff(character *core.Character, procAura *core.StatBuffAura) {
	if !s.isEnchant {
		return
	}

	if ench := core.GetEnchantByEffectID(s.id); ench == nil || ench.Type != proto.ItemType_ItemTypeWeapon {
		return
	}

	character.ItemSwap.RegisterWeaponEnchantBuff(procAura.Aura, s.id)
}

// As registerProc, for the effects that do not narrow themselves to a set of slots.
func (s effectSource) registerProcAnySlot(character *core.Character, triggerAura *core.Aura) {
	if s.isEnchant {
		character.ItemSwap.RegisterEnchantProc(s.id, triggerAura)
	} else {
		character.ItemSwap.RegisterProc(s.id, triggerAura)
	}
}

// Share a cooldown only when the effect says it belongs to a category. One with no category shares
// nothing, and putting it on a generic trinket timer would gate it against unrelated items. The
// category IDs are core's own - 1141 is "Item - Burst Trinket", 1283 is "Engineering - Belt
// Enchantment".
func sharedCooldown(character *core.Character, effect *proto.ItemEffect) core.Cooldown {
	onUse := effect.GetOnUse()
	if onUse == nil || onUse.CategoryId <= 0 {
		return core.Cooldown{}
	}

	duration := time.Millisecond * time.Duration(onUse.CategoryCooldownMs)
	if duration <= 0 {
		duration = time.Millisecond * time.Duration(effect.EffectDurationMs)
	}

	return core.Cooldown{
		Timer:    character.GetOrInitSpellCategoryTimer(onUse.CategoryId),
		Duration: duration,
	}
}

// Registers the same effect once per item that carries it. Only the highest ID is added to the
// test suite, so that a dozen re-issues of one trinket do not each get their own fixture entry.
func forEachVariant(variants []ItemVariant, register func(variant ItemVariant)) {
	var maxItemID int32
	for _, variant := range variants {
		maxItemID = max(maxItemID, variant.ItemID)
	}

	for _, variant := range variants {
		core.AddEffectsToTest = (variant.ItemID == maxItemID)
		register(variant)
	}

	core.AddEffectsToTest = true
}

func RegisterRiposteEffect(character *core.Character, auraSpellID int32, triggerSpellID int32) {
	riposteAura := core.BlockPrepull(character.RegisterAura(core.Aura{
		Label:     "Riposte" + character.Label,
		ActionID:  core.ActionID{SpellID: auraSpellID},
		Duration:  time.Second * 20,
		MaxStacks: math.MaxInt32,

		OnStacksChange: func(aura *core.Aura, sim *core.Simulation, oldStacks, newStacks int32) {
			character.AddStatDynamic(sim, stats.CritRating, float64(newStacks-oldStacks))
		},
	}))

	var bonusCrit float64
	character.MakeProcTriggerAura(core.ProcTrigger{
		Name:     "Riposte Trigger" + character.Label,
		ActionID: core.ActionID{SpellID: triggerSpellID},
		Callback: core.CallbackOnSpellHitTaken,
		Outcome:  core.OutcomeDodge | core.OutcomeParry,
		ICD:      time.Second * 1,

		ExtraCondition: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) bool {
			bonusCrit = max(0, math.Round((character.GetStat(stats.DodgeRating)+character.GetParryRatingWithoutStrength())*0.75))
			return bonusCrit > 0
		},

		Handler: func(sim *core.Simulation, spell *core.Spell, result *core.SpellResult) {
			riposteAura.Activate(sim)
			riposteAura.SetStacks(sim, int32(bonusCrit))
		},
	})
}
