import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ChatMessage } from "@/types";
import AppIcon from "@/components/AppIcon";
import { useTheme } from "@/theme/useTheme";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { ChatTypingIndicator } from "./ChatTypingIndicator";

type Props = {
  messages: ChatMessage[];
  typing: boolean;
  loading: boolean;
  emptyState: React.ReactElement;
  onLoadMore: () => void;
  dateLabel: string;
  typingLabel: string;
  errorText?: string;
  errorActionLabel?: string;
  onErrorActionPress?: () => void;
  errorActionDisabled?: boolean;
};

export function ChatMessageList({
  messages,
  typing,
  loading,
  emptyState,
  onLoadMore,
  dateLabel,
  typingLabel,
  errorText,
  errorActionLabel,
  onErrorActionPress,
  errorActionDisabled = false,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";

  const data = messages;
  const showErrorState = Boolean(errorText);
  const showErrorAction = Boolean(errorActionLabel && onErrorActionPress);

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <FlatList
      testID="chat-message-list"
      style={styles.list}
      inverted
      data={data}
      keyExtractor={(item) => item.id}
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps="handled"
      onEndReachedThreshold={0.4}
      onEndReached={onLoadMore}
      renderItem={({ item }) => (
        <View
          testID={item.role === "user" ? "chat-message-user" : "chat-message-ai"}
        >
          <ChatMessageBubble
            role={item.role === "user" ? "user" : "assistant"}
            text={item.content}
          />
        </View>
      )}
      ListHeaderComponent={
        typing || showErrorState ? (
          <View style={styles.headerStack}>
            {typing ? <ChatTypingIndicator label={typingLabel} /> : null}
            {showErrorState ? (
              <View style={styles.errorRow}>
                <View testID="chat-error-state" style={styles.errorCard}>
                  <Text style={styles.errorText}>{errorText}</Text>

                  {showErrorAction ? (
                    <Pressable
                      testID="chat-retry-button"
                      onPress={onErrorActionPress}
                      disabled={errorActionDisabled}
                      accessibilityRole="button"
                      accessibilityLabel={errorActionLabel}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.errorAction,
                        errorActionDisabled ? styles.errorActionDisabled : null,
                        pressed && !errorActionDisabled
                          ? styles.errorActionPressed
                          : null,
                      ]}
                    >
                      <AppIcon
                        name="refresh"
                        size={16}
                        color={theme.error.text}
                      />
                      <Text style={styles.errorActionText}>
                        {errorActionLabel}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        ) : null
      }
      ListFooterComponent={
        data.length > 0 ? (
          <Text style={styles.dateStamp}>{dateLabel}</Text>
        ) : null
      }
      ListEmptyComponent={emptyState}
      contentContainerStyle={
        data.length > 0 ? styles.listContent : styles.listContentEmpty
      }
    />
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    list: {
      flex: 1,
      minHeight: 0,
    },
    listContent: {
      paddingHorizontal: theme.spacing.md,
      // For inverted lists, paddingTop is rendered near the composer.
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xl,
    },
    listContentEmpty: {
      flexGrow: 1,
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    dateStamp: {
      alignSelf: "center",
      marginBottom: theme.spacing.md,
      color: theme.textTertiary,
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.overline,
      fontFamily: theme.typography.fontFamily.medium,
    },
    loaderWrap: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    headerStack: {
      gap: theme.spacing.xs,
    },
    errorRow: {
      width: "100%",
      marginBottom: theme.spacing.xs,
      flexDirection: "row",
      justifyContent: "flex-start",
    },
    errorCard: {
      maxWidth: "84%",
      borderTopLeftRadius: theme.rounded.lg,
      borderTopRightRadius: theme.rounded.lg,
      borderBottomLeftRadius: theme.rounded.xs,
      borderBottomRightRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.error.border,
      backgroundColor: theme.error.surface,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.sm,
    },
    errorText: {
      color: theme.error.text,
      fontSize: theme.typography.size.bodyS,
      lineHeight: theme.typography.lineHeight.bodyS,
      fontFamily: theme.typography.fontFamily.regular,
    },
    errorAction: {
      minHeight: 40,
      alignSelf: "flex-start",
      borderRadius: theme.rounded.full,
      borderWidth: 1,
      borderColor: theme.error.border,
      backgroundColor: theme.isDark ? theme.surfaceElevated : theme.surface,
      paddingHorizontal: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.xs,
    },
    errorActionText: {
      color: theme.error.text,
      fontSize: theme.typography.size.labelS,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    errorActionPressed: {
      opacity: 0.78,
    },
    errorActionDisabled: {
      opacity: 0.42,
    },
  });
