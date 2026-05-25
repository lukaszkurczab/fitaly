import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as FileSystem from "@/services/core/fileSystem";
import { useTheme } from "@/theme/useTheme";
import type { Meal } from "@/types/meal";
import { FallbackImage } from "@/feature/History/components/FallbackImage";
import { ensureLocalMealPhoto } from "@/services/meals/mealService.images";
import AppIcon from "@/components/AppIcon";

type MealThumbnailProps = {
  meal: Meal;
  size: number;
  borderRadius: number;
  placeholderLabel?: string;
  showPlaceholderIcon?: boolean;
};

export function MealThumbnail({
  meal,
  size,
  borderRadius,
  placeholderLabel,
  showPlaceholderIcon = false,
}: MealThumbnailProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const mealId = meal.cloudId || meal.mealId || "";

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
          // Ignore and fall back to repository resolution.
        }
      }

      const resolvedLocal = await ensureLocalMealPhoto({
        uid: meal.userUid,
        cloudId: meal.cloudId ?? null,
        imageId: meal.imageId ?? null,
        photoUrl: meal.photoUrl ?? null,
      });

      if (!cancelled) {
        setLocalUri(resolvedLocal);
      }
    }

    void restore();

    return () => {
      cancelled = true;
    };
  }, [
    meal.cloudId,
    meal.imageId,
    meal.localPhotoUrl,
    meal.mealId,
    meal.photoLocalPath,
    meal.photoUrl,
    meal.userUid,
    mealId,
  ]);

  const imageUri =
    localUri ||
    meal.photoLocalPath ||
    meal.localPhotoUrl ||
    meal.photoUrl ||
    null;

  useEffect(() => {
    setImageError(false);
  }, [imageUri]);

  if (imageUri && !imageError) {
    return (
      <FallbackImage
        uri={imageUri}
        width={size}
        height={size}
        borderRadius={borderRadius}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        {
          width: size,
          height: size,
          borderRadius,
        },
      ]}
    >
      {showPlaceholderIcon ? (
        <AppIcon
          name="image"
          size={Math.max(16, Math.round(size * 0.28))}
          color={theme.primary}
          style={styles.placeholderIcon}
        />
      ) : null}
      <Text style={styles.placeholderText}>
        {placeholderLabel ?? "No\nphoto"}
      </Text>
    </View>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    placeholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.backgroundSecondary,
      borderWidth: 1,
      borderColor: theme.borderSoft,
      overflow: "hidden",
      gap: 3,
    },
    placeholderIcon: {
      opacity: 0.82,
    },
    placeholderText: {
      color: theme.textTertiary,
      fontFamily: theme.typography.fontFamily.medium,
      fontSize: 9,
      lineHeight: 10,
      textAlign: "center",
    },
  });
