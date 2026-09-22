import { BaseInstructorDetails } from './feature.model';

export interface InstructorListItem extends BaseInstructorDetails {
  designation: string;
  facebook_link: string | null;
  linkedin_link: string | null;
  youtube_link: string | null;
  instagram_link: string | null;
}
