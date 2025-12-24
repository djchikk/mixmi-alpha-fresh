# Remix Split Test Suite

This test suite validates the remix IP split calculation logic for complex scenarios.

## Test Files

1. **test-data-setup.sql** - Inserts test loops into the database
2. **test-remix-splits.ts** - Runs automated tests on the calculation logic
3. **test-data-cleanup.sql** - Removes all test data after testing

## Test Scenarios

### Scenario 1: Simple Case (Baseline)
- **Loop A**: Alice 100% comp, Amy 100% prod
- **Loop B**: Bob 100% comp, Betty 100% prod
- **Expected**: Each person gets 50% of their respective pie

### Scenario 2: Multiple Contributors
- **Loop C**: 3 composers (33%, 33%, 34%) + 2 producers (50%, 50%)
- **Loop D**: 2 composers (60%, 40%) + 3 producers (33%, 33%, 34%)
- **Tests**: Handling multiple contributors per loop

### Scenario 3: Same Person Multiple Roles
- **Loop E**: Alice is 100% comp AND 100% prod
- **Loop F**: Bob in both comp (50%) and prod (100%), Betty in comp (50%)
- **Tests**: Consolidation of duplicate wallets

### Scenario 4: Rounding Edge Cases
- **Loop G**: 3 composers with 33% each (rounding test)
- **Loop H**: Uneven split (51%, 49%)
- **Tests**: Rounding adjustments to maintain 100% total

## How to Run

### 1. Insert Test Data (Optional - for UI testing)
```bash
# If you want to test in the UI with real database records
psql YOUR_DATABASE_URL -f scripts/test-data-setup.sql
```

### 2. Run Automated Tests
```bash
# This tests the calculation logic directly without needing the database
npm run test:remix-splits
# or
npx ts-node scripts/test-remix-splits.ts
```

### 3. Clean Up Test Data
```bash
# Remove all test records from database
psql YOUR_DATABASE_URL -f scripts/test-data-cleanup.sql
```

## What the Tests Validate

✓ **Totals**: Both composition and production splits sum to exactly 100%
✓ **Scaling**: Each loop contributes 50% to both pies
✓ **Consolidation**: Duplicate wallets are merged correctly
✓ **Rounding**: Adjustments maintain 100% totals
✓ **Remixer Exclusion**: Remixer does NOT appear in IP splits
✓ **Edge Cases**: Handles uneven splits and multiple contributors

## Expected Output

When all tests pass, you'll see:
```
✓ PASSED - SCENARIO 1: Simple Case
✓ PASSED - SCENARIO 2: Multiple Contributors
✓ PASSED - SCENARIO 3: Same Person Multiple Roles
✓ PASSED - SCENARIO 4: Rounding Edge Cases

TEST SUMMARY
Passed: 4
Failed: 0

✓ All tests passed!
```

## Test Wallets

For easy identification, the tests use these mock wallets:
- **Alice**: SP1ALICE111111111111111111111
- **Amy**: SP1AMY222222222222222222222
- **Andy**: SP1ANDY666666666666666666
- **Bob**: SP1BOB333333333333333333333
- **Betty**: SP1BETTY44444444444444444
- **Ben**: SP1BEN777777777777777777777
- **Charlie**: SP1CHARLIE5555555555555555 (remixer)

## Notes

- Test data uses IDs like `test-loop-a-simple`, `test-loop-b-simple`, etc.
- The automated tests (`.ts` file) don't require database access
- The SQL files are for manual UI testing if desired
- Always run cleanup after testing to remove test records
