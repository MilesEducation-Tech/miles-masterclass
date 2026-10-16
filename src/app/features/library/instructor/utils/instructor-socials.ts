import { INSTRUCTOR_SOCIAL_ICONS } from '@features/library/instructor/constants/instructor-library';
import {
  InstructorSocial,
  InstructorSocialLink,
} from '@features/library/instructor/models/instructor-library.model';

/**
 * The social links to show, in the API's `social_media_order`. A known network
 * gets its `@ng-icons/svgl` icon, any other the icon URL the API sends; a link
 * with no URL, or with no icon of either kind, is dropped.
 */
export function socialLinksOf(socials: readonly InstructorSocial[]): InstructorSocialLink[] {
  return [...socials]
    .sort((a, b) => a.social_media_order - b.social_media_order)
    .map((social) => ({
      label: social.social_media_title,
      url: social.social_media_url,
      icon: INSTRUCTOR_SOCIAL_ICONS[social.social_media_title.toLowerCase()] ?? null,
      iconUrl: social.social_media_icon_url || null,
    }))
    .filter((link) => !!link.url && !!(link.icon || link.iconUrl));
}
