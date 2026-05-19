import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  Platform,
  StyleProp,
  ViewStyle,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/theme/useTheme";
import AppIcon from "@/components/AppIcon";
import {
  getPickerControlStyleParts,
  PICKER_MENU_BOTTOM_OFFSET,
  PICKER_MENU_MAX_HEIGHT,
} from "@/components/pickerControlStyles";

type Option<T extends string> = {
  label: string;
  value: T | null;
};

type Props<T extends string> = {
  label?: string;
  value: T | null;
  options: Option<T>[];
  onChange: (value: T | null) => void;
  error?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  renderLabel?: (option: Option<T>) => React.ReactNode;
  testID?: string;
};

type DropdownPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  error,
  disabled,
  style,
  renderLabel,
  testID,
}: Props<T>) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const keyboardDismissMode: "none" | "interactive" | "on-drag" =
    Platform.OS === "ios" ? "interactive" : "on-drag";

  const [open, setOpen] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);

  const fieldRef = useRef<View>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  const handleOutsidePress = () => setOpen(false);

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
        onPress={() => !disabled && openDropdown()}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, expanded: open }}
        testID={testID ? `${testID}-field` : "dropdown-field"}
      >
        <View style={styles.fieldContent}>
          {selected ? (
            renderLabel ? (
              renderLabel(selected)
            ) : (
              <Text style={styles.selectedText} numberOfLines={1}>
                {selected.label}
              </Text>
            )
          ) : (
            <Text style={styles.placeholderText} numberOfLines={1}>
              —
            </Text>
          )}
        </View>

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
          onRequestClose={handleOutsidePress}
        >
          <View style={styles.modalRoot}>
            <Pressable style={styles.modalOverlay} onPress={handleOutsidePress} />
            <View style={[styles.menu, menuPositionStyle]}>
              <ScrollView
                nestedScrollEnabled
                keyboardDismissMode={keyboardDismissMode}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.menuContent}
              >
                {options.map((item, idx) => {
                  const isSelected = value === item.value;

                  return (
                    <TouchableOpacity
                      key={`${item.value ?? "null"}-${idx}`}
                      onPress={() => {
                        setOpen(false);
                        onChange(item.value);
                      }}
                      style={[
                        styles.option,
                        isSelected ? styles.optionSelected : null,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={item.label}
                      activeOpacity={0.75}
                    >
                      {renderLabel ? (
                        renderLabel(item)
                      ) : (
                        <Text
                          style={[
                            styles.optionText,
                            isSelected ? styles.optionTextSelected : null,
                          ]}
                        >
                          {item.label}
                        </Text>
                      )}
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

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    ...getPickerControlStyleParts(theme),
    fieldContent: {
      flex: 1,
      justifyContent: "center",
    },
    selectedText: getPickerControlStyleParts(theme).valueText,
    modalRoot: {
      flex: 1,
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "transparent",
      zIndex: 1,
    },
  });
