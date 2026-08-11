import { API_BASE_URL, getAccessToken } from './client';

export interface UploadedPhoto {
  photoId: string;
  url: string;
  position: number;
}

export async function uploadPhoto(file: File): Promise<UploadedPhoto> {
  const form = new FormData();
  form.append('photo', file);

  const res = await fetch(`${API_BASE_URL}/photos/upload`, {
    method: 'POST',
    headers: {
      Authorization: getAccessToken() ? `Bearer ${getAccessToken()}` : '',
    },
    body: form,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || body.message || `Upload failed (${res.status})`) as Error & {
      status?: number;
      code?: string;
    };
    err.status = res.status;
    err.code = body.error;
    throw err;
  }

  return (await res.json()) as UploadedPhoto;
}
