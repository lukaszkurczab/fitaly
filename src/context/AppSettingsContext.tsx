import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import i18n from "@/i18n";
import { useUserProfileContext } from "./UserProfileContext";

export type AppSettingsContextType = {
  language: string;
  changeLanguage: (lang: string) => Promise<void>;
};

const DEFAULT_LANGUAGE = "en";

function normalizeLanguageCode(language: string | null | undefined): "en" | "pl" {
  const normalized = (language || "").trim().toLowerCase();
  if (normalized === "pl" || normalized.startsWith("pl-")) return "pl";
  return "en";
}

const AppSettingsContext = createContext<AppSettingsContextType>({
  language: DEFAULT_LANGUAGE,
  changeLanguage: async () => {},
});

export const AppSettingsProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { userData, updateUser } = useUserProfileContext();
  const language = useMemo(
    () =>
      normalizeLanguageCode(
        userData?.profile.language ?? i18n.resolvedLanguage ?? i18n.language
      ),
    [userData?.profile.language]
  );

  useEffect(() => {
    if (normalizeLanguageCode(i18n.resolvedLanguage ?? i18n.language) === language) {
      return;
    }
    i18n.changeLanguage(language).catch(() => {
      // Runtime sync is best-effort here; profile remains canonical.
    });
  }, [language]);

  const changeLanguage = useCallback(
    async (lang: string) => {
      const nextLanguage = normalizeLanguageCode(lang);
      if (nextLanguage === language) {
        return;
      }

      if (!userData?.uid) {
        await i18n.changeLanguage(nextLanguage);
        return;
      }

      if (!userData.profile) return;
      await updateUser({
        profile: {
          ...userData.profile,
          language: nextLanguage,
        },
      });
    },
    [language, updateUser, userData]
  );

  const value = useMemo<AppSettingsContextType>(
    () => ({
      language,
      changeLanguage,
    }),
    [language, changeLanguage]
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettingsContext = () => useContext(AppSettingsContext);
