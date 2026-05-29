import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  Dimensions,
  Platform,
  StyleProp,
  ViewStyle,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import AppIcon from "@/components/AppIcon";
import { useTranslation } from "react-i18next";
import { Checkbox } from "@/components/Checkbox";
import {
  getPickerControlStyleParts,
  type PickerControlSurfaceTone,
  PICKER_MENU_BOTTOM_OFFSET,
  PICKER_MENU_MAX_HEIGHT,
} from "@/components/pickerControlStyles";

type Option<T extends string | number> = {
  label: string;
  value: T;
  disabled?: boolean;
};

type CheckboxDropdownProps<T extends string | number> = {
  label?: string;
  options: Option<T>[];
  values: T[];
  onChange: (values: T[]) => void;
  error?: string;
  disabled?: boolean;
  disabledValues?: T[];
  style?: StyleProp<ViewStyle>;
  renderLabel?: (option: Option<T>) => React.ReactNode;
  surfaceTone?: PickerControlSurfaceTone;
  testID?: string;
};

type DropdownPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function CheckboxDropdown<T extends string | number>({
  label,
  options,
  values,
  onChange,
  error,
  disabled,
  disabledValues,
  style,
  renderLabel,
  surfaceTone = "default",
  testID,
}: CheckboxDropdownProps<T>) {
  const theme = useTheme();
  const styles = useMemo(
    () => makeStyles(theme, surfaceTone),
    [surfaceTone, theme],
  );
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";
  const { t } = useTranslation("common");

  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);

  const fieldRef = useRef<View>(null);

  const blockedSet = useMemo(() => {
    const set = new Set<T>(disabledValues ?? []);
    options.forEach((option) => {
      if (option.disabled) set.add(option.value);
    });
    return set;
  }, [options, disabledValues]);

  const selectedLabels = useMemo(
    () =>
      options
        .filter((o) => values.includes(o.value))
        .map((o) => o.label)
        .join(", "),
    [values, options],
  );

  const updateDropdownPosition = useCallback(() => {
    if (!fieldRef.current) return;

    fieldRef.current.measureInWindow((x, y, width, height) => {
      setDropdownPos({ x, y, width, height });
    });
  }, []);

  const openDropdown = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(updateDropdownPosition, 1);
  };

  useEffect(() => {
    if (!open) return;

    updateDropdownPosition();
    const subscription = Dimensions.addEventListener(
      "change",
      updateDropdownPosition,
    );

    return () => subscription?.remove();
  }, [open, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;

    const interval = setInterval(updateDropdownPosition, 200);
    return () => clearInterval(interval);
  }, [open, updateDropdownPosition]);

  const handleToggle = (value: T) => {
    if (disabled || blockedSet.has(value)) return;

    if (values.includes(value)) {
      onChange(values.filter((item) => item !== value));
      return;
    }

    onChange([...values, value]);
  };

  const menuMaxHeight = dropdownPos
    ? Math.min(
        PICKER_MENU_MAX_HEIGHT,
        Dimensions.get("window").height -
          (dropdownPos.y + dropdownPos.height) -
          PICKER_MENU_BOTTOM_OFFSET,
      )
    : PICKER_MENU_MAX_HEIGHT;

  const menuPositionStyle = useMemo(
    () =>
      dropdownPos
        ? {
            top: dropdownPos.y + dropdownPos.height,
            left: dropdownPos.x,
            width: dropdownPos.width,
            maxHeight: menuMaxHeight,
          }
        : null,
    [dropdownPos, menuMaxHeight],
  );

  return (
    <View style={style} testID={testID}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <Pressable
        ref={fieldRef}
        style={[
          styles.field,
          open ? styles.fieldOpen : null,
          error ? styles.fieldError : null,
          disabled ? styles.fieldDisabled : null,
        ]}
        onPress={openDropdown}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        testID={testID ? `${testID}-field` : "checkbox-dropdown-field"}
      >
        <Text
          style={[
            styles.valueText,
            !selectedLabels ? styles.valueTextPlaceholder : null,
          ]}
          numberOfLines={1}
        >
          {selectedLabels || t("none")}
        </Text>

        <AppIcon
          name="chevron"
          rotation={open ? "90deg" : "-90deg"}
          size={20}
          color={theme.textSecondary}
          style={styles.fieldIcon}
        />
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {open && dropdownPos ? (
        <Modal
          transparent
          animationType="none"
          visible={open}
          onRequestClose={() => setOpen(false)}
        >
          <View style={styles.modalRoot}>
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setOpen(false)}
            />

            <View style={[styles.menu, menuPositionStyle]}>
              <ScrollView
                nestedScrollEnabled
                contentContainerStyle={styles.menuContent}
                keyboardDismissMode={keyboardDismissMode}
                keyboardShouldPersistTaps="handled"
              >
                {options.map((item) => {
                  const isSelected = values.includes(item.value);
                  const isDisabled = !!disabled || blockedSet.has(item.value);

                  return (
                    <TouchableOpacity
                      key={String(item.value)}
                      onPress={() => handleToggle(item.value)}
                      style={[
                        styles.option,
                        isSelected ? styles.optionSelected : null,
                        isDisabled ? styles.optionDisabled : null,
                      ]}
                      accessibilityRole="checkbox"
                      accessibilityLabel={item.label}
                      accessibilityState={{
                        checked: isSelected,
                        disabled: isDisabled,
                      }}
                      disabled={isDisabled}
                      activeOpacity={0.75}
                    >
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleToggle(item.value)}
                        disabled={isDisabled}
                        style={styles.optionCheckbox}
                        accessibilityLabel={item.label}
                      />

                      <View style={styles.optionLabelWrap}>
                        {renderLabel ? (
                          renderLabel(item)
                        ) : (
                          <Text
                            style={[
                              styles.optionText,
                              isDisabled ? styles.optionTextDisabled : null,
                            ]}
                          >
                            {item.label}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const makeStyles = (
  theme: ReturnType<typeof useTheme>,
  surfaceTone: PickerControlSurfaceTone,
) => {
  const control = getPickerControlStyleParts(theme, { surfaceTone });

  return StyleSheet.create({
    ...control,
    valueText: {
      ...control.valueText,
      flex: 1,
    },
    valueTextPlaceholder: {
      color: theme.input.placeholder,
    },
    modalRoot: {
      flex: 1,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
      zIndex: 1,
    },
    menuContent: {
      flexGrow: 1,
    },
    option: {
      ...control.option,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "transparent",
      opacity: 1,
    },
    optionDisabled: {
      opacity: 0.45,
    },
    optionCheckbox: {
      marginRight: theme.spacing.sm,
    },
    optionLabelWrap: {
      flex: 1,
    },
    optionText: {
      ...control.optionText,
      flex: 1,
    },
    optionTextDisabled: {
      color: theme.textSecondary,
    },
  });
};
