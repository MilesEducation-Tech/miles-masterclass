export interface Track {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
}

export interface TracksResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Track[];
}

import { PaginationData } from './feature.model';
import { Content } from './course.model';
import { RouteConfig } from './http.model';

export interface ContentResponse {
  status_code: number;
  data: Content[];
  pagination_data?: PaginationData;
  // Legacy fields
  count?: number;
  next?: string | null;
  previous?: string | null;
}

export interface TrackWithContent extends Track {
  content: Content[];
  content_count: number;
}

export interface TrackListInterface {
  title: string;
  category: string;
  description: string;
  icon: string;
  params: string;
  cardName?: 'HorizontalLong' | 'Horizontal' | 'Vertical' | 'TrackV1' | 'TrackV2';
  content: Content[];
  ids: number[];
}

/**
 * Track API route configuration.
 * Similar to AUTH_ROUTES and FEATURE_ROUTES, provides centralized API path management.
 */
export const TRACK_ROUTES = {
  tracks: {
    path: 'tracks/',
    method: 'GET',
  } as RouteConfig<void, TracksResponse>,

  trackContent: {
    path: 'v2/tracks/:id/courses/',
    method: 'GET',
  } as RouteConfig<void, ContentResponse>,
} as const;
