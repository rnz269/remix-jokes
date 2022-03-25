import type { ActionFunction, LoaderFunction, MetaFunction } from 'remix';
import { useLoaderData, json, useParams, useCatch, redirect } from 'remix';
import invariant from 'tiny-invariant';
import type { Joke } from '@prisma/client';
import { db } from '~/utils/db.server';
import { requireUserId, getUserId } from '~/utils/session.server';
import { JokeDisplay } from '~/components/jokes';

type LoaderData = { joke: Joke; isOwner: boolean };

export const meta: MetaFunction = ({
  data,
}: {
  data: LoaderData | undefined;
}) => {
  if (!data) {
    return {
      title: 'No joke',
      description: 'No joke found',
    };
  }
  return {
    title: `"${data.joke.name}" joke`,
    description: `Enjoy the "${data.joke.name}" joke and much more`,
  };
};

export const loader: LoaderFunction = async ({ request, params }) => {
  invariant(params.jokeId, 'expected params.jokeId');
  const userId = await getUserId(request);
  const joke = await db.joke.findUnique({
    where: {
      id: params.jokeId,
    },
  });
  if (!joke) {
    throw new Response('What a joke! Not found.', {
      status: 404,
    });
  }

  const isOwner = joke.jokesterId === userId;
  const data: LoaderData = { joke, isOwner };
  return json(data);
};

export const action: ActionFunction = async ({ request, params }) => {
  const form = await request.formData();

  // ensure that the input value is delete
  if (form.get('_method') !== 'delete') {
    throw new Response(`The _method ${form.get('_method')} is not supported`, {
      status: 400,
    });
  }

  // get the user's id
  const userId = await requireUserId(request);

  // find the joke the user is trying to delete
  const joke = await db.joke.findUnique({
    where: { id: params.jokeId },
  });

  // if joke DNE, throw error
  if (!joke) {
    throw new Response("Can't delete what does not exist", {
      status: 404,
    });
  }

  // joke exists, user is signed in. if user is not joke author, throw errro
  if (joke.jokesterId !== userId) {
    throw new Response("Pssh, nice try. That's not your joke", {
      status: 401,
    });
  }

  // the user is the author. delete the joke.
  await db.joke.delete({ where: { id: params.jokeId } });
  return redirect('/jokes');
};

export default function JokeRoute() {
  const data = useLoaderData<LoaderData>();
  return <JokeDisplay joke={data.joke} isOwner={data.isOwner} />;
}

export function CatchBoundary() {
  const caught = useCatch();
  const params = useParams();
  switch (caught.status) {
    case 400: {
      return (
        <div className="error-container">
          What you're trying to do is not allowed.
        </div>
      );
    }
    case 404: {
      return (
        <div className="error-container">
          Huh? What the heck is {params.jokeId}?
        </div>
      );
    }
    case 401: {
      return (
        <div className="error-container">
          Sorry, but {params.jokeId} is not your joke.
        </div>
      );
    }
    default: {
      throw new Error(`Unhandled error: ${caught.status}`);
    }
  }
}

export function ErrorBoundary() {
  const { jokeId } = useParams();
  return (
    <div className="error-container">{`There was an error loading joke by the id ${jokeId}. Sorry.`}</div>
  );
}
