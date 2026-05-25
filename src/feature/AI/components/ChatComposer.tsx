import { useCallback, useMemo, useState } from "react";
import {
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInputContentSizeChangeEventData,
  View,
} from "react-native";
import AppIcon from "@/components/AppIcon";
import { TextInput } from "@/components/TextInput";
import { useTheme } from "@/theme/useTheme";

const MAX_CHARS = 4000;
const MIN_COMPOSER_LINES = 2;
const MAX_COMPOSER_LINES = 6;
const ESTIMATED_CHARS_PER_LINE = 34;

type Props = {
  placeholder: string;
  sendLabel: string;
  disabled: boolean;
  onSend: (value: string) => void;
  helperText?: string;
  helperActionLabel?: string;
  onHelperActionPress?: () => void;
  helperActionDisabled?: boolean;
};

export function ChatComposer({
  placeholder,
  sendLabel,
  disabled,
  onSend,
  helperText,
  helperActionLabel,
  onHelperActionPress,
  helperActionDisabled = false,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [value, setValue] = useState("");
  const lineHeight = theme.typography.lineHeight.bodyM;
  const minInputHeight = lineHeight * MIN_COMPOSER_LINES;
  const maxInputHeight = lineHeight * MAX_COMPOSER_LINES;
  const [contentHeight, setContentHeight] = useState(minInputHeight);
  const hasHelperText = Boolean(helperText);

  const canSend = !disabled && value.trim().length > 0;
  const estimatedInputHeight =
    lineHeight *
    Math.min(
      MAX_COMPOSER_LINES,
      Math.max(MIN_COMPOSER_LINES, Math.ceil(value.length / ESTIMATED_CHARS_PER_LINE)),
    );
  const resolvedInputHeight = Math.min(
    maxInputHeight,
    Math.max(minInputHeight, contentHeight, estimatedInputHeight),
  );
  const inputScrollEnabled = contentHeight > maxInputHeight;

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || !canSend) return;
    onSend(trimmed);
    setValue("");
    setContentHeight(minInputHeight);
  }, [canSend, minInputHeight, onSend, value]);

  const handleContentSizeChange = useCallback(
    (
      event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>,
    ) => {
      const nextHeight = event.nativeEvent.contentSize.height;
      if (!Number.isFinite(nextHeight)) return;
      setContentHeight(nextHeight);
    },
    [],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TextInput
          testID="chat-input"
          value={value}
          onChangeText={setValue}
          placeholder={placeholder}
          editable={!disabled}
          multiline
          numberOfLines={MIN_COMPOSER_LINES}
          inputMaxHeight={maxInputHeight}
          style={styles.inputShell}
          fieldStyle={styles.inputField}
          inputStyle={[
            styles.inputText,
            {
              height: resolvedInputHeight,
              minHeight: minInputHeight,
            },
          ]}
          onContentSizeChange={handleContentSizeChange}
          scrollEnabled={inputScrollEnabled}
          maxLength={MAX_CHARS}
          returnKeyType="done"
          blurOnSubmit
          submitBehavior="blurAndSubmit"
        />

        <Pressable
          testID="chat-send-button"
          onPress={handleSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={sendLabel}
          style={({ pressed }) => [
            styles.sendButton,
            canSend ? theme.depth.cta : null,
            !canSend ? styles.sendButtonDisabled : null,
            pressed && canSend ? styles.sendButtonPressed : null,
          ]}
        >
          <AppIcon
            name="arrow"
            size={24}
            rotation="90deg"
            color={!canSend ? theme.disabled.text : theme.textInverse}
          />
        </Pressable>
      </View>

      {value.length > MAX_CHARS - 400 && (
        <Text
          style={[
            styles.charCounter,
            value.length >= MAX_CHARS && styles.charCounterLimit,
          ]}
        >
          {value.length}/{MAX_CHARS}
        </Text>
      )}

      <View
        style={[
          styles.helperRow,
          helperActionLabel ? styles.helperRowStacked : null,
        ]}
      >
        <Text
          testID={helperText ? "chat-error-state" : undefined}
          style={[
            styles.helperText,
            helperActionLabel ? styles.helperTextStacked : null,
            !hasHelperText ? styles.helperTextPlaceholder : null,
          ]}
        >
          {helperText ?? " "}
        </Text>

        {helperActionLabel && onHelperActionPress ? (
          <Pressable
            testID="chat-retry-button"
            onPress={onHelperActionPress}
            disabled={helperActionDisabled}
            accessibilityRole="button"
            accessibilityLabel={helperActionLabel}
            style={({ pressed }) => [
              styles.helperAction,
              helperActionDisabled ? styles.helperActionDisabled : null,
              pressed && !helperActionDisabled
                ? styles.helperActionPressed
                : null,
            ]}
          >
            <Text style={styles.helperActionLabel}>{helperActionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: "transparent",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: theme.spacing.xs,
      backgroundColor: "transparent",
    },
    inputShell: {
      flex: 1,
      minWidth: 0,
    },
    inputField: {
      borderRadius: theme.rounded.lg,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    inputText: {
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      marginVertical: 0,
    },
    sendButton: {
      width: 44,
      height: 44,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    sendButtonDisabled: {
      borderColor: theme.disabled.border,
      backgroundColor: theme.disabled.background,
    },
    sendButtonPressed: {
      opacity: 0.82,
    },
    helperRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    helperRowStacked: {
      flexDirection: "column",
      alignItems: "flex-start",
      gap: theme.spacing.xxs,
    },
    helperText: {
      flex: 1,
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
    },
    helperTextStacked: {
      flex: 0,
      alignSelf: "stretch",
    },
    helperTextPlaceholder: {
      opacity: 0,
    },
    helperActionLabel: {
      color: theme.link,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.semiBold,
      textDecorationLine: "underline",
    },
    helperAction: {
      paddingVertical: 2,
    },
    helperActionDisabled: {
      opacity: 0.42,
    },
    helperActionPressed: {
      opacity: 0.72,
    },
    charCounter: {
      fontSize: theme.typography.size.bodyS,
      color: theme.textTertiary,
      alignSelf: "flex-end",
      paddingRight: theme.spacing.xs,
    },
    charCounterLimit: {
      color: theme.status.negative,
    },
  });
