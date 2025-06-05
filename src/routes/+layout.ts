import type { LayoutLoad } from './$types';

export const load: LayoutLoad = ({ locals }) => {
  // locals.user is populated by hooks.server.ts
  return {
    user: locals.user
  };
};
