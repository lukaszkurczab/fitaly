import { useMemo } from "react";
import { StyleSheet, Text, type TextStyle, View } from "react-native";
import { useTheme } from "@/theme/useTheme";

type Props = {
  role: "user" | "assistant";
  text: string;
};

const INLINE_MARK = /\*\*[^*]+\*\*|\*[^*]+\*/g;

export function ChatMessageBubble({ role, text }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const isUser = role === "user";
  const messageToneStyle = isUser ? styles.userMessageText : styles.aiMessageText;

  const renderInlineSegments = (content: string, keyPrefix: string) => {
    const segments: Array<{ key: string; value: string; style?: TextStyle }> =
      [];
    let lastIndex = 0;

    content.replace(INLINE_MARK, (match, offset) => {
      if (offset > lastIndex) {
        segments.push({
          key: `${keyPrefix}-${segments.length}`,
          value: content.slice(lastIndex, offset),
        });
      }

      const isBold = match.startsWith("**");
      const inner = match.slice(
        isBold ? 2 : 1,
        match.length - (isBold ? 2 : 1),
      );

      segments.push({
        key: `${keyPrefix}-${segments.length}`,
        value: inner,
        style: isBold ? styles.bold : styles.italic,
      });

      lastIndex = offset + match.length;
      return match;
    });

    if (lastIndex < content.length) {
      segments.push({
        key: `${keyPrefix}-${segments.length}`,
        value: content.slice(lastIndex),
      });
    }

    return segments.map((segment) => (
      <Text key={segment.key} style={segment.style}>
        {segment.value}
      </Text>
    ));
  };

  const renderContent = () => {
    const lines = text.split(/\n/);

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return (
          <Text
            key={`line-${idx}`}
            style={[styles.messageText, messageToneStyle]}
          />
        );
      }

      if (/^\s*-\s+/.test(line)) {
        const item = line.replace(/^\s*-\s+/, "");
        return (
          <View key={`bullet-${idx}`} style={styles.bulletRow}>
            <Text style={[styles.messageText, messageToneStyle]}>•</Text>
            <Text style={[styles.messageText, messageToneStyle, styles.bulletText]}>
              {renderInlineSegments(item, `bullet-${idx}`)}
            </Text>
          </View>
        );
      }

      return (
        <Text key={`line-${idx}`} style={[styles.messageText, messageToneStyle]}>
          {renderInlineSegments(line, `line-${idx}`)}
        </Text>
      );
    });
  };

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View
        style={[
          styles.bubble,
          isUser ? styles.userBubble : styles.aiBubble,
        ]}
      >
        {renderContent()}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    row: {
      width: "100%",
      marginBottom: theme.spacing.xs,
      flexDirection: "row",
    },
    rowUser: {
      justifyContent: "flex-end",
    },
    rowAssistant: {
      justifyContent: "flex-start",
    },
    bubble: {
      maxWidth: "84%",
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      gap: theme.spacing.xxs,
    },
    userBubble: {
      borderTopLeftRadius: theme.rounded.lg,
      borderTopRightRadius: theme.rounded.lg,
      borderBottomLeftRadius: theme.rounded.lg,
      borderBottomRightRadius: theme.rounded.xs,
      backgroundColor: theme.primary,
      maxWidth: "78%",
    },
    aiBubble: {
      borderTopLeftRadius: theme.rounded.lg,
      borderTopRightRadius: theme.rounded.lg,
      borderBottomLeftRadius: theme.rounded.xs,
      borderBottomRightRadius: theme.rounded.lg,
      backgroundColor: theme.isDark ? theme.surfaceElevated : theme.surface,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      ...(!theme.isDark ? theme.depth.inputFocus : {}),
    },
    messageText: {
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      fontFamily: theme.typography.fontFamily.regular,
    },
    userMessageText: {
      color: theme.textInverse,
    },
    aiMessageText: {
      color: theme.text,
    },
    bulletRow: {
      flexDirection: "row",
      gap: theme.spacing.xs,
      alignItems: "flex-start",
    },
    bulletText: {
      flex: 1,
    },
    bold: {
      fontFamily: theme.typography.fontFamily.bold,
    },
    italic: {
      fontStyle: "italic",
    },
  });
