import { ArchivedDerashaEntry } from '../types';
import { getAccessToken } from './firebase';

const DRIVE_FOLDER_NAME = 'Darshán AI · Mis Derashot';
const DRIVE_API_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_FILES = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFileMeta {
  id: string;
  name: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
}

export interface DriveSyncSummary {
  connected: boolean;
  folderId: string | null;
  folderWebViewLink: string | null;
  filesBySequence: Record<number, DriveFileMeta>;
  totalDriveFiles: number;
  lastSyncedAt: string | null;
}

let cachedFolderMeta: { id: string; webViewLink: string } | null = null;

function sanitizeSlug(title: string): string {
  return (
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'Estudio'
  );
}

export function buildDriveFileNameForDerasha(entry: ArchivedDerashaEntry): string {
  const seqStr = String(entry.sequenceNumber).padStart(2, '0');
  const slug = sanitizeSlug(entry.title);
  return `Derasha_${seqStr}_${slug}.darshan.json`;
}

/**
 * Clears heavy local Derashot storage so the app occupies 0 KB locally when Drive persistence is active.
 */
export function clearLocalAppStorageForDriveMode(): void {
  try {
    localStorage.removeItem('darshan_derashot_archive_v1');
    localStorage.removeItem('darshan_last_study_v2');
    localStorage.removeItem('darshan_last_study_v1');
  } catch {
    // ignore storage errors
  }
}

/**
 * Finds or creates the dedicated "Darshán AI · Mis Derashot" folder in the user's Google Drive.
 */
export async function getOrCreateDarshanDriveFolder(): Promise<{
  id: string;
  webViewLink: string;
}> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Se requiere iniciar sesión con Google Drive para acceder a tu carpeta.');
  }

  if (cachedFolderMeta) {
    return cachedFolderMeta;
  }

  const q = encodeURIComponent(
    `mimeType = 'application/vnd.google-apps.folder' and name = '${DRIVE_FOLDER_NAME}' and trashed = false`
  );
  const searchRes = await fetch(
    `${DRIVE_API_FILES}?q=${q}&fields=files(id,name,webViewLink)&pageSize=1`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!searchRes.ok) {
    throw new Error(`Error al consultar carpeta en Google Drive (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    const f = searchData.files[0];
    cachedFolderMeta = {
      id: f.id,
      webViewLink: f.webViewLink || `https://drive.google.com/drive/folders/${f.id}`,
    };
    return cachedFolderMeta;
  }

  // Create folder
  const createRes = await fetch(`${DRIVE_API_FILES}?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
      description:
        'Carpeta personal de Derashot y estudios exegéticos generados en Darshán AI (sin ocupar espacio en la aplicación).',
    }),
  });

  if (!createRes.ok) {
    throw new Error(`No se pudo crear la carpeta en Google Drive (${createRes.status})`);
  }

  const created = await createRes.json();
  cachedFolderMeta = {
    id: created.id,
    webViewLink: created.webViewLink || `https://drive.google.com/drive/folders/${created.id}`,
  };
  return cachedFolderMeta;
}

/**
 * Lists all Derashot files stored in the user's Google Drive folder and downloads their contents.
 */
export async function loadUserDerashotFromGoogleDrive(): Promise<{
  entries: ArchivedDerashaEntry[];
  summary: DriveSyncSummary;
}> {
  const token = await getAccessToken();
  if (!token) {
    return {
      entries: [],
      summary: {
        connected: false,
        folderId: null,
        folderWebViewLink: null,
        filesBySequence: {},
        totalDriveFiles: 0,
        lastSyncedAt: null,
      },
    };
  }

  const folder = await getOrCreateDarshanDriveFolder();
  const q = encodeURIComponent(`'${folder.id}' in parents and trashed = false`);
  const listRes = await fetch(
    `${DRIVE_API_FILES}?q=${q}&fields=files(id,name,webViewLink,modifiedTime,size)&pageSize=100&orderBy=name`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!listRes.ok) {
    throw new Error(`Error al listar Derashot en Google Drive (${listRes.status})`);
  }

  const listData = await listRes.json();
  const rawFiles: DriveFileMeta[] = Array.isArray(listData.files) ? listData.files : [];
  const darshanFiles = rawFiles.filter((f) => f.name.endsWith('.darshan.json'));

  const filesBySequence: Record<number, DriveFileMeta> = {};
  const loadedEntries: ArchivedDerashaEntry[] = [];

  await Promise.all(
    darshanFiles.map(async (fileMeta) => {
      try {
        const contentRes = await fetch(`${DRIVE_API_FILES}/${fileMeta.id}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!contentRes.ok) return;
        const parsed = (await contentRes.json()) as ArchivedDerashaEntry;
        if (parsed && typeof parsed.sequenceNumber === 'number' && parsed.title) {
          filesBySequence[parsed.sequenceNumber] = fileMeta;
          loadedEntries.push(parsed);
        }
      } catch {
        // ignore malformed file
      }
    })
  );

  loadedEntries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

  return {
    entries: loadedEntries,
    summary: {
      connected: true,
      folderId: folder.id,
      folderWebViewLink: folder.webViewLink,
      filesBySequence,
      totalDriveFiles: loadedEntries.length,
      lastSyncedAt: new Date().toISOString(),
    },
  };
}

/**
 * Creates a NEW Derashá file in the user's Google Drive folder (non-destructive creation).
 */
export async function createNewDerashaFileInGoogleDrive(
  entry: ArchivedDerashaEntry
): Promise<DriveFileMeta> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Se requiere sesión activa de Google Drive para guardar la Derashá.');
  }

  const folder = await getOrCreateDarshanDriveFolder();
  const fileName = buildDriveFileNameForDerasha(entry);

  const metadata = {
    name: fileName,
    parents: [folder.id],
    mimeType: 'application/json',
    description: `Derashá #${entry.sequenceNumber}: ${entry.title} (${entry.methodology})`,
  };

  const boundary = 'darshan_drive_multipart_boundary_' + Date.now();
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(entry, null, 2)}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    `${DRIVE_UPLOAD_FILES}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime,size`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!uploadRes.ok) {
    throw new Error(`No se pudo crear el archivo en Google Drive (${uploadRes.status})`);
  }

  return (await uploadRes.json()) as DriveFileMeta;
}

/**
 * Overwrites/updates an existing Derashá file in Google Drive.
 * MUST only be called after explicit user confirmation in UI!
 */
export async function updateExistingDerashaFileInGoogleDrive(
  fileId: string,
  entry: ArchivedDerashaEntry
): Promise<DriveFileMeta> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Se requiere sesión activa de Google Drive para actualizar la Derashá.');
  }

  const fileName = buildDriveFileNameForDerasha(entry);
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    description: `Derashá #${entry.sequenceNumber}: ${entry.title} (${entry.methodology})`,
  };

  const boundary = 'darshan_drive_update_boundary_' + Date.now();
  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(entry, null, 2)}\r\n` +
    `--${boundary}--`;

  const updateRes = await fetch(
    `${DRIVE_UPLOAD_FILES}/${fileId}?uploadType=multipart&fields=id,name,webViewLink,modifiedTime,size`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    }
  );

  if (!updateRes.ok) {
    throw new Error(`No se pudo actualizar el archivo en Google Drive (${updateRes.status})`);
  }

  return (await updateRes.json()) as DriveFileMeta;
}

/**
 * Deletes an existing Derashá file from Google Drive.
 * MUST only be called after explicit user confirmation in UI!
 */
export async function deleteDerashaFileFromGoogleDrive(fileId: string): Promise<void> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Se requiere sesión activa de Google Drive para eliminar el archivo.');
  }

  const delRes = await fetch(`${DRIVE_API_FILES}/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!delRes.ok && delRes.status !== 404) {
    throw new Error(`No se pudo eliminar el archivo de Google Drive (${delRes.status})`);
  }
}

export function resetDriveFolderCache(): void {
  cachedFolderMeta = null;
}
