import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getTextDetailsExpandedPreference,
  setTextDetailsExpandedPreference,
} from "@/feature/Meals/services/textDetailsPreference";

describe("textDetailsPreference", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it("defaults to collapsed for missing users and first-time users", async () => {
    await expect(getTextDetailsExpandedPreference(null)).resolves.toBe(false);
    await expect(getTextDetailsExpandedPreference("user-1")).resolves.toBe(false);
  });

  it("persists expanded and collapsed state per user", async () => {
    await setTextDetailsExpandedPreference("user-1", true);

    await expect(getTextDetailsExpandedPreference("user-1")).resolves.toBe(true);
    await expect(getTextDetailsExpandedPreference("user-2")).resolves.toBe(false);

    await setTextDetailsExpandedPreference("user-1", false);

    await expect(getTextDetailsExpandedPreference("user-1")).resolves.toBe(false);
  });
});
