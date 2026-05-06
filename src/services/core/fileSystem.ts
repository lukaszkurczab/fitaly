import { Directory, File, Paths } from "expo-file-system";

type Encoding = "utf8" | "base64";

type InfoOptions = {
  md5?: boolean;
};

type ReadingOptions = {
  encoding?: Encoding;
  position?: number;
  length?: number;
};

type WritingOptions = {
  encoding?: Encoding;
  append?: boolean;
};

type DeletingOptions = {
  idempotent?: boolean;
};

type RelocatingOptions = {
  from: string;
  to: string;
};

type MakeDirectoryOptions = {
  intermediates?: boolean;
};

type DownloadOptions = {
  headers?: Record<string, string>;
};

type FileInfo = {
  exists: true;
  uri: string;
  isDirectory: boolean;
  size?: number;
  modificationTime?: number;
  md5?: string;
} | {
  exists: false;
  uri: string;
  isDirectory: false;
};

type FileSystemDownloadResult = {
  uri: string;
  status: number;
  headers: Record<string, string>;
  mimeType: string | null;
};

type StorageAccessFrameworkApi = {
  requestDirectoryPermissionsAsync: () => Promise<{
    granted: boolean;
    directoryUri?: string;
  }>;
  createFileAsync: (
    directoryUri: string,
    fileName: string,
    mimeType: string,
  ) => Promise<string>;
};

const ensureTrailingSlash = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return value.endsWith("/") ? value : `${value}/`;
};

const safePathUri = (getPath: () => string): string | null => {
  try {
    return ensureTrailingSlash(getPath());
  } catch {
    return null;
  }
};

const toHeadersObject = (headers: Headers): Record<string, string> => {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
};

const ensureParentDirectoryFor = (targetUri: string): void => {
  const slash = targetUri.lastIndexOf("/");
  if (slash <= "file://".length) return;
  const dirUri = targetUri.slice(0, slash + 1);
  new Directory(dirUri).create({ intermediates: true, idempotent: true });
};

const readFileInfo = (uri: string, options?: InfoOptions): FileInfo => {
  try {
    const fileInfo = new File(uri).info({ md5: options?.md5 });
    return {
      exists: true,
      uri,
      isDirectory: false,
      size: fileInfo.size,
      modificationTime: fileInfo.modificationTime ?? undefined,
      md5: fileInfo.md5 ?? undefined,
    };
  } catch {
    try {
      const dirInfo = new Directory(uri).info();
      return {
        exists: true,
        uri,
        isDirectory: true,
        size: dirInfo.size ?? undefined,
        modificationTime: dirInfo.modificationTime ?? undefined,
      };
    } catch {
      return {
        exists: false,
        uri,
        isDirectory: false,
      };
    }
  }
};

const downloadToFile = async (
  uri: string,
  fileUri: string,
  options?: DownloadOptions,
  signal?: AbortSignal,
): Promise<FileSystemDownloadResult | undefined> => {
  const response = await fetch(uri, {
    headers: options?.headers,
    signal,
  });

  const result: FileSystemDownloadResult = {
    uri: fileUri,
    status: response.status,
    headers: toHeadersObject(response.headers),
    mimeType: response.headers.get("content-type"),
  };

  if (!response.ok) {
    return result;
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  ensureParentDirectoryFor(fileUri);

  const file = new File(fileUri);
  try {
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Ignore stale-file cleanup failures before writing.
  }

  try {
    file.create({ intermediates: true, overwrite: true });
  } catch {
    // If the file already exists due to a race, proceed to write.
  }
  file.write(bytes);

  return result;
};

export const documentDirectory = safePathUri(() => Paths.document.uri);
export const cacheDirectory = safePathUri(() => Paths.cache.uri);

export const EncodingType = {
  UTF8: "utf8" as const,
  Base64: "base64" as const,
};

export const StorageAccessFramework: StorageAccessFrameworkApi | null = null;

export async function getInfoAsync(
  fileUri: string,
  options?: InfoOptions,
): Promise<FileInfo> {
  return readFileInfo(fileUri, options);
}

export async function readAsStringAsync(
  fileUri: string,
  options?: ReadingOptions,
): Promise<string> {
  const encoding = options?.encoding ?? EncodingType.UTF8;
  if (encoding === EncodingType.Base64) {
    return new File(fileUri).base64();
  }
  return new File(fileUri).text();
}

export async function writeAsStringAsync(
  fileUri: string,
  contents: string,
  options?: WritingOptions,
): Promise<void> {
  ensureParentDirectoryFor(fileUri);

  const file = new File(fileUri);
  try {
    file.create({ intermediates: true, overwrite: !options?.append });
  } catch {
    // File may already exist.
  }
  file.write(contents, {
    encoding: options?.encoding ?? EncodingType.UTF8,
    append: options?.append ?? false,
  });
}

export async function deleteAsync(
  fileUri: string,
  options?: DeletingOptions,
): Promise<void> {
  const info = readFileInfo(fileUri);
  if (!info.exists) {
    if (options?.idempotent) return;
    throw new Error(`Path does not exist: ${fileUri}`);
  }

  if (info.isDirectory) {
    try {
      new Directory(fileUri).delete();
    } catch (error) {
      if (options?.idempotent) return;
      throw error;
    }
  } else {
    try {
      new File(fileUri).delete();
    } catch (error) {
      if (options?.idempotent) return;
      throw error;
    }
  }
}

export async function moveAsync(options: RelocatingOptions): Promise<void> {
  const info = readFileInfo(options.from);
  if (info.exists && info.isDirectory) {
    ensureParentDirectoryFor(options.to);
    new Directory(options.from).move(new Directory(options.to));
    return;
  }

  ensureParentDirectoryFor(options.to);
  new File(options.from).move(new File(options.to));
}

export async function copyAsync(options: RelocatingOptions): Promise<void> {
  const info = readFileInfo(options.from);
  if (info.exists && info.isDirectory) {
    ensureParentDirectoryFor(options.to);
    new Directory(options.from).copy(new Directory(options.to));
    return;
  }

  ensureParentDirectoryFor(options.to);
  new File(options.from).copy(new File(options.to));
}

export async function makeDirectoryAsync(
  fileUri: string,
  options?: MakeDirectoryOptions,
): Promise<void> {
  new Directory(fileUri).create({
    intermediates: options?.intermediates,
    idempotent: true,
  });
}

export async function downloadAsync(
  uri: string,
  fileUri: string,
  options?: DownloadOptions,
): Promise<FileSystemDownloadResult> {
  const result = await downloadToFile(uri, fileUri, options);
  if (!result) {
    throw new Error("Download aborted");
  }
  return result;
}

export function createDownloadResumable(
  uri: string,
  fileUri: string,
  options?: DownloadOptions,
) {
  let abortController: AbortController | null = null;

  return {
    async downloadAsync(): Promise<FileSystemDownloadResult | undefined> {
      abortController = new AbortController();
      try {
        return await downloadToFile(uri, fileUri, options, abortController.signal);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          return undefined;
        }
        throw error;
      } finally {
        abortController = null;
      }
    },
    async pauseAsync(): Promise<void> {
      abortController?.abort();
    },
  };
}
