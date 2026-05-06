import { Image } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { UserIcon } from "@/components/UserIcon";
import { renderWithTheme } from "@/test-utils/renderWithTheme";

const mockUseUserContext = jest.fn();

jest.mock("@/context/UserProfileContext", () => ({
  useUserProfileContext: () => mockUseUserContext(),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("@/components/AppIcon", () => ({
  __esModule: true,
  default: ({ name }: { name: string }) => {
    const { createElement } =
      jest.requireActual<typeof import("react")>("react");
    const { Text } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return createElement(Text, null, name);
  },
}));

describe("UserIcon", () => {
  it("renders fallback icon when user avatar is missing", () => {
    mockUseUserContext.mockReturnValue({ userData: null });
    const { getByText } = renderWithTheme(<UserIcon />);

    expect(getByText("person")).toBeTruthy();
  });

  it("renders user image and falls back to icon on image error", () => {
    mockUseUserContext.mockReturnValue({
      userData: { avatarLocalPath: "file:///avatar.jpg", avatarUrl: null },
    });
    const { UNSAFE_getByType, getByText } = renderWithTheme(<UserIcon />);

    const image = UNSAFE_getByType(Image);
    expect(image.props.source.uri).toBe("file:///avatar.jpg");

    fireEvent(image, "error");
    expect(getByText("person")).toBeTruthy();
  });

  it("shows premium badge with translated accessibility label", () => {
    mockUseUserContext.mockReturnValue({ userData: null });
    const { getByLabelText, getByText } = renderWithTheme(<UserIcon isPremium />);

    expect(getByLabelText("user.premium_badge_accessibility")).toBeTruthy();
    expect(getByText("star")).toBeTruthy();
  });

  it("uses avatar url and custom accessibility label when provided", () => {
    mockUseUserContext.mockReturnValue({
      userData: { avatarLocalPath: null, avatarUrl: "https://example.com/avatar.jpg" },
    });
    const { UNSAFE_getByType, getByLabelText } = renderWithTheme(
      <UserIcon accessibilityLabel="custom-avatar" />,
    );

    expect(getByLabelText("custom-avatar")).toBeTruthy();
    expect(UNSAFE_getByType(Image).props.source.uri).toBe(
      "https://example.com/avatar.jpg",
    );
  });
});
