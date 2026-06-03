import { Text } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { AccountIdentityCard } from "@/feature/UserProfile/components/AccountIdentityCard";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <Text>{name}</Text>;
  },
}));

describe("AccountIdentityCard", () => {
  it("renders avatar, status badge, and handles press", () => {
    const onPress = jest.fn();
    const { getByText, getByTestId } = renderWithTheme(
      <AccountIdentityCard
        avatar={<Text testID="avatar">avatar</Text>}
        title="lukasz"
        subtitle="name@example.com"
        badge={<Text>Premium</Text>}
        onPress={onPress}
        testID="identity-card"
      />,
    );

    expect(getByTestId("avatar")).toBeTruthy();
    expect(getByText("lukasz")).toBeTruthy();
    expect(getByText("name@example.com")).toBeTruthy();
    expect(getByText("Premium")).toBeTruthy();
    expect(getByText("chevron")).toBeTruthy();

    fireEvent.press(getByTestId("identity-card"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("allows local title and subtitle hierarchy overrides", () => {
    const { getByText } = renderWithTheme(
      <AccountIdentityCard
        title="lukasz"
        subtitle="name@example.com"
        titleStyle={{ fontSize: 16 }}
        subtitleStyle={{ fontSize: 12 }}
      />,
    );

    expect(getByText("lukasz").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 16 })]),
    );
    expect(getByText("name@example.com").props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontSize: 12 })]),
    );
  });
});
