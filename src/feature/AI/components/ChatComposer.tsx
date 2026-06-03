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
const MIN_COMPOSER_LINES = 1;
const MAX_COMPOSER_LINES = 4;
const ESTIMATED_CHARS_PER_LINE = 34;
const INPUT_PADDING_TOP = 1;
const INPUT_PADDING_BOTTOM = 5;
const INPUT_VERTICAL_PADDING = INPUT_PADDING_TOP + INPUT_PADDING_BOTTOM;

type Props = {
  placeholder: string;
  sendLabel: string;
  disabled: boolean;
  onSend: (value: string) => void;
  helperText?: string;
};

export function ChatComposer({
  placeholder,
  sendLabel,
  disabled,
  onSend,
  helperText,
}: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [value, setValue] = useState("");
  const lineHeight = theme.typography.lineHeight.bodyM;
  const minInputHeight =
    lineHeight * MIN_COMPOSER_LINES + INPUT_VERTICAL_PADDING;
  const maxInputHeight =
    lineHeight * MAX_COMPOSER_LINES + INPUT_VERTICAL_PADDING;
  const [contentHeight, setContentHeight] = useState(minInputHeight);
  const hasHelperText = Boolean(helperText);

  const canSend = !disabled && value.trim().length > 0;
  const estimatedInputHeight =
    lineHeight *
      Math.min(
        MAX_COMPOSER_LINES,
        Math.max(
          MIN_COMPOSER_LINES,
          Math.ceil(value.length / ESTIMATED_CHARS_PER_LINE),
        ),
      ) +
    INPUT_VERTICAL_PADDING;
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
      <View
        style={[
          styles.composerSurface,
          disabled ? styles.composerSurfaceDisabled : null,
        ]}
      >
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
            disabled ? styles.inputTextDisabled : null,
            {
              height: resolvedInputHeight,
              minHeight: minInputHeight,
            },
          ]}
          onContentSizeChange={handleContentSizeChange}
          scrollEnabled={inputScrollEnabled}
          maxLength={MAX_CHARS}
          autoCapitalize="sentences"
          autoCorrect
          spellCheck
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
          hitSlop={8}
          style={({ pressed }) => [
            styles.sendButton,
            canSend ? theme.depth.cta : null,
            !canSend ? styles.sendButtonDisabled : null,
            pressed && canSend ? styles.sendButtonPressed : null,
          ]}
        >
          <AppIcon
            name="arrow"
            size={22}
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

      {hasHelperText ? (
        <View style={styles.helperRow}>
          <Text testID="chat-composer-helper" style={styles.helperText}>
            {helperText}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: "transparent",
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.xs,
      paddingBottom: theme.spacing.xs,
      gap: theme.spacing.xs,
    },
    composerSurface: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      borderRadius: theme.rounded.xl,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      backgroundColor: theme.isDark ? theme.surfaceElevated : theme.surface,
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      ...(!theme.isDark ? theme.depth.inputFocus : {}),
    },
    composerSurfaceDisabled: {
      borderColor: theme.disabled.border,
      backgroundColor: theme.isDark ? theme.disabled.background : theme.surfaceAlt,
    },
    inputShell: {
      flex: 1,
      minWidth: 0,
    },
    inputField: {
      borderWidth: 0,
      borderColor: "transparent",
      borderRadius: theme.rounded.xl,
      backgroundColor: "transparent",
      paddingLeft: theme.spacing.md,
      paddingRight: theme.spacing.xxs,
      paddingVertical: 0,
    },
    inputText: {
      fontSize: theme.typography.size.bodyM,
      lineHeight: theme.typography.lineHeight.bodyM,
      marginVertical: 0,
      paddingTop: INPUT_PADDING_TOP,
      paddingBottom: INPUT_PADDING_BOTTOM,
    },
    inputTextDisabled: {
      color: theme.disabled.text,
    },
    sendButton: {
      width: 38,
      height: 38,
      borderRadius: theme.rounded.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 0,
      backgroundColor: theme.primary,
    },
    sendButtonDisabled: {
      backgroundColor: theme.isDark ? theme.disabled.background : theme.surfaceAlt,
    },
    sendButtonPressed: {
      opacity: 0.82,
    },
    helperRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    helperText: {
      flex: 1,
      color: theme.textTertiary,
      fontSize: theme.typography.size.caption,
      lineHeight: theme.typography.lineHeight.caption,
      fontFamily: theme.typography.fontFamily.regular,
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
