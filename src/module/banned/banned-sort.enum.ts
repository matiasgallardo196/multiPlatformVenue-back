/**
 * Enum for ban list sort options
 * Defines all valid sorting options for banneds endpoints
 */
export enum BannedSortOption {
  VIOLATIONS_DESC = 'violations-desc',
  VIOLATIONS_ASC = 'violations-asc',
  STARTING_DATE_DESC = 'starting-date-desc',
  STARTING_DATE_ASC = 'starting-date-asc',
  ENDING_DATE_DESC = 'ending-date-desc',
  ENDING_DATE_ASC = 'ending-date-asc',
  PERSON_NAME_ASC = 'person-name-asc',
  PERSON_NAME_DESC = 'person-name-desc',
}

export const DEFAULT_BANNED_SORT = BannedSortOption.VIOLATIONS_DESC;

/**
 * Validates if a string is a valid BannedSortOption
 */
export function isValidBannedSortOption(value: string | undefined): value is BannedSortOption {
  if (!value) return false;
  return Object.values(BannedSortOption).includes(value as BannedSortOption);
}

/**
 * Gets a valid sort option or returns the default
 */
export function getSortOptionOrDefault(value: string | undefined): BannedSortOption {
  return isValidBannedSortOption(value) ? value : DEFAULT_BANNED_SORT;
}
