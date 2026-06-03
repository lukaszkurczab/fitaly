import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { RootStackParamList } from "@/navigation/navigate";
import { useTheme } from "@/theme/useTheme";
import { useAppSettingsContext } from "@/context/AppSettingsContext";
import {
  FormScreenShell,
  InfoBlock,
  SettingsRow,
  SettingsSection,
} from "@/components";
import AppIcon from "@/components/AppIcon";

type LanguageNavigation = StackNavigationProp<RootStackParamList, "Language">;

type LanguageScreenProps = {
  navigation: LanguageNavigation;
};

type LanguageOption = {
  code: string;
  label: string;
};

const LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English" },
  { code: "pl", label: "Polski" },
];

export default function LanguageScreen({ navigation }: LanguageScreenProps) {
  const theme = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { t } = useTranslation("profile");
  const { language, changeLanguage } = useAppSettingsContext();
  const [selected, setSelected] = useState(language || "en");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (language && language !== selected) {
      setSelected(language);
    }
  }, [language, selected]);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    navigation.navigate("AppSettings");
  };

  const handleSelect = async (code: string) => {
    if (code === selected || saving) return;

    setSelected(code);
    setSaving(true);

    try {
      await changeLanguage(code);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormScreenShell
      title={t("language", { defaultValue: "Language" })}
      intro={t("languageScreenIntro", {
        defaultValue:
          "Choose the language used across your account and the rest of the app.",
      })}
      onBack={handleBack}
    >
      <View style={styles.content}>
        <InfoBlock
          title={t("languageInfoTitle", {
            defaultValue: "App language",
          })}
          body={t("languageInfoBody", {
            defaultValue:
              "The selected language applies across Fitaly and updates after the change is saved.",
          })}
          tone="info"
          icon={<AppIcon name="palette" size={18} color={theme.info.text} />}
        />

        <SettingsSection
          title={t("languageOptionsTitle", {
            defaultValue: "Available languages",
          })}
        >
          {LANGUAGES.map((option) => (
            <SettingsRow
              key={option.code}
              title={option.label}
              subtitle={
                selected === option.code
                  ? t("languageCurrentLabel", {
                      defaultValue: "Current language",
                    })
                  : undefined
              }
              onPress={() => {
                void handleSelect(option.code);
              }}
              loading={saving && selected === option.code}
              showChevron={false}
              trailing={
                selected === option.code ? (
                  <AppIcon
                    name="check"
                    size={18}
                    color={theme.primary}
                  />
                ) : undefined
              }
            />
          ))}
        </SettingsSection>
      </View>
    </FormScreenShell>
  );
}

const makeStyles = (theme: ReturnType<typeof useTheme>) =>
  StyleSheet.create({
    content: {
      gap: theme.spacing.sectionGap,
    },
  });
