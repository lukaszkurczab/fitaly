import { useCallback, useMemo } from "react";
import * as FileSystem from "@/services/core/fileSystem";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { exportUserData as fetchUserExportData } from "@/services/user/userService";
import { logWarning } from "@/services/core/errorLogger";
import { createServiceError } from "@/services/contracts/serviceError";

type UseUserExportParams = {
  uid: string;
  changeLanguage: (newLang: string) => Promise<void>;
};

type UseUserExportResult = {
  exportUserData: () => Promise<void>;
  changeLanguage: (newLang: string) => Promise<void>;
};

export function useUserExport({
  uid,
  changeLanguage,
}: UseUserExportParams): UseUserExportResult {
  const exportUserData = useCallback(async (): Promise<void> => {
    if (!uid.trim()) {
      throw createServiceError({
        code: "user/export-no-user",
        source: "UserExport",
        retryable: false,
        message: "A signed-in user is required to export account data.",
      });
    }

    let tmpPdf: string | null = null;
    try {
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

      tmpPdf = (await Print.printToFileAsync({ html })).uri;
      await Sharing.shareAsync(tmpPdf, {
        mimeType: "application/pdf",
        dialogTitle: "Fitaly – PDF",
      });
    } finally {
      if (tmpPdf) {
        FileSystem.deleteAsync(tmpPdf, { idempotent: true }).catch((error) => {
          logWarning("pdf cleanup failed", null, error);
        });
      }
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
