import { View, Text, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { LineGraph } from "@/components";
import { useTranslation } from "react-i18next";

type WeeklyProgressGraphProps = {
  data: number[];
  labels: string[];
};

export const WeeklyProgressGraph = ({
  data,
  labels,
}: WeeklyProgressGraphProps) => {
  const theme = useTheme();
  const { t } = useTranslation("home");

  return (
    <View
      testID="weekly-progress-graph"
      style={[
        styles.container,
        {
          backgroundColor: theme.isDark
            ? "rgba(255,253,248,0.04)"
            : "rgba(255,253,248,0.52)",
          paddingTop: theme.spacing.md,
          paddingRight: theme.spacing.md,
          borderRadius: theme.rounded.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.borderSoft,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          {
            color: theme.text,
            fontSize: theme.typography.size.title,
            marginBottom: theme.spacing.md,
            paddingLeft: theme.spacing.md,
          },
        ]}
      >
        {t("weeklyProgress")}
      </Text>
      <LineGraph data={data} labels={labels} stepX={1} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {},
  title: { fontWeight: "700" },
});
