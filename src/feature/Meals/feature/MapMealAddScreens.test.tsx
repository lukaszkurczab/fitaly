import { describe, expect, it, jest } from "@jest/globals";

jest.mock("../screens/MealAdd/MealCameraScreen", () => ({
  __esModule: true,
  default: function MockMealCameraScreen() {
    return null;
  },
}));

jest.mock("../screens/MealAdd/BarcodeScanScreen", () => ({
  __esModule: true,
  default: function MockBarcodeScanScreen() {
    return null;
  },
}));

jest.mock("../screens/MealAdd/PreparingReviewPhotoScreen", () => ({
  __esModule: true,
  default: function MockPreparingReviewPhotoScreen() {
    return null;
  },
}));

jest.mock("../screens/MealAdd/DescribeMealScreen", () => ({
  __esModule: true,
  default: function MockDescribeMealScreen() {
    return null;
  },
}));

jest.mock("../screens/MealAdd/TextAnalyzingScreen", () => ({
  __esModule: true,
  default: function MockTextAnalyzingScreen() {
    return null;
  },
}));

jest.mock("../screens/MealAdd/ReviewMealScreen", () => ({
  __esModule: true,
  default: function MockReviewMealScreen() {
    return null;
  },
}));

jest.mock("../screens/MealAdd/EditMealDetailsScreen", () => ({
  __esModule: true,
  default: function MockEditMealDetailsScreen() {
    return null;
  },
}));

jest.mock("../screens/MealAdd/IngredientsNotRecognizedScreen", () => ({
  __esModule: true,
  default: function MockIngredientsNotRecognizedScreen() {
    return null;
  },
}));

jest.mock("../screens/SelectSavedMealsScreen", () => ({
  __esModule: true,
  default: function MockSelectSavedMealScreen() {
    return null;
  },
}));

import BarcodeScanScreen from "../screens/MealAdd/BarcodeScanScreen";
import DescribeMealScreen from "../screens/MealAdd/DescribeMealScreen";
import EditMealDetailsScreen from "../screens/MealAdd/EditMealDetailsScreen";
import IngredientsNotRecognizedScreen from "../screens/MealAdd/IngredientsNotRecognizedScreen";
import MealCameraScreen from "../screens/MealAdd/MealCameraScreen";
import PreparingReviewPhotoScreen from "../screens/MealAdd/PreparingReviewPhotoScreen";
import ReviewMealScreen from "../screens/MealAdd/ReviewMealScreen";
import SelectSavedMealScreen from "../screens/SelectSavedMealsScreen";
import TextAnalyzingScreen from "../screens/MealAdd/TextAnalyzingScreen";
import MapMealAddScreens from "./MapMealAddScreens";

describe("MapMealAddScreens", () => {
  it("returns the correct screen component for each flow step", () => {
    expect(MapMealAddScreens("CameraDefault")).toBe(MealCameraScreen);
    expect(MapMealAddScreens("BarcodeScan")).toBe(BarcodeScanScreen);
    expect(MapMealAddScreens("PreparingReviewPhoto")).toBe(
      PreparingReviewPhotoScreen,
    );
    expect(MapMealAddScreens("DescribeMeal")).toBe(DescribeMealScreen);
    expect(MapMealAddScreens("TextAnalyzing")).toBe(TextAnalyzingScreen);
    expect(MapMealAddScreens("ReviewMeal")).toBe(ReviewMealScreen);
    expect(MapMealAddScreens("EditMealDetails")).toBe(EditMealDetailsScreen);
    expect(MapMealAddScreens("SelectSavedMeal")).toBe(SelectSavedMealScreen);
    expect(MapMealAddScreens("IngredientsNotRecognized")).toBe(
      IngredientsNotRecognizedScreen,
    );
  });

  it("throws for an unsupported flow step", () => {
    expect(() =>
      MapMealAddScreens("UnknownScreen" as never),
    ).toThrow("Unknown screen: UnknownScreen");
  });
});
