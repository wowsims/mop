package core

import (
	"fmt"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLActionGroupReference struct {
	defaultAPLActionImpl
	groupName         string
	variableOverrides map[string]string
	group             *APLGroup
}

func (rot *APLRotation) newActionGroupReference(config *proto.APLActionGroupReference) APLActionImpl {
	if config == nil {
		return nil
	}

	return &APLActionGroupReference{
		groupName:         config.GroupName,
		variableOverrides: config.VariableOverrides,
	}
}

func (action *APLActionGroupReference) GetInnerActions() []*APLAction {
	if action.group == nil {
		return nil
	}

	actions := make([]*APLAction, len(action.group.actions))
	for i, groupAction := range action.group.actions {
		actions[i] = groupAction
	}
	return actions
}

func (action *APLActionGroupReference) GetAPLValues() []APLValue {
	if action.group == nil {
		return nil
	}

	var values []APLValue
	for _, groupAction := range action.group.actions {
		values = append(values, groupAction.GetAllAPLValues()...)
	}
	return values
}

func (action *APLActionGroupReference) Finalize(rot *APLRotation) {
	// Find the referenced group
	for _, group := range rot.groups {
		if group.name == action.groupName {
			action.group = group
			break
		}
	}

	if action.group == nil {
		rot.ValidationMessage(proto.LogLevel_Error, "Group reference '%s' not found", action.groupName)
		return
	}

	// Apply variable overrides
	if len(action.variableOverrides) > 0 {
		// TODO: Implement variable substitution
		rot.ValidationMessage(proto.LogLevel_Warning, "Variable overrides not yet implemented for group '%s'", action.groupName)
	}

	// Finalize all actions in the group
	for _, groupAction := range action.group.actions {
		groupAction.Finalize(rot)
	}
}

func (action *APLActionGroupReference) Reset(sim *Simulation) {
	// No need to reset inner actions manually - the main APL rotation handles that
}

func (action *APLActionGroupReference) IsReady(sim *Simulation) bool {
	if action.group == nil {
		return false
	}

	// Check if any action in the group is ready
	for _, groupAction := range action.group.actions {
		if groupAction.IsReady(sim) {
			return true
		}
	}
	return false
}

func (action *APLActionGroupReference) Execute(sim *Simulation) {
	if action.group == nil {
		return
	}

	// Execute the first ready action in the group
	for _, groupAction := range action.group.actions {
		if groupAction.IsReady(sim) {
			groupAction.Execute(sim)
			return
		}
	}
}

func (action *APLActionGroupReference) String() string {
	return fmt.Sprintf("Group Reference: %s", action.groupName)
}
