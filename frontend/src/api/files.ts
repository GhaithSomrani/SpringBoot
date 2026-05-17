import api from './axios';

export interface UploadedFile {
  fileId: string;
  filename: string;
  contentType: string;
  size: number;
}

export async function uploadFile(file: File, groupId: string): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  form.append('groupId', groupId);
  const res = await api.post<{ data: UploadedFile }>('/api/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data;
}

export async function uploadFileWithProgress(
  file: File,
  groupId: string,
  onProgress: (pct: number) => void,
): Promise<UploadedFile> {
  const form = new FormData();
  form.append('file', file);
  form.append('groupId', groupId);
  const res = await api.post<{ data: UploadedFile }>('/api/files/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded * 100) / e.total));
    },
  });
  return res.data.data;
}

export async function deleteFile(fileId: string): Promise<void> {
  await api.delete(`/api/files/${fileId}`);
}
