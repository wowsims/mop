// FDID resolution: a static path→FDID map for the configured tables/gametables
// (primary; FDIDs are stable per path), with the community listfile.csv as the
// fallback for paths not in the map. Lookups use plain case-normalized paths.

package tact

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// staticFDIDs was generated from the community listfile for the 80 paths the
// generator settings reference (72 dbfilesclient/*.db2 + 8 gametables/*.txt),
// build 5.5.4.68571 snapshot. Keys are lowercase game paths.
var staticFDIDs = map[string]uint32{
	"dbfilesclient/areatable.db2":                  1353545,
	"dbfilesclient/armorlocation.db2":              1284818,
	"dbfilesclient/curve.db2":                      892585,
	"dbfilesclient/curvepoint.db2":                 892586,
	"dbfilesclient/difficulty.db2":                 1352127,
	"dbfilesclient/faction.db2":                    1361972,
	"dbfilesclient/gemproperties.db2":              1343604,
	"dbfilesclient/glyphproperties.db2":            1345274,
	"dbfilesclient/item.db2":                       841626,
	"dbfilesclient/itemarmorquality.db2":           1283021,
	"dbfilesclient/itemarmorshield.db2":            1277741,
	"dbfilesclient/itemarmortotal.db2":             1283022,
	"dbfilesclient/itembonus.db2":                  959070,
	"dbfilesclient/itemclass.db2":                  1140189,
	"dbfilesclient/itemdamageammo.db2":             1277740,
	"dbfilesclient/itemdamageonehand.db2":          1277743,
	"dbfilesclient/itemdamageonehandcaster.db2":    1277739,
	"dbfilesclient/itemdamageranged.db2":           6156256,
	"dbfilesclient/itemdamagethrown.db2":           6156257,
	"dbfilesclient/itemdamagetwohand.db2":          1277738,
	"dbfilesclient/itemdamagetwohandcaster.db2":    1277742,
	"dbfilesclient/itemdamagewand.db2":             6156258,
	"dbfilesclient/itemeffect.db2":                 969941,
	"dbfilesclient/itemextendedcost.db2":           801681,
	"dbfilesclient/itemnamedescription.db2":        1332559,
	"dbfilesclient/itemrandomproperties.db2":       1237441,
	"dbfilesclient/itemrandomsuffix.db2":           1237592,
	"dbfilesclient/itemreforge.db2":                5633983,
	"dbfilesclient/itemset.db2":                    1343609,
	"dbfilesclient/itemsetspell.db2":               1314689,
	"dbfilesclient/itemsparse.db2":                 1572924,
	"dbfilesclient/itemsubclass.db2":               1261604,
	"dbfilesclient/itemsubclassmask.db2":           1302852,
	"dbfilesclient/itemupgrade.db2":                801687,
	"dbfilesclient/journalencounter.db2":           1240336,
	"dbfilesclient/journalencounteritem.db2":       1344467,
	"dbfilesclient/journalinstance.db2":            1237438,
	"dbfilesclient/map.db2":                        1349477,
	"dbfilesclient/randproppoints.db2":             1310245,
	"dbfilesclient/rulesetitemupgrade.db2":         801749,
	"dbfilesclient/scalingstatdistribution.db2":    1141728,
	"dbfilesclient/skillline.db2":                  1240935,
	"dbfilesclient/skilllineability.db2":           1266278,
	"dbfilesclient/spell.db2":                      1140089,
	"dbfilesclient/spellauraoptions.db2":           1139952,
	"dbfilesclient/spellcategories.db2":            1139939,
	"dbfilesclient/spellcategory.db2":              1280619,
	"dbfilesclient/spellclassoptions.db2":          979663,
	"dbfilesclient/spellcooldowns.db2":             1139924,
	"dbfilesclient/spelldescriptionvariables.db2":  1140004,
	"dbfilesclient/spellduration.db2":              1137828,
	"dbfilesclient/spelleffect.db2":                1140088,
	"dbfilesclient/spellequippeditems.db2":         1140011,
	"dbfilesclient/spellinterrupts.db2":            1139906,
	"dbfilesclient/spellitemenchantment.db2":       1362771,
	"dbfilesclient/spelllabel.db2":                 1347275,
	"dbfilesclient/spelllevels.db2":                1140079,
	"dbfilesclient/spellmechanic.db2":              1014438,
	"dbfilesclient/spellmisc.db2":                  1003144,
	"dbfilesclient/spellname.db2":                  1990283,
	"dbfilesclient/spellpower.db2":                 982806,
	"dbfilesclient/spellprocsperminute.db2":        1133526,
	"dbfilesclient/spellprocsperminutemod.db2":     1133525,
	"dbfilesclient/spellradius.db2":                1134584,
	"dbfilesclient/spellrange.db2":                 1146820,
	"dbfilesclient/spellreagents.db2":              841946,
	"dbfilesclient/spellscaling.db2":               1139940,
	"dbfilesclient/spellshapeshift.db2":            1139929,
	"dbfilesclient/spelltargetrestrictions.db2":    1139993,
	"dbfilesclient/spellxdescriptionvariables.db2": 1724949,
	"dbfilesclient/talent.db2":                     1369062,
	"dbfilesclient/talenttab.db2":                  2178102,
	"gametables/chancetomeleecrit.txt":             3999262,
	"gametables/chancetomeleecritbase.txt":         3999263,
	"gametables/chancetospellcrit.txt":             3999265,
	"gametables/chancetospellcritbase.txt":         3999264,
	"gametables/combatratings.txt":                 1391669,
	"gametables/octbasehpbyclass.txt":              5464960,
	"gametables/octbasempbyclass.txt":              4049853,
	"gametables/spellscaling.txt":                  1391660,
}

// GetFDID resolves a game path (e.g. "dbfilesclient/Spell.db2") to its file
// data id: static map first, then the listfile (loaded lazily). The lookup
// key is the raw game path, lowercased — never a filesystem-resolved path.
func (l *Listfile) GetFDID(path string) (uint32, error) {
	key := strings.ToLower(path)
	if fdid, ok := staticFDIDs[key]; ok {
		return fdid, nil
	}
	if err := l.load(); err != nil {
		return 0, fmt.Errorf("resolving %q: %w", path, err)
	}
	if fdid, ok := l.byPath[key]; ok {
		return fdid, nil
	}
	return 0, fmt.Errorf("path %q not found in static FDID map or listfile", path)
}

// load parses the listfile lazily (FDID;path per line).
func (l *Listfile) load() error {
	if l.byPath != nil {
		return nil
	}
	f, err := os.Open(l.Path)
	if err != nil {
		return err
	}
	defer f.Close()
	l.byPath = make(map[string]uint32, 4<<20)
	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 1<<20), 1<<20)
	for scanner.Scan() {
		line := scanner.Text()
		sep := strings.IndexByte(line, ';')
		if sep < 0 {
			continue
		}
		fdid, err := strconv.ParseUint(line[:sep], 10, 32)
		if err != nil {
			continue
		}
		l.byPath[strings.ToLower(line[sep+1:])] = uint32(fdid)
	}
	return scanner.Err()
}
