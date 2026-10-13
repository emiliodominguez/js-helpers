/**
 * js-helpers — strictly-typed, zero-dependency TypeScript utilities.
 *
 * Every module is exposed as a namespace to avoid name collisions (e.g. `strings.isEmpty` vs `objects.isEmpty`).
 * Prefer deep imports (`js-helpers/arrays`) for the best tree-shaking.
 * @packageDocumentation
 */
export * as arrays from './arrays/index.js';
export * as async from './async/index.js';
export * as date from './date/index.js';
export * as decorators from './decorators/index.js';
export * as functions from './functions/index.js';
export * as guards from './guards/index.js';
export * as math from './math/index.js';
export * as objects from './objects/index.js';
export * as strings from './strings/index.js';
export type * from './utils/index.js';
