import type { ActionFunction, LoaderFunction } from 'remix';
import { redirect } from 'remix';

import { logout } from '~/utils/session.server';

// this action was specified to run upon logout form post in jokes file
export const action: ActionFunction = async ({ request }) => {
  return logout(request);
};

// just here in case someone lands on this page, in which case redirect to home
export const loader: LoaderFunction = async () => {
  return redirect('/');
};
