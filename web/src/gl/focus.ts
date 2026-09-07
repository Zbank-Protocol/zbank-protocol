/**
 * World X coordinate of the field's visual mass at each of the five morph states:
 * lattice, stream, core, reserve, haze.
 *
 * The sequence alternates sides so the mass travels across the frame through the scroll instead
 * of parking in one spot: the stream peels off to the right, the conversion core throws hard
 * left, the reserve settles right of centre, and the haze disperses around the middle.
 */
export const MASS_X = [0, 3.4, -3.6, 2.8, 0] as const;
