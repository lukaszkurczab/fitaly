import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { useTranslation } from "react-i18next";

export type WeekDayItem = {
  date: Date;
  label?: string;
  isToday: boolean;
};

type Props = {
  days: WeekDayItem[];
  selectedDate: Date;
  onSelect: (d: Date) => void;
};

export default function WeekStrip({ days, selectedDate, onSelect }: Props) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { i18n } = useTranslation("history");
  const weekdayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n?.language || undefined, {
        weekday: "short",
      }),
    [i18n?.language],
  );

  return (
    <View style={styles.row}>
      <View style={styles.daysRow}>
        {days.map((d) => {
          const selected =
            d.date.toDateString() === selectedDate.toDateString();
          const hasWeekdayLabel =
            typeof d.label === "string" && /[^\d\s]/.test(d.label);
          const rawWeekdayLabel = hasWeekdayLabel
            ? d.label!
            : weekdayFormatter.format(d.date);
          const weekdayLabel = rawWeekdayLabel.replace(".", "");
          const dayNumber = String(d.date.getDate()).padStart(2, "0");

          return (
            <TouchableOpacity
              key={d.date.toISOString()}
              onPress={() => onSelect(d.date)}
              activeOpacity={0.92}
              accessibilityRole="button"
              accessibilityLabel={`${weekdayLabel} ${dayNumber}`}
              focusable={false}
              style={[
                styles.dayItem,
                selected && styles.dayItemSelected,
              ]}
            >
              <Text
                style={[
                  styles.weekdayText,
                  selected
                    ? styles.weekdayTextSelected
                    : styles.weekdayTextDefault,
                ]}
              >
                {weekdayLabel}
              </Text>
              <Text
                style={[
                  styles.dayNumberText,
                  selected
                    ? styles.dayNumberTextSelected
                    : styles.dayNumberTextDefault,
                  d.isToday ? styles.dayNumberToday : null,
                ]}
              >
                {dayNumber}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      width: "100%",
    },
    daysRow: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      gap: theme.spacing.xxs,
    },
    dayItem: {
      flex: 1,
      minWidth: 0,
      minHeight: 68,
      borderRadius: theme.rounded.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    dayItemSelected: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    weekdayText: {
      fontSize: theme.typography.size.overline,
      lineHeight: theme.typography.lineHeight.labelS,
      fontFamily: theme.typography.fontFamily.medium,
      textTransform: "uppercase",
    },
    weekdayTextDefault: {
      color: theme.textSecondary,
    },
    weekdayTextSelected: {
      color: theme.textInverse,
    },
    dayNumberText: {
      fontSize: theme.typography.size.numericM,
      lineHeight: theme.typography.lineHeight.numericM,
      fontFamily: theme.typography.fontFamily.semiBold,
    },
    dayNumberTextDefault: {
      color: theme.text,
    },
    dayNumberTextSelected: {
      color: theme.textInverse,
    },
    dayNumberToday: {
      fontFamily: theme.typography.fontFamily.semiBold,
    },
  });
