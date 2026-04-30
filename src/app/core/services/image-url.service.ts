import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ImageUrlService {
  private readonly base = (environment.apiUrl ?? '').replace(/\/$/, '');

  resolvePath(path: string | null | undefined): string | null {
    if (!path) return null;
    if (/^https?:\/\//i.test(path)) return path;
    const normalised = path.startsWith('/') ? path : `/${path}`;
    return `${this.base}${normalised}`;
  }
}
