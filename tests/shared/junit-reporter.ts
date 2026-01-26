import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
  systemOut?: string;
}

export interface TestSuite {
  name: string;
  tests: TestResult[];
  timestamp: string;
}

/**
 * Generate JUnit XML report from test results
 */
export function generateJUnitReport(suite: TestSuite): string {
  const totalTests = suite.tests.length;
  const failures = suite.tests.filter((t) => !t.passed).length;
  const totalTime = suite.tests.reduce((sum, t) => sum + t.duration, 0) / 1000;

  const testCases = suite.tests
    .map((test) => {
      const escapedName = escapeXml(`${test.id}: ${test.name}`);
      const timeInSeconds = (test.duration / 1000).toFixed(3);

      if (test.passed) {
        const systemOut = test.systemOut
          ? `\n      <system-out><![CDATA[${test.systemOut}]]></system-out>`
          : "";
        return `    <testcase name="${escapedName}" classname="${suite.name.toLowerCase().replace(/\s+/g, "-")}" time="${timeInSeconds}">${systemOut}
    </testcase>`;
      } else {
        return `    <testcase name="${escapedName}" classname="${suite.name.toLowerCase().replace(/\s+/g, "-")}" time="${timeInSeconds}">
      <failure message="${escapeXml(test.error || "Test failed")}" type="AssertionError"><![CDATA[${test.error || "Test failed"}]]></failure>
    </testcase>`;
      }
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="${escapeXml(suite.name)}" tests="${totalTests}" failures="${failures}" time="${totalTime.toFixed(3)}" timestamp="${suite.timestamp}">
  <testsuite name="${escapeXml(suite.name)}" tests="${totalTests}" failures="${failures}" time="${totalTime.toFixed(3)}">
${testCases}
  </testsuite>
</testsuites>`;
}

/**
 * Write JUnit report to file
 */
export function writeJUnitReport(suite: TestSuite, outputPath: string): void {
  const xml = generateJUnitReport(suite);

  // Ensure directory exists
  const dir = dirname(outputPath);
  mkdirSync(dir, { recursive: true });

  writeFileSync(outputPath, xml, "utf-8");
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Helper to run a test and capture result
 */
export async function runTest(
  id: string,
  name: string,
  testFn: () => Promise<string | undefined>,
): Promise<TestResult> {
  const startTime = performance.now();

  try {
    const output = await testFn();
    const duration = performance.now() - startTime;

    return {
      id,
      name,
      passed: true,
      duration,
      systemOut: output || undefined,
    };
  } catch (error) {
    const duration = performance.now() - startTime;

    return {
      id,
      name,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Create a test suite runner
 */
export function createTestSuite(name: string) {
  const tests: TestResult[] = [];

  return {
    addResult(result: TestResult) {
      tests.push(result);
    },

    async run(
      id: string,
      testName: string,
      testFn: () => Promise<string | undefined>,
    ): Promise<TestResult> {
      const result = await runTest(id, testName, testFn);
      tests.push(result);
      return result;
    },

    getSuite(): TestSuite {
      return {
        name,
        tests,
        timestamp: new Date().toISOString(),
      };
    },

    getResults() {
      return tests;
    },

    allPassed() {
      return tests.every((t) => t.passed);
    },
  };
}
