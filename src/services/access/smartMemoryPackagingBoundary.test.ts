import fs from "fs";
import path from "path";

const REPO_ROOT = path.resolve(__dirname, "../../..");

const CORE_SURFACE_FILES = {
  "Memory Center screen": "src/feature/UserProfile/screens/MemoryCenterScreen.tsx",
  "Review Smart Memory details": "src/feature/Meals/screens/MealAdd/ReviewMealScreen.tsx",
  "manual ingredient editor": "src/components/IngredientEditor.tsx",
  "manual ingredient editor sheet":
    "src/feature/Meals/screens/MealAdd/components/IngredientEditorModal.tsx",
};

const FORBIDDEN_CORE_SURFACE_GATES = [
  "useAccessContext",
  "canUseFeature",
  "usePremiumContext",
  "PremiumContext",
  "PaywallModal",
  "ManageSubscription",
];

function readSource(target: string): string {
  return fs.readFileSync(path.join(REPO_ROOT, target), "utf8");
}

function readRow(source: string, marker: string): string {
  const markerIndex = source.indexOf(marker);
  expect(markerIndex).toBeGreaterThanOrEqual(0);

  const start = source.lastIndexOf("<SettingsRow", markerIndex);
  const end = source.indexOf("/>", markerIndex);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(markerIndex);

  return source.slice(start, end + 2);
}

describe("Smart Memory free/core packaging boundary", () => {
  it("keeps Smart Memory and manual autocomplete outside premium feature keys", () => {
    const accessStateSource = readSource("src/services/access/accessState.ts");

    expect(accessStateSource).not.toContain('"smartMemory"');
    expect(accessStateSource).not.toContain('"memoryCenter"');
    expect(accessStateSource).not.toContain('"manualAutocomplete"');
    expect(accessStateSource).not.toContain('"ingredientAutocomplete"');
    expect(accessStateSource).not.toContain('"ingredientProductSelection"');
  });

  it("keeps core Smart Memory surfaces free of entitlement and paywall gates", () => {
    for (const [label, target] of Object.entries(CORE_SURFACE_FILES)) {
      const source = readSource(target);

      for (const forbidden of FORBIDDEN_CORE_SURFACE_GATES) {
        if (source.includes(forbidden)) {
          throw new Error(`${label} must not use ${forbidden}`);
        }
      }
    }
  });

  it("keeps Memory Center reachable from free/core account surfaces", () => {
    const navigatorSource = readSource("src/navigation/AppNavigator.tsx");
    expect(navigatorSource).toContain('<Stack.Screen name="MemoryCenter"');

    const profileMemoryRow = readRow(
      readSource("src/feature/UserProfile/screens/UserProfileScreen.tsx"),
      'testID="account-memory-center-row"',
    );
    const settingsMemoryRow = readRow(
      readSource("src/feature/UserProfile/screens/AppSettingsScreen.tsx"),
      'testID="app-settings-memory-center-row"',
    );

    for (const row of [profileMemoryRow, settingsMemoryRow]) {
      expect(row).toContain('navigation.navigate("MemoryCenter")');
      expect(row).not.toContain("isPremium");
      expect(row).not.toContain("usePremiumContext");
      expect(row).not.toContain("canUseFeature");
      expect(row).not.toContain("Paywall");
    }
  });
});
