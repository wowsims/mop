package core

import (
	"fmt"

	"github.com/wowsims/mop/sim/core/proto"
)

type APLActionGroupReference struct {
	defaultAPLActionImpl
	groupName string
	variables map[string]*proto.APLValue
	group     *APLGroup
}

func (rot *APLRotation) newActionGroupReference(config *proto.APLActionGroupReference) APLActionImpl {
	if config == nil {
		return nil
	}

	vars := make(map[string]*proto.APLValue)
	for _, v := range config.Variables {
		vars[v.Name] = v.Value
	}

	return &APLActionGroupReference{
		groupName: config.GroupName,
		variables: vars,
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

	// Scan for VariablePlaceholder values in the group
	placeholders := map[string]struct{}{}
	for _, groupAction := range action.group.actions {
		// Check condition for placeholders
		if groupAction.condition != nil {
			action.scanForPlaceholders(groupAction.condition, placeholders)
		}
		// Check action implementation for placeholders
		if groupAction.impl != nil {
			action.scanActionForPlaceholders(groupAction.impl, placeholders)
		}
	}

	// Check that all placeholders are set
	for name := range placeholders {
		if _, ok := action.variables[name]; !ok {
			rot.ValidationMessage(proto.LogLevel_Error, "Group '%s' requires variable '%s' to be set via Variable Placeholder", action.groupName, name)
		}
	}

	// Replace placeholder values with provided variables
	for _, groupAction := range action.group.actions {
		// Replace placeholders in condition
		if groupAction.condition != nil {
			groupAction.condition = action.replacePlaceholders(groupAction.condition, action.variables, rot)
		}
		// Replace placeholders in action implementation
		if groupAction.impl != nil {
			action.replaceActionPlaceholders(groupAction.impl, action.variables, rot)
		}
	}

	// Add all provided variables to the group's variables map
	// This allows normal variable references to resolve to the provided values
	for k, v := range action.variables {
		action.group.variables[k] = v
	}

	// Re-resolve variable references in group actions with the updated group variables
	for _, groupAction := range action.group.actions {
		// Re-resolve the condition if it contains variable references
		if groupAction.condition != nil {
			groupAction.condition = rot.reResolveVariableRefs(groupAction.condition, action.group.variables)
		}
		// Re-resolve any variable references in the action implementation
		if groupAction.impl != nil {
			groupAction.impl.ReResolveVariableRefs(rot, action.group.variables)
		}
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

// Helper methods for placeholder handling

func (action *APLActionGroupReference) scanForPlaceholders(value APLValue, placeholders map[string]struct{}) {
	if value == nil {
		return
	}

	// Check if this value is a placeholder
	if placeholder, ok := value.(*APLValueVariablePlaceholder); ok {
		placeholders[placeholder.name] = struct{}{}
		return
	}

	// Recursively scan inner values
	for _, innerValue := range value.GetInnerValues() {
		action.scanForPlaceholders(innerValue, placeholders)
	}
}

func (action *APLActionGroupReference) scanActionForPlaceholders(actionImpl APLActionImpl, placeholders map[string]struct{}) {
	if actionImpl == nil {
		return
	}

	// Get all APL values from the action and scan them
	for _, value := range actionImpl.GetAPLValues() {
		action.scanForPlaceholders(value, placeholders)
	}
}

func (action *APLActionGroupReference) replacePlaceholders(value APLValue, variables map[string]*proto.APLValue, rot *APLRotation) APLValue {
	if value == nil {
		return nil
	}

	// Check if this value is a placeholder
	if placeholder, ok := value.(*APLValueVariablePlaceholder); ok {
		if replacement, ok := variables[placeholder.name]; ok {
			// Create a new value from the replacement
			return rot.newAPLValue(replacement)
		}
		return value // Keep original if no replacement found
	}

	// For composite values, recursively replace placeholders in inner values
	innerValues := value.GetInnerValues()
	if len(innerValues) > 0 {
		// Check if any inner values were replaced
		anyReplaced := false
		newInnerValues := make([]APLValue, len(innerValues))
		for i, innerValue := range innerValues {
			newInnerValues[i] = action.replacePlaceholders(innerValue, variables, rot)
			if newInnerValues[i] != innerValue {
				anyReplaced = true
			}
		}

		// If any inner values were replaced, we need to create a new value object
		if anyReplaced {
			// Handle specific value types that need special treatment
			switch v := value.(type) {
			case *APLValueCompare:
				// Re-coerce the types after replacement to ensure compatibility
				lhs, rhs := rot.coerceToSameType(newInnerValues[0], newInnerValues[1])
				return &APLValueCompare{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					op:                  v.op,
					lhs:                 lhs,
					rhs:                 rhs,
				}
			case *APLValueMath:
				// Re-coerce the types after replacement to ensure compatibility
				lhs, rhs := newInnerValues[0], newInnerValues[1]
				if v.op == proto.APLValueMath_OpAdd || v.op == proto.APLValueMath_OpSub {
					lhs, rhs = rot.coerceToSameType(lhs, rhs)
				}
				return &APLValueMath{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					op:                  v.op,
					lhs:                 lhs,
					rhs:                 rhs,
				}
			case *APLValueAnd:
				return &APLValueAnd{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					vals:                newInnerValues,
				}
			case *APLValueOr:
				return &APLValueOr{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					vals:                newInnerValues,
				}
			case *APLValueNot:
				return &APLValueNot{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					val:                 newInnerValues[0],
				}
			case *APLValueMax:
				return &APLValueMax{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					vals:                newInnerValues,
				}
			case *APLValueMin:
				return &APLValueMin{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					vals:                newInnerValues,
				}
			case *APLValueCoerced:
				return &APLValueCoerced{
					DefaultAPLValueImpl: v.DefaultAPLValueImpl,
					valueType:           v.valueType,
					inner:               newInnerValues[0],
				}
			default:
				// For other value types, we can't easily create new instances
				// so we'll return the original value
				return value
			}
		}
	}

	return value
}

func (action *APLActionGroupReference) replaceActionPlaceholders(actionImpl APLActionImpl, variables map[string]*proto.APLValue, rot *APLRotation) {
	if actionImpl == nil {
		return
	}

	// This is a simplified approach - in practice, you'd need to handle each action type specifically
	// For now, we'll rely on the value replacement in the main flow
}
