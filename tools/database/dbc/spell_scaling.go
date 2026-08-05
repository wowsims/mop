package dbc

import (
	"bufio"
	_ "embed"
	"strconv"
	"strings"

	"github.com/wowsims/mop/sim/core/proto"
)

//go:embed GameTables/SpellScaling.txt
var spellScalingFile string

type SpellScaling struct {
	Level  int
	Values map[proto.Class]float64
}

func (dbc *DBC) LoadSpellScaling() error {
	columns := SpellScalingColumns()
	scanner := bufio.NewScanner(strings.NewReader(spellScalingFile))

	scanner.Scan() // Skip first line

	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		// One level column plus one per class and per generic curve. The previous guard only
		// required 14 fields while reading up to index 17.
		if len(parts) < len(columns)+1 {
			continue // consider handling or logging this situation
		}

		level, err := strconv.Atoi(parts[0])
		if err != nil {
			continue // consider handling or logging this situation
		}

		values := make(map[proto.Class]float64, len(columns))
		for i, class := range columns {
			values[class] = parseScalingValue(parts[i+1])
		}
		dbc.SpellScalings[level] = SpellScaling{Level: level, Values: values}
	}

	return scanner.Err()
}

func (dbc *DBC) SpellScaling(class proto.Class, level int) float64 {
	if scaling, ok := dbc.SpellScalings[level]; ok {
		if value, ok := scaling.Values[class]; ok {
			return value
		}
	}
	return 0.0 // return a default or error value if not found
}

func parseScalingValue(value string) float64 {
	v, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return 0.0 // consider how to handle or log this error properly
	}
	return v
}
