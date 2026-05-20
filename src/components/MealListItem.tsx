import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import { FallbackImage } from "../feature/History/components/FallbackImage";
import { MacroChip } from "@/components/MacroChip";
import type { Meal } from "@/types/meal";
import { calculateTotalNutrients } from "@/utils/calculateTotalNutrients";
import * as FileSystem from "@/services/core/fileSystem";
import { useTranslation } from "react-i18next";
import AppIcon from "@/components/AppIcon";
import { ensureLocalMealPhoto } from "@/services/meals/mealService.images";
import { SyncStatusIndicator } from "@/components/SyncStatusIndicator";

type Props = {
  meal: Meal;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSelect?: () => void;
  selected?: boolean;
};

const ACTION_WIDTH = 168;

const MealListItemBase: React.FC<Props> = ({
  meal,
  onPress,
  onEdit,
  onDelete,
  onDuplicate,
  onSelect,
  selected = false,
}) => {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation(["common", "meals", "home"]);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [rowWidth, setRowWidth] = useState(0);

  const mealId = useMemo(
    () => String(meal.cloudId || meal.mealId || ""),
    [meal.cloudId, meal.mealId],
  );

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!mealId || !meal.userUid) return;

      const directLocal =
        meal.photoLocalPath || meal.localPhotoUrl || meal.photoUrl || "";

      if (
        directLocal &&
        (directLocal.startsWith("file://") ||
          directLocal.startsWith("content://"))
      ) {
        try {
          const info = await FileSystem.getInfoAsync(directLocal);
          if (info.exists) {
            if (!cancelled) setLocalUri(directLocal);
            return;
          }
        } catch {
          //
        }
      }

      const resolvedLocal = await ensureLocalMealPhoto({
        uid: meal.userUid,
        cloudId: meal.cloudId ?? null,
        imageId: meal.imageId ?? null,
        photoUrl: meal.photoUrl ?? null,
      });

      if (!cancelled) setLocalUri(resolvedLocal);
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [
    mealId,
    meal.userUid,
    meal.cloudId,
    meal.imageId,
    meal.photoLocalPath,
    meal.localPhotoUrl,
    meal.photoUrl,
  ]);

  const reveal = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const clamp = (v: number, a: number, b: number) =>
    Math.min(Math.max(v, a), b);

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dy) < 8,
      onPanResponderGrant: () => {
        reveal.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        const next = clamp(-g.dx, 0, ACTION_WIDTH);
        reveal.setValue(next);
      },
      onPanResponderRelease: (_, g) => {
        const velocity = -g.vx;
        const current = clamp(-g.dx, 0, ACTION_WIDTH);
        const target =
          current > ACTION_WIDTH * 0.4 || velocity > 0.6 ? ACTION_WIDTH : 0;

        Animated.spring(reveal, {
          toValue: target,
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start(() => {
          isOpen.current = target === ACTION_WIDTH;
        });
      },
      onPanResponderTerminate: () => {
        Animated.spring(reveal, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 18,
        }).start(() => {
          isOpen.current = false;
        });
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) =>
    setRowWidth(e.nativeEvent.layout.width);

  const nutrition = calculateTotalNutrients([meal]);
  const imageUri =
    localUri ||
    meal.photoLocalPath ||
    meal.localPhotoUrl ||
    meal.photoUrl ||
    null;

  const translateX = reveal.interpolate({
    inputRange: [0, ACTION_WIDTH],
    outputRange: [0, -ACTION_WIDTH],
    extrapolate: "clamp",
  });

  const handleCardPress = () => {
    if (isOpen.current) {
      Animated.spring(reveal, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
        speed: 18,
      }).start(() => {
        isOpen.current = false;
      });
      return;
    }

    onPress();
  };

  return (
    <View onLayout={onLayout} style={styles.root}>
      <View pointerEvents="box-none" style={styles.actionsLayer}>
        <View style={styles.actions}>
          <Pressable
            onPress={onDelete}
            accessibilityLabel={t("delete", { ns: "common" })}
            hitSlop={8}
            style={styles.actBtn}
          >
            <AppIcon name="delete" size={22} color={theme.error.text} />
          </Pressable>

          <Pressable
            onPress={onEdit}
            accessibilityLabel={t("edit", { ns: "common" })}
            hitSlop={8}
            style={styles.actBtn}
          >
            <AppIcon name="edit" size={22} color={theme.text} />
          </Pressable>

          <Pressable
            onPress={onDuplicate}
            accessibilityLabel={t("duplicate", { ns: "common" })}
            hitSlop={8}
            style={styles.actBtn}
          >
            <AppIcon name="copy" size={22} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.animatedRow,
          { transform: [{ translateX }], width: rowWidth || undefined },
        ]}
      >
        <Pressable
          onPress={handleCardPress}
          style={[styles.card, selected ? styles.cardSelected : null]}
        >
          {onSelect ? (
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={onSelect}
              hitSlop={12}
              style={styles.selectBoxWrap}
            >
              <View
                style={[
                  styles.selectCircle,
                  selected ? styles.selectCircleSelected : null,
                ]}
              >
                {selected ? <Text style={styles.checkMark}>✓</Text> : null}
              </View>
            </Pressable>
          ) : null}

          {imageUri ? (
            <FallbackImage
              uri={imageUri}
              width={72}
              height={72}
              borderRadius={theme.rounded.md}
            />
          ) : null}

          <View
            style={[
              styles.contentWrap,
              imageUri || onSelect ? styles.contentWithOffset : null,
            ]}
          >
            <View style={styles.headerRow}>
              <Text numberOfLines={1} style={styles.mealName}>
                {meal.name || t("meal", { ns: "home" })}
              </Text>

              <View style={styles.metaWrap}>
                <SyncStatusIndicator
                  syncState={meal.syncState}
                  testID={`meal-list-sync-${meal.syncState}`}
                />
                <Text numberOfLines={1} style={styles.kcalText}>
                  {nutrition.kcal} {t("kcal")}
                </Text>
              </View>
            </View>

            <View style={styles.chipsRow}>
              <MacroChip kind="protein" value={nutrition.protein} />
              <MacroChip kind="carbs" value={nutrition.carbs} />
              <MacroChip kind="fat" value={nutrition.fat} />
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
};

function areMealsEqual(a?: Meal, b?: Meal) {
  if (!a && !b) return true;
  if (!a || !b) return false;

  return (
    (a.cloudId || a.mealId) === (b.cloudId || b.mealId) &&
    a.updatedAt === b.updatedAt &&
    a.name === b.name &&
    (a.totals?.kcal ?? 0) === (b.totals?.kcal ?? 0) &&
    (a.totals?.protein ?? 0) === (b.totals?.protein ?? 0) &&
    (a.totals?.carbs ?? 0) === (b.totals?.carbs ?? 0) &&
    (a.totals?.fat ?? 0) === (b.totals?.fat ?? 0) &&
    a.syncState === b.syncState &&
    (a.imageId ?? null) === (b.imageId ?? null) &&
    (a.photoUrl ?? null) === (b.photoUrl ?? null)
  );
}

function propsEqual(prev: Props, next: Props) {
  return (
    areMealsEqual(prev.meal, next.meal) &&
    prev.selected === next.selected &&
    prev.onPress === next.onPress &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onDuplicate === next.onDuplicate &&
    prev.onSelect === next.onSelect
  );
}

export const MealListItem = React.memo(MealListItemBase, propsEqual);

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    root: {
      position: "relative",
      marginBottom: theme.spacing.md,
    },
    actionsLayer: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
    },
    animatedRow: {},
    card: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "center",
      paddingHorizontal: theme.spacing.sm + theme.spacing.xs,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.rounded.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      shadowColor: "#000000",
      shadowOpacity: theme.isDark ? 0.18 : 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    cardSelected: {
      borderColor: theme.primary,
      borderWidth: 2,
      shadowOpacity: theme.isDark ? 0.24 : 0.12,
    },
    selectBoxWrap: {
      width: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    selectCircle: {
      width: 22,
      height: 22,
      borderRadius: theme.rounded.full,
      borderWidth: 1.5,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    selectCircleSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    checkMark: {
      fontSize: 14,
      lineHeight: 14,
      color: theme.cta.primaryText,
      fontFamily: theme.typography.fontFamily.bold,
    },
    contentWrap: {
      flex: 1,
    },
    contentWithOffset: {
      marginLeft: theme.spacing.md,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: theme.spacing.xs + 2,
      gap: theme.spacing.sm,
    },
    metaWrap: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      flexShrink: 0,
    },
    chipsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: theme.spacing.sm,
    },
    mealName: {
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.text,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 0,
      marginRight: theme.spacing.sm,
      maxWidth: "68%",
    },
    kcalText: {
      fontSize: theme.typography.size.title,
      lineHeight: theme.typography.lineHeight.title,
      fontFamily: theme.typography.fontFamily.bold,
      color: theme.text,
      flexShrink: 0,
    },
    actions: {
      position: "absolute",
      right: 0,
      top: 0,
      bottom: 0,
      width: ACTION_WIDTH,
      paddingLeft: theme.spacing.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      borderRadius: theme.rounded.lg,
    },
    actBtn: {
      width: 48,
      height: "100%",
      borderRadius: theme.rounded.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceElevated,
      justifyContent: "center",
      alignItems: "center",
      flex: 1,
    },
  });
