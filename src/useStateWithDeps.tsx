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
