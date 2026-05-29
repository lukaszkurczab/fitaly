import { fireEvent } from "@testing-library/react-native";
import { describe, expect, it, jest } from "@jest/globals";
import { Text } from "react-native";
import { renderWithTheme } from "@/test-utils/renderWithTheme";
import type { ChatMessage } from "@/types";
import { ChatMessageList } from "./ChatMessageList";

jest.mock("./ChatMessageBubble", () => ({
  ChatMessageBubble: ({ text }: { text: string }) => {
    const { Text: MockText } =
      jest.requireActual<typeof import("react-native")>("react-native");
    return <MockText>{text}</MockText>;
  },
}));

const messages: ChatMessage[] = [
  {
    id: "m-1",
    userUid: "user-1",
    role: "assistant",
    content: "Hello there",
    createdAt: 1,
    lastSyncedAt: 1,
    syncState: "synced",
    deleted: false,
  },
];

describe("ChatMessageList", () => {
  it("renders animated typing indicator when typing is active", () => {
    const screen = renderWithTheme(
      <ChatMessageList
        messages={messages}
        typing
        loading={false}
        emptyState={<Text>empty</Text>}
        onLoadMore={() => undefined}
        dateLabel="Today"
        typingLabel="AI is preparing a response"
      />,
    );

    expect(screen.getByTestId("chat-typing-indicator")).toBeTruthy();
    expect(screen.getByTestId("chat-typing-dot-1")).toBeTruthy();
    expect(screen.getByTestId("chat-typing-dot-2")).toBeTruthy();
    expect(screen.getByTestId("chat-typing-dot-3")).toBeTruthy();
  });

  it("does not render typing indicator when typing is inactive", () => {
    const screen = renderWithTheme(
      <ChatMessageList
        messages={messages}
        typing={false}
        loading={false}
        emptyState={<Text>empty</Text>}
        onLoadMore={() => undefined}
        dateLabel="Today"
        typingLabel="AI is preparing a response"
      />,
    );

    expect(screen.queryByTestId("chat-typing-indicator")).toBeNull();
  });

  it("renders retryable error state with the conversation instead of the composer", () => {
    const onRetry = jest.fn();
    const screen = renderWithTheme(
      <ChatMessageList
        messages={messages}
        typing={false}
        loading={false}
        emptyState={<Text>empty</Text>}
        onLoadMore={() => undefined}
        dateLabel="Today"
        typingLabel="AI is preparing a response"
        errorText="Could not fetch a response. Please try again."
        errorActionLabel="Retry last message"
        onErrorActionPress={onRetry}
      />,
    );

    expect(screen.getByTestId("chat-error-state")).toBeTruthy();
    expect(
      screen.getByText("Could not fetch a response. Please try again."),
    ).toBeTruthy();

    fireEvent.press(screen.getByTestId("chat-retry-button"));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
