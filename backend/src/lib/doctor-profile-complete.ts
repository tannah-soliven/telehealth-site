/** SQL fragment: doctor_profiles row `d` has all required public fields filled. */
export const DOCTOR_PROFILE_COMPLETE_SQL = `
  d.first_name IS NOT NULL AND TRIM(d.first_name) <> ''
  AND d.last_name IS NOT NULL AND TRIM(d.last_name) <> ''
  AND d.specialty IS NOT NULL AND TRIM(d.specialty) <> ''
  AND d.bio IS NOT NULL AND TRIM(d.bio) <> ''
`;
