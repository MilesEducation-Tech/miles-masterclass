import { inject, Injectable } from '@angular/core';
import { HttpContext } from '@angular/common/http';
import { forkJoin, map, Observable, switchMap, expand, reduce, EMPTY, of, catchError } from 'rxjs';
import {
  ContentResponse,
  Track,
  TrackListInterface,
  TracksResponse,
  TrackWithContent,
  TRACK_ROUTES,
} from '../../../../shared/core/models/track.model';
import { Logger } from '../../../../shared/core/services/logger/logger';
import { ApiClient } from '../../../../shared/core/services/api-client/api-client';
import { Content } from '../../../../shared/core/models/course.model';
import { SKIP_ERROR_NOTIFICATION } from '../../../../shared/core/models/http.model';

@Injectable()
export class Tracks {
  private readonly http = inject(ApiClient);
  private readonly logger = inject(Logger);
  private readonly silentContext = {
    context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
  };

  /**
   * Fetches tracks from the API with pagination support
   */
  getTracks(page = 1): Observable<TracksResponse> {
    return this.http.get<TracksResponse>(TRACK_ROUTES.tracks.path, {
      params: { page: page.toString() },
      ...this.silentContext,
    });
  }

  /**
   * Fetches all tracks by automatically handling pagination
   */
  getAllTracks(): Observable<Track[]> {
    return this.getTracks(1).pipe(
      expand((response) =>
        response.next ? this.getTracks(this.extractPageFromUrl(response.next)) : EMPTY,
      ),
      reduce((acc: Track[], current) => [...acc, ...current.results], []),
    );
  }

  /**
   * Fetches only active tracks
   */
  getActiveTracks(): Observable<Track[]> {
    return this.getAllTracks().pipe(map((tracks) => tracks.filter((track) => track.is_active)));
  }

  /**
   * Fetches content for a specific track page
   */
  private getTrackContentPage(
    trackId: number,
    courseType = 'masterclass',
    page = 1,
  ): Observable<ContentResponse> {
    const path = TRACK_ROUTES.trackContent.path.replace(':id', trackId.toString());
    return this.http.get<ContentResponse>(path, {
      params: {
        course_type: courseType,
        page: page.toString(),
      },
      ...this.silentContext,
    });
  }

  /**
   * Fetches all content for a specific track
   */
  getTrackContent(trackId: number, courseType = 'masterclass'): Observable<Content[]> {
    return this.getTrackContentPage(trackId, courseType, 1).pipe(
      reduce((acc: Content[], current) => [...acc, ...current.data], []),
      catchError((err) => {
        this.logger.error('Failed to fetch track content', err, {
          service: 'Tracks',
          method: 'getTrackContent',
          trackId,
          courseType,
        });
        return of([]);
      }),
    );
  }

  /**
   * Fetches active tracks with their content
   */
  getActiveTracksWithContent(courseType = 'masterclass'): Observable<TrackWithContent[]> {
    return this.getActiveTracks().pipe(
      switchMap((tracks: Track[]) => {
        if (tracks.length === 0) {
          return of([]);
        }

        const contentObservables = tracks.map((track) =>
          this.getTrackContent(track.id, courseType).pipe(
            map((content: Content[]): TrackWithContent => ({
              ...track,
              content,
              content_count: content.length,
            })),
          ),
        );

        return forkJoin(contentObservables);
      }),
      catchError((err) => {
        this.logger.error('Failed to fetch active tracks with content', err, {
          service: 'Tracks',
          method: 'getActiveTracksWithContent',
          courseType,
        });
        return of([]);
      }),
    );
  }

  /**
   * Fetches active tracks with content preview (first page only)
   */
  getActiveTracksWithContentPreview(courseType = 'masterclass'): Observable<TrackWithContent[]> {
    return this.getActiveTracks().pipe(
      switchMap((tracks: Track[]) => {
        if (tracks.length === 0) {
          return of([]);
        }

        const contentObservables = tracks.map((track) =>
          this.getTrackContentPage(track.id, courseType, 1).pipe(
            map((response: ContentResponse): TrackWithContent => ({
              ...track,
              content: response.data,
              content_count: response.count ?? 0,
            })),
          ),
        );

        return forkJoin(contentObservables);
      }),
      catchError((err) => {
        this.logger.error('Failed to fetch active tracks with content preview', err, {
          service: 'Tracks',
          method: 'getActiveTracksWithContentPreview',
          courseType,
        });
        return of([]);
      }),
    );
  }

  /**
   * Transforms tracks into TrackList format for UI components
   */
  getTracksAsTrackListFormat(courseType = 'masterclass'): Observable<TrackListInterface[]> {
    return this.getActiveTracksWithContent(courseType).pipe(
      map((tracksWithContent) =>
        tracksWithContent.map((track) => ({
          title: track.name,
          category: track.name,
          description: track.description,
          icon: '',
          params: `track_${track.id}`,
          cardName: 'TrackV1' as const,
          content: track.content,
          ids: [track.id],
        })),
      ),
    );
  }

  /**
   * Utility method to extract page number from pagination URL
   */
  private extractPageFromUrl(url: string | null): number {
    if (!url) return 1;

    try {
      const urlObj = new URL(url);
      const page = urlObj.searchParams.get('page');
      return page ? parseInt(page, 10) : 1;
    } catch {
      return 1;
    }
  }
}
