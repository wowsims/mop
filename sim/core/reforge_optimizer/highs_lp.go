package reforgeoptimizer

import (
	"math"
	"strconv"
	"strings"
)

const highsLPMaxLineLength = 200

func modelToHiGHSLP(model mipModel) string {
	// Pre-size to avoid repeated doubling as the LP string grows.
	// Rough estimate: ~36 bytes/variable (objective term + binary line) + ~60 bytes/constraint.
	var builder strings.Builder
	builder.Grow(32 + len(model.variables)*36 + len(model.constraints)*60)
	builder.WriteString("Maximize\n")
	var objective strings.Builder
	objective.Grow(8 + len(model.variables)*28)
	objective.WriteString(" obj:")
	objectiveTerms := 0
	for variableIdx, variable := range model.variables {
		obj := variable.objective
		if obj == 0 {
			// Write a tiny negative penalty for zero-objective integer variables so
			// HiGHS branch-and-bound prefers leaving them unset rather than arbitrarily
			// fixing them to 1 (which it may do when objective coefficient is absent).
			// The penalty is negligible vs any real EP difference (< 1e-3 per unit).
			if !variable.integer {
				continue
			}
			obj = -1e-6
		}
		writeLPTerm(&objective, objectiveTerms == 0, obj, variableIdx)
		objectiveTerms++
	}
	if objectiveTerms == 0 {
		objective.WriteString(" 0")
	}
	for _, line := range wrapLPLine(objective.String()) {
		builder.WriteString(line)
		builder.WriteByte('\n')
	}

	builder.WriteString("Subject To\n")
	constraintIdx := 0
	for _, constraint := range model.constraints {
		if constraint.coefficientCount() == 0 {
			continue
		}
		if constraint.lower == constraint.upper {
			writeLPConstraint(&builder, constraintIdx, constraint, "=", constraint.upper)
			constraintIdx++
			continue
		}
		if !math.IsInf(constraint.upper, 1) {
			writeLPConstraint(&builder, constraintIdx, constraint, "<=", constraint.upper)
			constraintIdx++
		}
		if !math.IsInf(constraint.lower, -1) && constraint.lower != constraint.upper {
			writeLPConstraint(&builder, constraintIdx, constraint, ">=", constraint.lower)
			constraintIdx++
		}
	}

	builder.WriteString("Binary\n")
	for variableIdx := range model.variables {
		builder.WriteString(" x")
		builder.WriteString(strconv.Itoa(variableIdx))
		builder.WriteByte('\n')
	}
	builder.WriteString("End\n")
	return builder.String()
}

func writeLPConstraint(builder *strings.Builder, constraintIdx int, constraint mipConstraint, operator string, bound float64) {
	var line strings.Builder
	// Pre-size: ~10 chars header + ~28 chars/coefficient + ~20 chars operator+bound.
	line.Grow(10 + constraint.coefficientCount()*28 + 20)
	line.WriteString(" c")
	line.WriteString(strconv.Itoa(constraintIdx))
	line.WriteByte(':')
	for idx, variableIdx := range constraint.indices {
		writeLPTerm(&line, idx == 0, constraint.values[idx], variableIdx)
	}
	line.WriteByte(' ')
	line.WriteString(operator)
	line.WriteByte(' ')
	line.WriteString(formatLPNumber(bound))
	for _, wrappedLine := range wrapLPLine(line.String()) {
		builder.WriteString(wrappedLine)
		builder.WriteByte('\n')
	}
}

func writeLPTerm(builder *strings.Builder, first bool, coefficient float64, variableIdx int) {
	if first {
		if coefficient < 0 {
			builder.WriteString(" -")
		} else {
			builder.WriteByte(' ')
		}
	} else if coefficient < 0 {
		builder.WriteString(" - ")
	} else {
		builder.WriteString(" + ")
	}
	builder.WriteString(formatLPNumber(math.Abs(coefficient)))
	builder.WriteString(" x")
	builder.WriteString(strconv.Itoa(variableIdx))
}

func formatLPNumber(value float64) string {
	if math.IsInf(value, 1) {
		return "1e30"
	}
	if math.IsInf(value, -1) {
		return "-1e30"
	}
	return strconv.FormatFloat(value, 'f', 10, 64)
}

func wrapLPLine(line string) []string {
	if len(line) <= highsLPMaxLineLength {
		return []string{line}
	}
	fields := strings.Fields(line)
	if len(fields) == 0 {
		return []string{line}
	}
	lines := make([]string, 0, len(line)/highsLPMaxLineLength+1)
	current := fields[0]
	for _, field := range fields[1:] {
		if len(current)+1+len(field) <= highsLPMaxLineLength {
			current += " " + field
			continue
		}
		lines = append(lines, current)
		current = " " + field
	}
	lines = append(lines, current)
	return lines
}
