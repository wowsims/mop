package dbc

import (
	"bufio"
	_ "embed"
	"fmt"
	"strconv"
	"strings"
	"sync"
)

// The ItemSocketCostPerLevel game table, one ItemLevel/Cost pair per row. Vendored the same way
// SpellScaling.txt is: it is a client game table rather than a DB2 row set, so it is embedded
// rather than extracted into assets/db_inputs. The generated copy the extraction now writes to
// assets/db_inputs/basestats is the source to re-copy from when it changes.
//
//go:embed GameTables/ItemSocketCostPerLevel.txt
var itemSocketCostFile string

type itemSocketCostTable struct {
	byLevel  map[int]float64
	maxLevel int
}

var itemSocketCosts = sync.OnceValue(parseItemSocketCosts)

func parseItemSocketCosts() itemSocketCostTable {
	table := itemSocketCostTable{byLevel: make(map[int]float64)}

	scanner := bufio.NewScanner(strings.NewReader(itemSocketCostFile))
	scanner.Scan() // Skip the header line

	for scanner.Scan() {
		parts := strings.Fields(scanner.Text())
		if len(parts) < 2 {
			continue
		}

		level, err := strconv.Atoi(parts[0])
		if err != nil {
			continue
		}
		cost, err := strconv.ParseFloat(parts[1], 64)
		if err != nil {
			continue
		}

		table.byLevel[level] = cost
		if level > table.maxLevel {
			table.maxLevel = level
		}
	}

	// Every off-item-level stat is reduced by this cost, so an unreadable table would not fail
	// loudly - it would silently drop the socket penalty from every recomputed stat instead.
	if len(table.byLevel) == 0 {
		panic(fmt.Sprintf("ItemSocketCostPerLevel game table parsed to no rows (%d bytes embedded)", len(itemSocketCostFile)))
	}
	return table
}

// The stat budget one socket costs at the given item level.
func ItemSocketCostPerLevel(itemLevel int) float64 {
	table := itemSocketCosts()

	if cost, ok := table.byLevel[itemLevel]; ok {
		return cost
	}
	// The table stops at level 1000, far above anything MoP reaches. Beyond it the cost is flat.
	if itemLevel > table.maxLevel {
		return table.byLevel[table.maxLevel]
	}
	return 0
}
