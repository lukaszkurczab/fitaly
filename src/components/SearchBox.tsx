import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import AppIcon from "@/components/AppIcon";
import { useTranslation } from "react-i18next";
import { TextInput } from "@/components/TextInput";

type Props = {
  value: string;
  onChange: (text: string) => void;
  placeholder?: string;
  debounceMs?: number;
  style?: StyleProp<ViewStyle>;
  fieldStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  iconSize?: number;
};

export const SearchBox: React.FC<Props> = ({
  value,
  onChange,
  placeholder,
  debounceMs = 200,
  style,
  fieldStyle,
  inputStyle,
  iconSize = 20,
}) => {
  const { t } = useTranslation();

  const [local, setLocal] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const apply = (txt: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange(txt), debounceMs);
  };

  const onTextChange = (txt: string) => {
    setLocal(txt);
    apply(txt);
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setLocal("");
    onChange("");
  };

  return (
    <TextInput
      value={local}
      onChangeText={onTextChange}
      placeholder={placeholder ?? t("input.search")}
      returnKeyType="search"
      accessibilityLabel={t("input.search_accessibility")}
      autoCorrect={false}
      spellCheck={false}
      left={<AppIcon name="search" size={iconSize} />}
      right={
        local.length > 0 ? (
          <Pressable
            onPress={clear}
            accessibilityRole="button"
            accessibilityLabel={t("input.clear_search_accessibility")}
          >
            <AppIcon name="close" size={18} />
          </Pressable>
        ) : null
      }
      style={style}
      fieldStyle={fieldStyle}
      inputStyle={inputStyle}
    />
  );
};
