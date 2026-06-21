import { useMemo } from "react";
import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import AppIcon, { type AppIconName } from "@/components/AppIcon";
import InfoBlock from "@/components/InfoBlock";
import { useTheme } from "@/theme/useTheme";

type RuntimeFeatureDisabledStateProps = {
  testID: string;
  title: string;
  body: string;
  icon?: AppIconName;
  style?: StyleProp<ViewStyle>;
};

export default function RuntimeFeatureDisabledState({
  testID,
  title,
  body,
  icon = "lock",
  style,
}: RuntimeFeatureDisabledStateProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <InfoBlock
      testID={testID}
      title={title}
      body={body}
      tone="neutral"
      style={[styles.state, style]}
      icon={<AppIcon name={icon} size={18} color={theme.textSecondary} />}
    />
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    state: {
      ...theme.depth.raised,
    },
  });
