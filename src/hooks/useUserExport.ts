import { useCallback, useMemo } from "react";
import * as FileSystem from "@/services/core/fileSystem";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { exportUserData as fetchUserExportData } from "@/services/user/userService";
import { logWarning } from "@/services/core/errorLogger";

type UseUserExportParams = {
  uid: string;
  changeLanguage: (newLang: string) => Promise<void>;
};

type UseUserExportResult = {
  exportUserData: () => Promise<string | void>;
  changeLanguage: (newLang: string) => Promise<void>;
};

export function useUserExport({
  uid,
  changeLanguage,
}: UseUserExportParams): UseUserExportResult {
  const exportUserData = useCallback(async (): Promise<string | void> => {
    if (!uid) return;
    const data = await fetchUserExportData();
    const json = JSON.stringify(data, null, 2);

    const html = `
      <html>
        <head>
          <meta name="viewport" content="initial-scale=1, width=device-width" />
          <style>
            body { font-family: -apple-system, Roboto, Inter, Arial, sans-serif; padding: 16px; }
            h1 { font-size: 18px; margin: 0 0 12px 0; }
            pre { white-space: pre-wrap; word-wrap: break-word; font-size: 12px; background: #f5f5f5; padding: 12px; border-radius: 8px; }
          </style>
        </head>
        <body>
          <h1>Fitaly – User Data Export</h1>
          <pre>${json
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")}</pre>
        </body>
      </html>`;

    const { uri: tmpPdf } = await Print.printToFileAsync({ html });
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const filename = `fitaly_user_data_${yyyy}-${mm}-${dd}.pdf`;
    try {
      if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
        try {
          const perm =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (perm.granted && perm.directoryUri) {
            const fileUri =
              await FileSystem.StorageAccessFramework.createFileAsync(
                perm.directoryUri,
                filename,
                "application/pdf"
              );
            const pdfBase64 = await FileSystem.readAsStringAsync(tmpPdf, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await FileSystem.writeAsStringAsync(fileUri, pdfBase64, {
              encoding: FileSystem.EncodingType.Base64,
            });
            await Sharing.shareAsync(fileUri, {
              mimeType: "application/pdf",
              dialogTitle: "Fitaly – PDF",
            });
            return fileUri;
          }
          const fallback = FileSystem.documentDirectory! + filename;
          await FileSystem.copyAsync({ from: tmpPdf, to: fallback });
          await Sharing.shareAsync(fallback, {
            mimeType: "application/pdf",
            dialogTitle: "Fitaly – PDF",
          });
          return fallback;
        } catch (error) {
          logWarning("pdf export saf fallback used", null, error);
          const fallback = FileSystem.documentDirectory! + filename;
          await FileSystem.copyAsync({ from: tmpPdf, to: fallback });
          await Sharing.shareAsync(fallback, {
            mimeType: "application/pdf",
            dialogTitle: "Fitaly – PDF",
          });
          return fallback;
        }
      }

      const dest = FileSystem.documentDirectory! + filename;
      await FileSystem.copyAsync({ from: tmpPdf, to: dest });
      await Sharing.shareAsync(dest, {
        mimeType: "application/pdf",
        dialogTitle: "Fitaly – PDF",
      });
      return dest;
    } finally {
      FileSystem.deleteAsync(tmpPdf, { idempotent: true }).catch((error) => {
        logWarning("pdf cleanup failed", null, error);
      });
    }
  }, [uid]);

  return useMemo(
    () => ({
      exportUserData,
      changeLanguage,
    }),
    [changeLanguage, exportUserData]
  );
}
