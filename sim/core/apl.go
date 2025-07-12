package core

import (
	"fmt"
	"time"

	"github.com/wowsims/mop/sim/core/proto"
	"google.golang.org/protobuf/encoding/protojson"
)

type APLRotation struct {
	unit           *Unit
	prepullActions []*APLAction
	priorityList   []*APLAction
	groups         []*APLGroup
	valueVariables []*APLValueVariable

	// Action currently controlling this rotation (only used for certain actions, such as StrictSequence).
	controllingActions []APLActionImpl

	// Value that should evaluate to 'true' if the current channel is to be interrupted.
	// Will be nil when there is no active channel.
	interruptChannelIf APLValue

	// If true, can recast channel when interrupted.
	allowChannelRecastOnInterrupt bool

	// Used inside of actions/value to determine whether they will occur during the prepull or regular rotation.
	parsingPrepull bool

	// Used to avoid recursive APL loops.
	inLoop bool

	// Used to override MCD restrictions within sequences.
	inSequence bool

	// Validation warnings that occur during proto parsing.
	// We return these back to the user for display in the UI.
	curValidations          []*proto.APLValidation
	prepullValidations      [][]*proto.APLValidation
	priorityListValidations [][]*proto.APLValidation
	uuidValidations         map[*proto.UUID][]*proto.APLValidation

	// Maps indices in filtered sim lists to indices in configs.
	prepullIdxMap      []int
	priorityListIdxMap []int
}

type APLGroup struct {
	name      string
	actions   []*APLAction
	variables map[string]*proto.APLValue
}

type APLValueVariable struct {
	name  string
	value *proto.APLValue
}

func (rot *APLRotation) ValidationMessage(log_level proto.LogLevel, message string, vals ...interface{}) {
	formatted_message := fmt.Sprintf(message, vals...)
	rot.curValidations = append(rot.curValidations, &proto.APLValidation{
		LogLevel:   log_level,
		Validation: formatted_message,
	})
}

func (rot *APLRotation) ValidationMessageByUUID(uuid *proto.UUID, log_level proto.LogLevel, message string, vals ...interface{}) {
	if uuid != nil {
		formatted_message := fmt.Sprintf(message, vals...)
		rot.uuidValidations[uuid] = append(rot.uuidValidations[uuid], &proto.APLValidation{
			LogLevel:   log_level,
			Validation: formatted_message,
		})
	}
}

// Invokes the fn function, and attributes all warnings generated during its invocation
// to the provided warningsList.
func (rot *APLRotation) doAndRecordWarnings(warningsList *[]*proto.APLValidation, isPrepull bool, fn func()) {
	rot.parsingPrepull = isPrepull
	fn()
	if warningsList != nil {
		*warningsList = append(*warningsList, rot.curValidations...)
	}
	rot.curValidations = nil
	rot.parsingPrepull = false
}

func (unit *Unit) newCustomRotation() *APLRotation {
	return unit.newAPLRotation(&proto.APLRotation{
		Type: proto.APLRotation_TypeAPL,
		PriorityList: []*proto.APLListItem{
			{
				Action: &proto.APLAction{
					Action: &proto.APLAction_CustomRotation{},
				},
			},
		},
	})
}

func (unit *Unit) newAPLRotation(config *proto.APLRotation) *APLRotation {
	if config == nil {
		return nil
	}

	rotation := &APLRotation{
		unit:                    unit,
		prepullValidations:      make([][]*proto.APLValidation, len(config.PrepullActions)),
		priorityListValidations: make([][]*proto.APLValidation, len(config.PriorityList)),
		uuidValidations:         make(map[*proto.UUID][]*proto.APLValidation),
	}

	// Parse value variables FIRST, before any actions that might reference them
	for _, condVar := range config.ValueVariables {
		rotation.valueVariables = append(rotation.valueVariables, &APLValueVariable{
			name:  condVar.Name,
			value: condVar.Value,
		})
	}

	// Parse prepull actions
	for i, prepullItem := range config.PrepullActions {
		prepullIdx := i // Save to local variable for correct lambda capture behavior
		rotation.doAndRecordWarnings(&rotation.prepullValidations[prepullIdx], true, func() {
			if !prepullItem.Hide {
				doAtVal := rotation.newAPLValue(prepullItem.DoAtValue)
				if doAtVal != nil {
					doAt := doAtVal.GetDuration(nil)
					if doAt > 0 {
						rotation.ValidationMessage(proto.LogLevel_Warning, "Invalid time for 'Do At', ignoring this Prepull Action")
					} else {
						action := rotation.newAPLAction(prepullItem.Action)
						if action != nil {
							rotation.prepullActions = append(rotation.prepullActions, action)
							rotation.prepullIdxMap = append(rotation.prepullIdxMap, prepullIdx)
							unit.RegisterPrepullAction(doAt, func(sim *Simulation) {
								// Warnings for prepull cast failure are detected by running a fake prepull,
								// so this action.Execute needs to record warnings.
								rotation.doAndRecordWarnings(&rotation.prepullValidations[prepullIdx], true, func() {
									action.Execute(sim)
								})
							})
						}
					}
				}
			}
		})
	}

	// Parse priority list
	for i, aplItem := range config.PriorityList {
		rotation.doAndRecordWarnings(&rotation.priorityListValidations[i], false, func() {
			if !aplItem.Hide {
				action := rotation.newAPLAction(aplItem.Action)
				if action != nil {
					rotation.priorityList = append(rotation.priorityList, action)
					rotation.priorityListIdxMap = append(rotation.priorityListIdxMap, i)
				}
			}
		})
	}

	// Parse groups
	for _, groupConfig := range config.Groups {
		group := &APLGroup{
			name:      groupConfig.Name,
			variables: make(map[string]*proto.APLValue),
		}

		for _, varConfig := range groupConfig.Variables {
			group.variables[varConfig.Name] = varConfig.Value
		}

		// Parse actions in the group
		for _, aplItem := range groupConfig.Actions {
			if !aplItem.Hide {
				// Don't pass group.variables here - placeholders should remain as placeholders
				// until the group is actually referenced with specific variable values
				action := rotation.newAPLActionWithGroupVars(aplItem.Action, nil)
				if action != nil {
					group.actions = append(group.actions, action)
				}
			}
		}

		rotation.groups = append(rotation.groups, group)
	}

	// Finalize
	for i, action := range rotation.prepullActions {
		rotation.doAndRecordWarnings(&rotation.prepullValidations[rotation.prepullIdxMap[i]], true, func() {
			action.Finalize(rotation)
		})
	}
	for i, action := range rotation.priorityList {
		rotation.doAndRecordWarnings(&rotation.priorityListValidations[rotation.priorityListIdxMap[i]], false, func() {
			action.Finalize(rotation)
		})
	}

	agent := unit.Env.GetAgentFromUnit(unit)
	if agent != nil {
		character := agent.GetCharacter()

		// Remove MCDs that are referenced by APL actions, so that the Autocast Other Cooldowns
		// action does not include them.
		for _, action := range rotation.allAPLActions() {
			if castSpellAction, ok := action.impl.(*APLActionCastSpell); ok {
				character.removeInitialMajorCooldown(castSpellAction.spell.ActionID)
			}
			if castFriendlySpellAction, ok := action.impl.(*APLActionCastFriendlySpell); ok {
				character.removeInitialMajorCooldown(castFriendlySpellAction.spell.ActionID)
			}
		}

		// If user has Item Swapping enabled and hasn't swapped back to the main set do it here.
		if character != nil && character.ItemSwap.IsEnabled() {
			skipItemSwapCheck := true
			hasMainSwap := false
			for _, prepullAction := range rotation.allPrepullActions() {
				if action, ok := prepullAction.impl.(*APLActionItemSwap); ok {
					hasMainSwap = action.swapSet == proto.APLActionItemSwap_Main
					skipItemSwapCheck = false
				}
			}
			if !skipItemSwapCheck && !hasMainSwap {
				unit.RegisterPrepullAction(-1, func(sim *Simulation) {
					character.ItemSwap.SwapItems(sim, proto.APLActionItemSwap_Main, false)
				})
			}
		}
	}

	// If user has a Prepull potion set but does not use it in their APL settings, we enable it here.
	rotation.doAndRecordWarnings(nil, true, func() {
		prepotSpell := rotation.GetAPLSpell(ActionID{OtherID: proto.OtherAction_OtherActionPotion}.ToProto())
		if prepotSpell != nil {
			found := false
			for _, prepullAction := range rotation.allPrepullActions() {
				if castSpellAction, ok := prepullAction.impl.(*APLActionCastSpell); ok &&
					(castSpellAction.spell == prepotSpell || castSpellAction.spell.Flags.Matches(SpellFlagPotion)) {
					found = true
				}
			}
			if !found {
				unit.RegisterPrepullAction(-1*time.Second, func(sim *Simulation) {
					prepotSpell.Cast(sim, nil)
				})
			}
		}
	})

	return rotation
}

func (rot *APLRotation) getStats() *proto.APLStats {
	// Perform one final round of validation after post-finalize effects.
	for i, action := range rot.prepullActions {
		rot.doAndRecordWarnings(&rot.prepullValidations[rot.prepullIdxMap[i]], true, func() {
			action.impl.PostFinalize(rot)
		})
	}
	for i, action := range rot.priorityList {
		rot.doAndRecordWarnings(&rot.priorityListValidations[rot.priorityListIdxMap[i]], false, func() {
			action.impl.PostFinalize(rot)
		})
	}

	uuidValidationsArr := make([]*proto.UUIDValidations, len(rot.uuidValidations))
	i := 0
	for uuid, validations := range rot.uuidValidations {
		uuidValidationsArr[i] = &proto.UUIDValidations{
			Uuid:        uuid,
			Validations: validations,
		}
		i++
	}

	return &proto.APLStats{
		PrepullActions: MapSlice(rot.prepullValidations, func(validations []*proto.APLValidation) *proto.APLActionStats {
			return &proto.APLActionStats{Validations: validations}
		}),
		PriorityList: MapSlice(rot.priorityListValidations, func(validations []*proto.APLValidation) *proto.APLActionStats {
			return &proto.APLActionStats{Validations: validations}
		}),
		UuidValidations: uuidValidationsArr,
	}
}

func (rot *APLRotation) allAPLActions() []*APLAction {
	if rot == nil || rot.priorityList == nil {
		return []*APLAction{}
	}

	return Flatten(MapSlice(rot.priorityList, func(action *APLAction) []*APLAction {
		// Check if action is nil before calling GetAllActions
		if action == nil {
			return []*APLAction{}
		}
		return action.GetAllActions()
	}))
}

// Returns all action objects from the prepull as an unstructured list. Used for easily finding specific actions.
func (rot *APLRotation) allPrepullActions() []*APLAction {
	return Flatten(MapSlice(rot.prepullActions, func(action *APLAction) []*APLAction { return action.GetAllActions() }))
}

func (rot *APLRotation) reset(sim *Simulation) {
	rot.controllingActions = nil
	rot.inLoop = false
	rot.interruptChannelIf = nil
	rot.allowChannelRecastOnInterrupt = false
	for _, action := range rot.allAPLActions() {
		action.impl.Reset(sim)
	}
}

// We intentionally try to mimic the behavior of simc APL to avoid confusion
// and leverage the community's existing familiarity.
// https://github.com/simulationcraft/simc/wiki/ActionLists
func (apl *APLRotation) DoNextAction(sim *Simulation) {
	if sim.CurrentTime < 0 {
		return
	}

	if apl.inLoop {
		return
	}

	if apl.unit.IsChanneling() && !apl.unit.ChanneledDot.Spell.Flags.Matches(SpellFlagCastWhileChanneling) {
		return
	}

	if !apl.unit.RotationTimer.IsReady(sim) {
		return
	}

	i := 0
	apl.inLoop = true

	apl.unit.UpdatePosition(sim)
	for nextAction := apl.getNextAction(sim); nextAction != nil; i, nextAction = i+1, apl.getNextAction(sim) {
		if i > 1000 {
			panic(fmt.Sprintf("[USER_ERROR] Infinite loop detected, current action:\n%s", nextAction))
		}

		nextAction.Execute(sim)
	}
	apl.inLoop = false

	if sim.Log != nil && i == 0 {
		apl.unit.Log(sim, "No available actions!")
	}

	// Schedule the next rotation evaluation based on either the GCD or reaction time
	if apl.unit.RotationTimer.IsReady(sim) {
		nextEvaluation := sim.CurrentTime + apl.unit.ReactionTime

		if !apl.unit.Moving {
			nextEvaluation = max(nextEvaluation, apl.unit.NextGCDAt())
		}

		apl.unit.WaitUntil(sim, nextEvaluation)
	}
}

func (apl *APLRotation) getNextAction(sim *Simulation) *APLAction {
	if len(apl.controllingActions) != 0 {
		return apl.controllingActions[len(apl.controllingActions)-1].GetNextAction(sim)
	}

	for _, action := range apl.priorityList {
		if action.IsReady(sim) {
			return action
		}
	}

	return nil
}

func (apl *APLRotation) pushControllingAction(ca APLActionImpl) {
	apl.controllingActions = append(apl.controllingActions, ca)
}

func (apl *APLRotation) popControllingAction(ca APLActionImpl) {
	if len(apl.controllingActions) == 0 || apl.controllingActions[len(apl.controllingActions)-1] != ca {
		panic("Wrong APL controllingAction in pop()")
	}
	apl.controllingActions = apl.controllingActions[:len(apl.controllingActions)-1]
}

func (apl *APLRotation) shouldInterruptChannel(sim *Simulation) bool {
	channeledDot := apl.unit.ChanneledDot

	if !channeledDot.ChannelCanBeInterrupted(sim) {
		return false
	}

	// Allow next action to interrupt the channel, but if the action is the same action then it still needs to continue.
	nextAction := apl.getNextAction(sim)
	if nextAction == nil {
		return false
	}

	if channelAction, ok := nextAction.impl.(*APLActionChannelSpell); ok && channelAction.spell == channeledDot.Spell {
		// Newly selected action is channeling the same spell, so continue the channel unless recast is allowed.
		return apl.allowChannelRecastOnInterrupt
	}

	return true
}

func APLRotationFromJsonString(jsonString string) *proto.APLRotation {
	apl := &proto.APLRotation{}
	data := []byte(jsonString)
	if err := protojson.Unmarshal(data, apl); err != nil {
		panic(err)
	}
	return apl
}

// Add newAPLActionWithGroupVars to propagate groupVars to action condition and impl
func (rot *APLRotation) newAPLActionWithGroupVars(config *proto.APLAction, groupVars map[string]*proto.APLValue) *APLAction {
	if config == nil {
		return nil
	}

	action := &APLAction{
		condition: rot.coerceTo(rot.newAPLValueWithContext(config.Condition, groupVars), proto.APLValueType_ValueTypeBool),
		impl:      rot.newAPLActionImpl(config),
	}

	if action.impl == nil {
		return nil
	} else {
		return action
	}
}

// Re-resolve variable references in an APLValue with updated group variables
func (rot *APLRotation) reResolveVariableRefs(value APLValue, groupVars map[string]*proto.APLValue) APLValue {
	if value == nil {
		return nil
	}

	// Check if this is a variable reference that needs re-resolving
	if varRef, ok := value.(*APLValueVariableRef); ok {
		// Re-resolve the variable reference with the updated group variables
		if groupVars != nil {
			if val, ok := groupVars[varRef.name]; ok {
				resolved := rot.newAPLValue(val)
				if resolved != nil {
					// Update the original variable reference instead of creating a new one
					varRef.resolved = resolved
					return varRef
				}
			}
		}

		// Fall back to global value variables
		for _, condVar := range rot.valueVariables {
			if condVar.name == varRef.name {
				resolved := rot.newAPLValue(condVar.value)
				if resolved != nil {
					// Update the original variable reference instead of creating a new one
					varRef.resolved = resolved
					return varRef
				}
			}
		}
	}

	// For other value types, recursively re-resolve their inner values
	innerValues := value.GetInnerValues()
	if len(innerValues) > 0 {
		for i, innerValue := range innerValues {
			innerValues[i] = rot.reResolveVariableRefs(innerValue, groupVars)
		}
	}

	return value
}
