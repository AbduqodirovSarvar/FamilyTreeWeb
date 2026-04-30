import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/api-response.model';
import { FamilyTree } from '../models/tree.model';

@Injectable({ providedIn: 'root' })
export class FamilyService {
  private readonly http = inject(HttpClient);
  private readonly base = (environment.apiUrl ?? '').replace(/\/$/, '');

  /**
   * Public lookup: server resolves the family by surname and returns the tree
   * in a single round-trip. No auth — the route is anonymous.
   */
  getPublicTreeByName(familyName: string): Observable<ApiResponse<FamilyTree>> {
    const encoded = encodeURIComponent(familyName);
    return this.http.get<ApiResponse<FamilyTree>>(
      `${this.base}/api/Family/public/tree/${encoded}`
    );
  }
}
