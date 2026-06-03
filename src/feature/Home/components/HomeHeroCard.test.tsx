import { describe, expect, it, jest } from "@jest/globals";
import { StyleSheet } from "react-native";
import { HomeHeroCard } from "@/feature/Home/components/HomeHeroCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

describe("HomeHeroCard", () => {
  it("uses tint and border instead of local card depth", () => {
    const { getByTestId } = renderWithTheme(
      <HomeHeroCard
        title="Today"
        meta="0 / 2000 kcal"
        ctaLabel="Add meal"
        onPressCta={jest.fn()}
        methodLabel="Text"
        methodIcon="text"
        onPressMethodSelector={jest.fn()}
      />,
    );

    const cardStyle = StyleSheet.flatten(
      getByTestId("home-hero-card").props.style,
    );

    expect(cardStyle.shadowOpacity).toBeUndefined();
    expect(cardStyle.shadowRadius).toBeUndefined();
    expect(cardStyle.elevation).toBeUndefined();
  });
});
