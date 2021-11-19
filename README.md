# State Dependency Tracking

Inside libraries like `swr` lies a very interesting construct.

A state hook that can keep track of which parts of the state are being used.

It does this to render the consumer component, only when the state it consumes changes, ignoring other changes to state.

The [swr code](https://github.com/vercel/swr/blob/master/src/utils/state.ts) summarizes it better than I can:

> If a state property (data, error or isValidating) is accessed by the render
> function, we mark the property as a dependency so if it is updated again
> in the future, we trigger a rerender.

> This is also known as dependency-tracking.

## Background

When using React hooks, we want updates to propagate.

```js
const [count, setCount] = useState(0);
```

Foe example a call to `setCount` updates the `count` variable, and we expect the component containing this hook to render.

Let's now complicate things a little. Say we have a hook that returns a a list of things, and also the length of the data list.

```js
const useData = (label) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    /* Do something to setData as a function of label */
    /* For example, make a network request, read from localStorage, etc. */
  }, [label, setData]);

  return { length: data.length, data };
};
```

So far so good. Data is a list, and length, represents the amount of elements on it.

Now we have an interesting situation, a component using `length` from `useData`, renders when `data` changes, even if the `length` is still the same.

Let's decouple this through an additional hook:

```js
const useDataLength = (label) => {
  const { length } = useData(label);
  return length;
};
```

You might think that because `length` is a number, React can bailout on rendering the consumer if the length is the same between renders, but that's not the case.

```jsx
import { useEffect, useState } from "react";

const useData = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      return setData([]);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return data;
};

const useLength = () => {
  const length = useData().length;

  return length;
};

export default function App() {
  const length = useLength();

  console.count("App: " + length);
  return <div>Hello World</div>;
}
```

With React's Strict Mode on this counts four times `App: 0`. With Strict Mode off, it counts two times.

The point here is that data changes inside the `setTimeout` to a different piece of data, that just happens to have the same length.

To bail out from the update, we need to return the same reference, for example by doing `prev => prev` on `setData`.

```jsx
useEffect(() => {
  const timer = setTimeout(() => {
    return setData((prev) => prev);
  }, 1000);

  return () => clearTimeout(timer);
}, []);
```

With this modification, and React's Strict Mode on, this counts two times `App: 0`, and with Strict Mode off, it counts once.

### Empty objects as default values and React rendering

The above often happens in another less obvious way. That is when we use destructuring default values. In the snippet below, everytime we toggle, the data reference is a different empty array, so the effect is triggered.

> Do you dare to uncomment the call to toggle inside `useEffect`

```jsx
const useData = () => {
  return { data: undefined };
};

function App() {
  const { data = [] } = useData();

  useEffect(() => {
    console.log("useEffect", data);
    // do you dare to uncomment
    // toggle();
  }, [data]);

  const [, toggle] = useReducer((x) => !x, false);

  return <button onClick={toggle}>Toggle</button>;
}
```

## Specification

In the situation above, how can we create an API, where hook consumers have the choice to read, the length of the data, without rendering again if the data changes, but the length is the same?

We want a hook `useData` which returns, `length`, and `data`.

```tsx
const useData = () => {
  /* What do we do here? */
  return { length, data };
};

const App = () => {
  const { length } = useData();

  console.count("App render");
  return <div>Hello World</div>;
};
```

And when data changes, if it has the same length, we should not add one more to the App render count.

## Test case

Manually testing this is trivial, however, it is best to seal the desired behavior behind a unit test.

```tsx
import { SyntheticEvent, useState, useRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { useData, useDataWithDepsTracking } from "../useData";

const App = () => {
  const [label, setLabel] = useState("");
  const { length } = useData(label);
  const ref = useRef<HTMLInputElement>(null);

  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();

    if (!ref.current) return;

    setLabel(ref.current.value);
  };

  console.log({ length });
  console.count("Render App");

  return (
    <form onSubmit={onSubmit}>
      <input type="text" placeholder="Enter your string" ref={ref} />
      <button type="submit">submit</button>
    </form>
  );
};

const originalCount = console.count;
const spyCount = jest.fn();

beforeAll(() => {
  console.count = spyCount;
});

afterAll(() => {
  console.count = originalCount;
});

test("Renders only if length changes", () => {
  render(<App />);

  // one render
  expect(spyCount).toHaveBeenCalledTimes(1);

  fireEvent.change(screen.getByPlaceholderText("Enter your string"), {
    target: { value: "12345" }
  });

  fireEvent.click(screen.getByText("submit"));

  // the submission changes label + length recalculation
  expect(spyCount).toHaveBeenCalledTimes(3);

  fireEvent.change(screen.getByPlaceholderText("Enter your string"), {
    target: { value: "54321" }
  });

  fireEvent.click(screen.getByText("submit"));

  // the submission changes label
  // since the length of data is the same, no additional render should happen
  expect(spyCount).toHaveBeenCalledTimes(4);
});
```

And if we implement `useData` like this:

```ts
import { useEffect, useState } from "react";

export const useData = (label: string) => {
  const [data, setData] = useState(label.split(""));

  useEffect(() => {
    setData(label.split(""));
  }, [label, setData]);

  return {
    length: data.length,
    data
  };
};
```

Then we'll have a failing test:

```shell
● Renders only if length changes

    expect(jest.fn()).toHaveBeenCalledTimes(expected)

    Expected number of calls: 1
    Received number of calls: 2

      42 |
      43 |   // one render
    > 44 |   expect(spyCount).toHaveBeenCalledTimes(1);
         |                    ^
      45 |
      46 |   fireEvent.change(screen.getByPlaceholderText("Enter your string"), {
      47 |     target: { value: "12345" }
```

Notice that we don't even get to modify the input field, and the test already failed.

Let's fix the test!

## Implementation

We'll need a special version of `useState`. Let's call it `useStateWithDeps`.

There's no aha moment here, a side from the fact that `useStateWithDeps` needs a signature that extends `useState`'s.

Plain and simple, we need to track which parts of the state are used. How can we do this in vanilla JavaScript?

```js
let obj = (bar) => {
  const access = new Map();
  return {
    get foo() {
      access.set("foo", true);
      return bar;
    },
    access
  };
};

const joe = obj("joe doe");

joe.access.get("foo"); // undefined
joe.foo; // joe doe
joe.access.get("foo"); // true
```

Using a `getter` we can gain knowledge of whether or not a property is being consumed, and store that in look up table.

Then when processing a state update, we see which parts of the state have changed, and if any of those are in the look up table, we let a render happen.

We need to learn to do a couple of things first:

- Trigger a render at will
- Hold state under React's radar

### Forced render

In React, the easiest way to force a render is to change a piece of state.

```ts
const [, force] = useState({});

useEffect(() => {
  const timer = setTimeout(() => force({}), 1000);
  return () => clearTimeout(timer);
}, [force]);
```

We've seen this before, calling force after one second with a new object, triggers a render.

An even simpler way would be to do:

```ts
const [, force] = useReducer((x) => !x);

useEffect(() => {
  const timer = setTimeout(force, 1000);
  return () => clearTimeout(timer);
}, [force]);
```

> Either could be packaged into a custom hook

### State under the radar

This is a dangerous thing to do, but you could hold state inside a React ref, and control when do you let the rendering process know about it.

```tsx
const EvenButton = () => {
  const [count, setCount] = useState(0);
  const refState = useRef(count);

  const onClick = () => {
    refState.current = refState.current + 1;
    if (refState.current % 2 === 0) setCount(refState.current);
  };

  return (
    <button onClick={onClick} data-testid="btn">
      {count}
    </button>
  );
};
```

Clicking the button updates an internal piece of state, but it only renders when the internal piece of state holds an even number.

- Click once, the i is set to 1, but the button still shows 0
- Click once again, the internal is set to 2, the button updates to 2

Don't believe me? Here's a test for it!

```ts
test("State hidden inside a ref", () => {
  render(<EvenButton />);

  expect(screen.getByTestId("btn")).toHaveTextContent("0");

  fireEvent.click(screen.getByTestId("btn"));

  expect(screen.getByTestId("btn")).toHaveTextContent("0");

  fireEvent.click(screen.getByTestId("btn"));

  expect(screen.getByTestId("btn")).toHaveTextContent("2");
});
```

### Putting it all together

By now you might see what's the trick.

- Keep state in a React ref
- Update it as one normally would
- Let React know about changes, only if certain condition(s) are met

We'll store the result from the property `getters` on yet another React ref, and use that to know whether or not to let React know about the changes. We'll let React know about the changes, by forcing a render.

Let's see at one possible implementation of `useStateWithDeps`:

```ts
import { useCallback, useEffect, useRef, useState } from "react";

export function useStateWithDeps<State extends Record<string, unknown>>(
  initialState: State
) {
  const [, rerender] = useState({});

  const unmounted = useRef(false);

  useEffect(() => {
    return () => {
      unmounted.current = true;
    };
  }, []);

  const stateRef = useRef(initialState);

  // this is initialized once
  const stateDependenciesRef = useRef<Partial<Record<keyof State, boolean>>>(
    Object.keys(stateRef.current).reduce(
      (prev, curr: keyof State) => ({ ...prev, [curr]: false }),
      {}
    )
  );

  const setState = useCallback(
    (payload: Partial<State>) => {
      let shouldRerender = false;

      const currentState = stateRef.current;

      for (const k in payload) {
        // If the property has changed, update the state
        if (currentState[k] !== payload[k]) {
          currentState[k] = payload[k] as State[typeof k];

          // If the property is accessed, a rerender should be triggered.
          if (stateDependenciesRef.current[k]) {
            shouldRerender = true;
          }
        }
      }

      if (shouldRerender && !unmounted.current) {
        rerender({});
      }
    },
    [rerender]
  );

  return [stateRef, setState, stateDependenciesRef.current] as const;
}
```

As said earlier, we need to expose a similar API to `useState`. In this case, we have the state, the state setter, and the dependency tracker.

From top to bottom:

- The function signature, requires an initial state.

- Define a force rendering function.

- An unmount flag. Typical trick to know if the hook we are currently in has unmounted. This is necessary because calls to setState might happen asynchronously. Normally this shoulde be done on the component side, and the flag should be passed to the hook wrapped in a React ref, but in spirit of keeping the function signature small, I placed in here.

- The next bit, might look confusing, but we are simply going over the initial state and creating a new object, with the same keys, but with false as value. When a component uses a piece of state, we flip this boolean to true. This is how we know if a state property is used.

- Finally, our state setter. It takes in a payload, which doesn't need to contain all properties of state. It loops over the payload keys, updating the keys that need to be updated, and if it sees an update to a tracked dependency, it sets a flag to force a render. Wrapped in `useCallback`, to make it stable. The `rerender` function is stable, so our `setState` function is also stable.

### Usage

This hook is rather special, because even though we have fully constructed it, we still need to do a couple of things from the consumer side to get things working.

We need to tweak how we define `useData`. Do you still remember that hook?

```ts
import { useEffect } from "react";
import { useStateWithDeps } from "./useStateWithDeps";

export const useData = (label: string) => {
  const [stateRef, setState, stateDependencies] = useStateWithDeps({
    data: label.split(""),
    length: 0
  });

  useEffect(() => {
    const data = label.split("");
    setState({ data, length: data.length });
  }, [label, setState]);

  return {
    get data() {
      stateDependencies.data = true;
      return stateRef.current.data;
    },
    get length() {
      stateDependencies.length = true;
      return stateRef.current.length;
    }
  };
};
```

Now, we'll keep track of which dependencies are read, if only length, if only data, if none, or both, and notify the consumer only when necessary.

Run our tests again, and we see:

```shell
 PASS  src/__tests__/index.test.tsx
```

🎉🎉🎉🎉

Even though we update label to a different thing, since that update results in the same number, the hook does not trigger a render, even though `data` did change. Exactly what we wanted! The only renders we account for are because of the `label` state, and the `length`, when the `data` that creates it changes.

## Critique

This is an optimization technique. Rendering is not necessarily bad. Generally when you have an expensive tree, you'd want to prevent rendering, but not all applications run into such problems.

The use cases for this technique are also contribed. It fits very well for data fetching libraries, where the results are cached, and multiple consumers need to be notified.

Since these consumers might be looking at different parts of the data, it makes sense to help by not forcing rendering, if unused pieces of state change.

We should understand that this unused pieces of state, are not used by the consumer, but are often used by library to delivery their value proposition.

For example, if a component doesn't care about the `isValidating` flag, then we should not force it to render when this flag changes, but the library might still need to know interally if validation is happening.

The implementation is kind of leaky. The hook consumer needs to use `getters` to get things working correctly.

All in all, it is a great technique and understanding it helps you test your React mental model, but if you haven't needed it so far, chances are you won't need it in the future either, although a library you use might have a version of it.

## The extra mile

Let's consider a hook that fetches pokemon. For now let's limit it to the classic 3 starters.

```ts
import { useEffect } from "react";
import { useStateWithDeps } from "./useStateWithDeps";

const fetcher = async (
  pkNumber: number,
  { signal }: { signal: AbortSignal }
) => {
  await new Promise((accept) => setTimeout(accept, 1000 * pkNumber));

  return fetch(`https://pokeapi.co/api/v2/pokemon/${pkNumber}`, {
    signal
  }).then((res) => res.json());
};

type Pokemon = {
  height: number;
  id: number;
  weight: number;
  order: number;
  name: string;
};

type PokemonStarter = {
  bulbasaur: Pokemon | null;
  charmander: Pokemon | null;
  squirtle: Pokemon | null;
};

export const useStarterPokemon = () => {
  const [stateRef, setState, stateDependencies] =
    useStateWithDeps<PokemonStarter>({
      bulbasaur: null,
      charmander: null,
      squirtle: null
    });

  useEffect(() => {
    if (!stateDependencies.bulbasaur) return;

    const controller = new AbortController();

    fetcher(1, { signal: controller.signal })
      .then((data) => setState({ bulbasaur: data }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setState({ bulbasaur: null });
      });

    return () => controller.abort();
  }, [setState]);

  useEffect(() => {
    if (!stateDependencies.charmander) return;

    const controller = new AbortController();

    fetcher(4, { signal: controller.signal })
      .then((data) => setState({ charmander: data }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setState({ charmander: null });
      });

    return () => controller.abort();
  }, [setState]);

  useEffect(() => {
    if (!stateDependencies.squirtle) return;

    const controller = new AbortController();

    fetcher(7, { signal: controller.signal })
      .then((data) => setState({ squirtle: data }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setState({ squirtle: null });
      });

    return () => controller.abort();
  }, [setState]);

  return {
    get bulbasaur() {
      stateDependencies.bulbasaur = true;
      return stateRef.current.bulbasaur;
    },
    get charmander() {
      stateDependencies.charmander = true;
      return stateRef.current.charmander;
    },
    get squirtle() {
      stateDependencies.squirtle = true;
      return stateRef.current.squirtle;
    }
  };
};
```

By virtual of the `useStateWithDeps` hook, we can make sure we query only for the pokemon we use in our hooks.

Potentially we could make a hook that fetches every possible pokemon!

```ts
const { charmander } = useStarterPokemon();
```

Of course, this would also do the trick, assuming `usePokemon` can handle the input string:

```ts
const { pokemon: charmander } = usePokemon("charmander");
```

As said in the critique, the use cases for `useStateWithDeps` are kind of limited, and since it is an optimization, you don't need to go and change every use of `useState` with it.

Happy Hacking 🎉!
