package core

import (
	"errors"
	"fmt"
	"math"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/wowsims/mop/sim/core/proto"
	"github.com/wowsims/mop/sim/core/stats"
	"google.golang.org/protobuf/encoding/prototext"
)

// Precise enough to detect very small changes to test results, but truncated
// enough that we don't have flaky tests due to different OS/Go versions with
// different float rounding behavior.
const storagePrecision = 5

type IndividualTestSuite struct {
	Name string

	// Names of all the tests, in the order they are tested.
	testNames []string

	testResults *proto.TestSuiteResult
}

func NewIndividualTestSuite(suiteName string) *IndividualTestSuite {
	return &IndividualTestSuite{
		Name:        suiteName,
		testResults: newTestSuiteResult(),
	}
}

func (testSuite *IndividualTestSuite) TestCharacterStats(testName string, csr *proto.ComputeStatsRequest) {
	testSuite.testNames = append(testSuite.testNames, testName)

	result := ComputeStats(csr)
	finalStats := stats.FromUnitStatsProto(result.RaidStats.Parties[0].Players[0].FinalStats)

	testSuite.testResults.CharacterStatsResults[testName] = &proto.CharacterStatsTestResult{
		FinalStats: toFixedStats(finalStats[:], storagePrecision),
	}
}

func (testSuite *IndividualTestSuite) TestStatWeights(testName string, swr *proto.StatWeightsRequest) {
	testSuite.testNames = append(testSuite.testNames, testName)

	result := StatWeights(swr)
	weights := stats.FromUnitStatsProto(result.Dps.EpValues)

	testSuite.testResults.StatWeightsResults[testName] = &proto.StatWeightsTestResult{
		Weights: toFixedStats(weights[:], storagePrecision),
	}
}

func (testSuite *IndividualTestSuite) TestDPS(testName string, rsr *proto.RaidSimRequest) *proto.RaidSimResult {
	testSuite.testNames = append(testSuite.testNames, testName)

	result := RunRaidSim(rsr)
	if result.Logs != "" {
		fmt.Printf("LOGS: %s\n", result.Logs)
	}
	if result.Error != nil {
		panic("simulation failed to run: " + result.Error.Message)
	}
	testSuite.testResults.DpsResults[testName] = &proto.DpsTestResult{
		Dps:  toFixed(result.RaidMetrics.Dps.Avg, storagePrecision),
		Tps:  toFixed(result.RaidMetrics.Parties[0].Players[0].Threat.Avg, storagePrecision),
		Dtps: toFixed(result.RaidMetrics.Parties[0].Players[0].Dtps.Avg, storagePrecision),
		Hps:  toFixed(result.RaidMetrics.Parties[0].Players[0].Hps.Avg, storagePrecision),
	}

	return result
}

type ResetTestResult struct {
	BaseDps   float64
	BaseHps   float64
	BaseTps   float64
	BaseDtps  float64
	SplitDps  float64
	SplitHps  float64
	SplitTps  float64
	SplitDtps float64
}

func (testSuite *IndividualTestSuite) TestCasts(testName string, rsr *proto.RaidSimRequest) {
	testSuite.testNames = append(testSuite.testNames, testName)
	result := RunRaidSim(rsr)
	if result.Logs != "" {
		fmt.Printf("LOGS: %s\n", result.Logs)
	}
	if result.Error != nil {
		panic("simulation failed to run: " + result.Error.Message)
	}
	castsByAction := make(map[string]float64, 0)
	for _, metric := range result.RaidMetrics.Parties[0].Players[0].Actions {
		name := metric.Id.String()
		name = strings.ReplaceAll(name, "  ", " ")
		for _, targetMetrics := range metric.Targets {
			if val, ok := castsByAction[name]; ok {
				castsByAction[name] = val + float64(targetMetrics.Casts)
			} else {
				castsByAction[name] = float64(targetMetrics.Casts)
			}
		}
		castsByAction[name] /= float64(rsr.SimOptions.Iterations)
		castsByAction[name] *= 10
		castsByAction[name] = math.Round(castsByAction[name]) / 10.0
	}
	casts := &proto.CastsTestResult{Casts: castsByAction}
	testSuite.testResults.CastsResults[testName] = casts
}

func (testSuite *IndividualTestSuite) Done(t *testing.T) {
	testSuite.writeToFile()
}

const tolerance = 0.00001

func (testSuite *IndividualTestSuite) writeToFile() {
	str := prototext.Format(testSuite.testResults)
	// For some reason the formatter sometimes outputs 2 spaces instead of one.
	// Replace so we get consistent output.
	str = strings.ReplaceAll(str, "  ", " ")
	data := []byte(str)

	err := os.WriteFile(testSuite.Name+".results.tmp", data, 0644)
	if err != nil {
		panic(err)
	}
}

func (testSuite *IndividualTestSuite) readExpectedResults() (*proto.TestSuiteResult, error) {
	data, err := os.ReadFile(testSuite.Name + ".results")
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return newTestSuiteResult(), nil
		}
		return nil, err
	}

	results := &proto.TestSuiteResult{}
	if err = prototext.Unmarshal(data, results); err != nil {
		return nil, err
	}
	return results, err
}

func newTestSuiteResult() *proto.TestSuiteResult {
	return &proto.TestSuiteResult{
		CharacterStatsResults: make(map[string]*proto.CharacterStatsTestResult),
		StatWeightsResults:    make(map[string]*proto.StatWeightsTestResult),
		DpsResults:            make(map[string]*proto.DpsTestResult),
		CastsResults:          make(map[string]*proto.CastsTestResult),
	}
}

type TestGenerator interface {
	// The total number of tests that this generator can generate.
	NumTests() int

	// The name and API request for the test with the given index.
	GetTest(testIdx int) (string, *proto.ComputeStatsRequest, *proto.StatWeightsRequest, *proto.RaidSimRequest)
}

func RunTestSuite(t *testing.T, suiteName string, generator TestGenerator) {
	testSuite := NewIndividualTestSuite(suiteName)
	var currentTestName string

	defer func() {
		if p := recover(); p != nil {
			panic(fmt.Sprintf("Panic during test %s: %v", currentTestName, p))
		}
	}()

	expectedResults, err := testSuite.readExpectedResults()
	if err != nil {
		t.Logf("\n\n----- FAILURE LOADING RESULTS FILE TESTS WILL FAIL-----\n%s\n-----\n\n", err)
		t.Fail()
	}

	stopTest := false
	numTests := generator.NumTests()
	for i := 0; i < numTests; i++ {
		if stopTest {
			break
		}

		testName, csr, swr, rsr := generator.GetTest(i)
		if strings.Contains(testName, "Average") && testing.Short() {
			continue
		}
		currentTestName = testName

		t.Run(currentTestName, func(t *testing.T) {
			fullTestName := suiteName + "-" + testName
			if csr != nil {
				testSuite.TestCharacterStats(fullTestName, csr)
				if actualCharacterStats, ok := testSuite.testResults.CharacterStatsResults[fullTestName]; ok {
					actualStats := stats.FromProtoArray(actualCharacterStats.FinalStats)
					if expectedCharacterStats, ok := expectedResults.CharacterStatsResults[fullTestName]; ok {
						expectedStats := stats.FromProtoArray(expectedCharacterStats.FinalStats)
						if !actualStats.EqualsWithTolerance(expectedStats, tolerance) {
							t.Logf("Stats expected %v but was %v", expectedStats, actualStats)
							t.Fail()
						}
					} else {
						t.Logf("Unexpected test %s with stats: %v", fullTestName, actualStats)
						t.Fail()
					}
				} else if !ok {
					t.Logf("Missing Result for test %s", fullTestName)
					t.Fail()
				}
			} else if swr != nil {
				testSuite.TestStatWeights(fullTestName, swr)
				if actualStatWeights, ok := testSuite.testResults.StatWeightsResults[fullTestName]; ok {
					actualWeights := stats.FromProtoArray(actualStatWeights.Weights)
					if expectedStatWeights, ok := expectedResults.StatWeightsResults[fullTestName]; ok {
						expectedWeights := stats.FromProtoArray(expectedStatWeights.Weights)
						if !actualWeights.EqualsWithTolerance(expectedWeights, tolerance) {
							t.Logf("Weights expected %v but was %v", expectedWeights, actualWeights)
							t.Fail()
						}
					} else {
						t.Logf("Unexpected test %s with stat weights: %v", fullTestName, actualWeights)
						t.Fail()
					}
				} else if !ok {
					t.Logf("Missing Result for test %s", fullTestName)
					t.Fail()
				}
			} else if rsr != nil && !strings.Contains(testName, "Casts") {
				simResult := testSuite.TestDPS(fullTestName, rsr)
				if actualDpsResult, ok := testSuite.testResults.DpsResults[fullTestName]; ok {
					if expectedDpsResult, ok := expectedResults.DpsResults[fullTestName]; ok {
						// Check whichever of DPS/HPS is larger first, so we get better test diff printouts.
						if actualDpsResult.Dps < actualDpsResult.Hps {
							if actualDpsResult.Hps < expectedDpsResult.Hps-tolerance || actualDpsResult.Hps > expectedDpsResult.Hps+tolerance {
								t.Logf("HPS expected %0.03f but was %0.03f!.", expectedDpsResult.Hps, actualDpsResult.Hps)
								t.Fail()
							}
						}
						if actualDpsResult.Dps < expectedDpsResult.Dps-tolerance || actualDpsResult.Dps > expectedDpsResult.Dps+tolerance {
							t.Logf("DPS expected %0.03f but was %0.03f!.", expectedDpsResult.Dps, actualDpsResult.Dps)
							t.Fail()
						}
						if actualDpsResult.Dps >= actualDpsResult.Hps {
							if actualDpsResult.Hps < expectedDpsResult.Hps-tolerance || actualDpsResult.Hps > expectedDpsResult.Hps+tolerance {
								t.Logf("HPS expected %0.03f but was %0.03f!.", expectedDpsResult.Hps, actualDpsResult.Hps)
								t.Fail()
							}
						}

						if actualDpsResult.Tps < expectedDpsResult.Tps-tolerance || actualDpsResult.Tps > expectedDpsResult.Tps+tolerance {
							t.Logf("TPS expected %0.03f but was %0.03f!.", expectedDpsResult.Tps, actualDpsResult.Tps)
							t.Fail()
						}
						if actualDpsResult.Dtps < expectedDpsResult.Dtps-tolerance || actualDpsResult.Dtps > expectedDpsResult.Dtps+tolerance {
							t.Logf("DTPS expected %0.03f but was %0.03f!.", expectedDpsResult.Dtps, actualDpsResult.Dtps)
							t.Fail()
						}
					} else {
						t.Logf("Unexpected test %s with %0.03f DPS!", fullTestName, actualDpsResult.Dps)
						t.Fail()
					}
				} else if !ok {
					t.Logf("Missing Result for test %s", fullTestName)
					t.Fail()
				}

				// The purpose of this test is not only to confirm concurrency result combination to work,
				// but also to check if the sim resets everything properly between iterations.
				// If there are differences in results it hints towards state leaking into following iterations.
				if rsr != nil {

					t.Run(testName+"/CompareResults", func(t *testing.T) {
						mtResult := RunRaidSimConcurrent(rsr)
						CompareConcurrentSimResultsTest(t, currentTestName, simResult, mtResult, 1e-8, 1e-9)
						if t.Failed() {
							t.Log("You can debug the first failed comparison further by starting tests with DEBUG_FIRST_COMPARE=1")
							debugFirstFail, err := strconv.ParseBool(os.Getenv("DEBUG_FIRST_COMPARE"))
							if err == nil && debugFirstFail {
								t.Log("Starting full log comparison...")
								haveDiffs, log := DebugCompareLogs(rsr, 5)
								if haveDiffs {
									t.Log(log)
								} else {
									t.Log("No differences found in logs.")
								}
								// Break loop, it can crash the test if there's errors in too many tests for this spec.
								stopTest = true
								t.FailNow()
							}
						}
					})
				}

			} else if rsr != nil && strings.Contains(testName, "Casts") {
				testSuite.TestCasts(fullTestName, rsr)
				if actualCastsResult, ok := testSuite.testResults.CastsResults[fullTestName]; ok {
					if expectedCastsResult, ok := expectedResults.CastsResults[fullTestName]; ok {
						for action, casts := range actualCastsResult.Casts {
							if casts < expectedCastsResult.Casts[action]-tolerance || casts > expectedCastsResult.Casts[action]+tolerance {
								t.Logf("Expected %0.03f casts of %s but was %0.03f!.", expectedCastsResult.Casts[action], action, casts)
								t.Fail()
							}
						}
					} else {
						t.Logf("Unexpected test %s", fullTestName)
						t.Fail()
					}
				} else if !ok {
					t.Logf("Missing Result for test %s", fullTestName)
					t.Fail()
				}
			} else {
				panic("No test request provided")
			}
		})
	}

	testSuite.Done(t)

	if t.Failed() {
		t.Log("One or more tests failed! If the changes are intentional, update the expected results with 'make test && make update-tests'. Otherwise go fix your bugs!")
	}
}

func toFixed(num float64, precision int) float64 {
	output := math.Pow(10, float64(precision))
	return float64(math.Round(num*output)) / output
}

func toFixedStats(s []float64, precision int) []float64 {
	for i, val := range s {
		s[i] = toFixed(val, precision)
	}
	return s
}
