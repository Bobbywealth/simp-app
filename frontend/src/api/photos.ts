import { apiFetch } from './client';

export interface UploadedPhoto {
  id: string;
  photoId: string;
  url: string;
  thumbnailUrl: string;
  position: number;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
}

export function uploadPhoto(file: File) {
  const form = new FormData();
  form.append('photo', file);
  return apiFetch<UploadedPhoto>('/photos/upload', { method: 'POST', body: form });
}

export const deletePhoto = (id: string) =>
  apiFetch<{ ok: boolean }>(`/photos/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const reorderPhotos = (photoIds: string[]) =>
  apiFetch<{ photos: UploadedPhoto[] }>('/photos/reorder', {
    method: 'PUT',
    body: JSON.stringify({ photoIds }),
  });
export const setPrimaryPhoto = (id: string) =>
  apiFetch<{ ok: boolean }>(`/photos/${encodeURIComponent(id)}/primary`, { method: 'PATCH' });
