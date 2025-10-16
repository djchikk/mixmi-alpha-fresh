/**
 * Test Script for Remix Split Calculations
 *
 * This script tests the calculateRemixSplits function against various edge cases
 * to ensure IP splits are calculated correctly in all scenarios.
 *
 * Run with: npm run test:remix-splits
 */

const { calculateRemixSplits } = require('../lib/calculateRemixSplits');

// Test data structure matching SourceTrack interface
interface TestLoop {
  id: string;
  title: string;
  composition_split_1_wallet?: string | null;
  composition_split_1_percentage?: number | null;
  composition_split_2_wallet?: string | null;
  composition_split_2_percentage?: number | null;
  composition_split_3_wallet?: string | null;
  composition_split_3_percentage?: number | null;
  production_split_1_wallet?: string | null;
  production_split_1_percentage?: number | null;
  production_split_2_wallet?: string | null;
  production_split_2_percentage?: number | null;
  production_split_3_wallet?: string | null;
  production_split_3_percentage?: number | null;
}

// Test wallets
const ALICE = 'SP1ALICE111111111111111111111';
const AMY = 'SP1AMY222222222222222222222';
const ANDY = 'SP1ANDY666666666666666666';
const BOB = 'SP1BOB333333333333333333333';
const BETTY = 'SP1BETTY44444444444444444';
const BEN = 'SP1BEN777777777777777777777';
const CHARLIE = 'SP1CHARLIE5555555555555555'; // Remixer

// Color codes for terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Test results tracker
let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

// Helper function to validate splits
function validateSplits(
  testName: string,
  result: any,
  expectedComp: { [wallet: string]: number },
  expectedProd: { [wallet: string]: number }
) {
  console.log(`\n${CYAN}${BOLD}Testing: ${testName}${RESET}`);
  console.log('─'.repeat(60));

  let testPassed = true;
  const errors: string[] = [];

  // Check composition total
  if (result.totalComposition !== 100) {
    errors.push(`❌ Composition total is ${result.totalComposition}%, expected 100%`);
    testPassed = false;
  } else {
    console.log(`${GREEN}✓${RESET} Composition total: 100%`);
  }

  // Check production total
  if (result.totalProduction !== 100) {
    errors.push(`❌ Production total is ${result.totalProduction}%, expected 100%`);
    testPassed = false;
  } else {
    console.log(`${GREEN}✓${RESET} Production total: 100%`);
  }

  // Check composition splits
  console.log(`\n${BOLD}Composition Splits:${RESET}`);
  const compMap = new Map<string, number>();
  result.composition.forEach((split: any) => {
    compMap.set(split.wallet, split.percentage);
    console.log(`  ${split.wallet.slice(0, 10)}...: ${split.percentage}%`);
  });

  for (const [wallet, expectedPct] of Object.entries(expectedComp)) {
    const actualPct = compMap.get(wallet);
    if (actualPct !== expectedPct) {
      errors.push(`❌ Composition: ${wallet.slice(0, 10)}... expected ${expectedPct}%, got ${actualPct}%`);
      testPassed = false;
    } else {
      console.log(`  ${GREEN}✓${RESET} ${wallet.slice(0, 10)}... = ${expectedPct}%`);
    }
  }

  // Check production splits
  console.log(`\n${BOLD}Production Splits:${RESET}`);
  const prodMap = new Map<string, number>();
  result.production.forEach((split: any) => {
    prodMap.set(split.wallet, split.percentage);
    console.log(`  ${split.wallet.slice(0, 10)}...: ${split.percentage}%`);
  });

  for (const [wallet, expectedPct] of Object.entries(expectedProd)) {
    const actualPct = prodMap.get(wallet);
    if (actualPct !== expectedPct) {
      errors.push(`❌ Production: ${wallet.slice(0, 10)}... expected ${expectedPct}%, got ${actualPct}%`);
      testPassed = false;
    } else {
      console.log(`  ${GREEN}✓${RESET} ${wallet.slice(0, 10)}... = ${expectedPct}%`);
    }
  }

  // Note: Remixer CAN appear in splits if they're a contributor to a source loop
  // This is expected and handled correctly - they'll get two separate payments:
  // 1. Their IP holder payment (from being a contributor)
  // 2. Their remixer commission (20% of sale)
  console.log(`\n${YELLOW}ℹ${RESET} Note: Remixer may appear in IP splits if they contributed to a source loop`);

  // Print result
  if (testPassed) {
    console.log(`\n${GREEN}${BOLD}✓ PASSED${RESET}`);
    passedTests++;
  } else {
    console.log(`\n${RED}${BOLD}✗ FAILED${RESET}`);
    errors.forEach(err => console.log(`  ${RED}${err}${RESET}`));
    failedTests++;
    failures.push(`${testName}: ${errors.join(', ')}`);
  }
}

// =============================================================================
// TEST SCENARIOS
// =============================================================================

console.log(`\n${BOLD}${'='.repeat(60)}${RESET}`);
console.log(`${BOLD}  REMIX SPLIT CALCULATION TEST SUITE${RESET}`);
console.log(`${BOLD}${'='.repeat(60)}${RESET}\n`);

// SCENARIO 1: Simple case (baseline)
const loopA: TestLoop = {
  id: 'test-loop-a-simple',
  title: 'Test Loop A - Simple',
  composition_split_1_wallet: ALICE,
  composition_split_1_percentage: 100,
  production_split_1_wallet: AMY,
  production_split_1_percentage: 100,
};

const loopB: TestLoop = {
  id: 'test-loop-b-simple',
  title: 'Test Loop B - Simple',
  composition_split_1_wallet: BOB,
  composition_split_1_percentage: 100,
  production_split_1_wallet: BETTY,
  production_split_1_percentage: 100,
};

const result1 = calculateRemixSplits(loopA, loopB, CHARLIE);
validateSplits(
  'SCENARIO 1: Simple Case (1 composer + 1 producer per loop)',
  result1,
  { [ALICE]: 50, [BOB]: 50 },
  { [AMY]: 50, [BETTY]: 50 }
);

// SCENARIO 2: Multiple contributors
const loopC: TestLoop = {
  id: 'test-loop-c-multi',
  title: 'Test Loop C - Multi Contributors',
  composition_split_1_wallet: ALICE,
  composition_split_1_percentage: 33,
  composition_split_2_wallet: BOB,
  composition_split_2_percentage: 33,
  composition_split_3_wallet: CHARLIE,
  composition_split_3_percentage: 34,
  production_split_1_wallet: AMY,
  production_split_1_percentage: 50,
  production_split_2_wallet: BETTY,
  production_split_2_percentage: 50,
};

const loopD: TestLoop = {
  id: 'test-loop-d-multi',
  title: 'Test Loop D - Multi Contributors',
  composition_split_1_wallet: BETTY,
  composition_split_1_percentage: 60,
  composition_split_2_wallet: AMY,
  composition_split_2_percentage: 40,
  production_split_1_wallet: ALICE,
  production_split_1_percentage: 33,
  production_split_2_wallet: BOB,
  production_split_2_percentage: 33,
  production_split_3_wallet: ANDY,
  production_split_3_percentage: 34,
};

const result2 = calculateRemixSplits(loopC, loopD, CHARLIE);
validateSplits(
  'SCENARIO 2: Multiple Contributors (3 composers + 2 producers)',
  result2,
  { [ALICE]: 17, [BOB]: 16, [CHARLIE]: 17, [BETTY]: 30, [AMY]: 20 },
  { [AMY]: 26, [BETTY]: 25, [ALICE]: 16, [BOB]: 16, [ANDY]: 17 }
);

// SCENARIO 3: Same person in multiple roles
const loopE: TestLoop = {
  id: 'test-loop-e-same-person',
  title: 'Test Loop E - Same Person Both Roles',
  composition_split_1_wallet: ALICE,
  composition_split_1_percentage: 100,
  production_split_1_wallet: ALICE,
  production_split_1_percentage: 100,
};

const loopF: TestLoop = {
  id: 'test-loop-f-overlap',
  title: 'Test Loop F - Overlapping Contributors',
  composition_split_1_wallet: BOB,
  composition_split_1_percentage: 50,
  composition_split_2_wallet: BETTY,
  composition_split_2_percentage: 50,
  production_split_1_wallet: BOB,
  production_split_1_percentage: 100,
};

const result3 = calculateRemixSplits(loopE, loopF, CHARLIE);
validateSplits(
  'SCENARIO 3: Same Person Multiple Roles (consolidation test)',
  result3,
  { [ALICE]: 50, [BOB]: 25, [BETTY]: 25 },
  { [ALICE]: 50, [BOB]: 50 }
);

// SCENARIO 4: Rounding edge cases
const loopG: TestLoop = {
  id: 'test-loop-g-rounding',
  title: 'Test Loop G - Rounding Test',
  composition_split_1_wallet: ALICE,
  composition_split_1_percentage: 33,
  composition_split_2_wallet: BOB,
  composition_split_2_percentage: 33,
  composition_split_3_wallet: BEN,
  composition_split_3_percentage: 34,
  production_split_1_wallet: AMY,
  production_split_1_percentage: 100,
};

const loopH: TestLoop = {
  id: 'test-loop-h-uneven',
  title: 'Test Loop H - Uneven Split',
  composition_split_1_wallet: BETTY,
  composition_split_1_percentage: 51,
  composition_split_2_wallet: AMY,
  composition_split_2_percentage: 49,
  production_split_1_wallet: BOB,
  production_split_1_percentage: 100,
};

const result4 = calculateRemixSplits(loopG, loopH, CHARLIE);
validateSplits(
  'SCENARIO 4: Rounding Edge Cases (33%, 51% splits)',
  result4,
  { [ALICE]: 18, [BOB]: 16, [BEN]: 17, [BETTY]: 25, [AMY]: 24 },
  { [AMY]: 50, [BOB]: 50 }
);

// =============================================================================
// SUMMARY
// =============================================================================

console.log(`\n${BOLD}${'='.repeat(60)}${RESET}`);
console.log(`${BOLD}  TEST SUMMARY${RESET}`);
console.log(`${BOLD}${'='.repeat(60)}${RESET}\n`);

console.log(`Total Tests: ${passedTests + failedTests}`);
console.log(`${GREEN}Passed: ${passedTests}${RESET}`);
console.log(`${RED}Failed: ${failedTests}${RESET}\n`);

if (failedTests > 0) {
  console.log(`${RED}${BOLD}Failed Tests:${RESET}`);
  failures.forEach(failure => {
    console.log(`  ${RED}• ${failure}${RESET}`);
  });
  console.log('');
  process.exit(1);
} else {
  console.log(`${GREEN}${BOLD}✓ All tests passed!${RESET}\n`);
  process.exit(0);
}
