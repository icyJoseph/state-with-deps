import {
  useCallback,
  useRef,
  useState,
  MutableRefObject,
  useLayoutEffect
} from "react";

function useConstant<Constant>(init: () => Constant): Constant {
  const ref = useRef<Constant | null>(null);

  if (ref.current === null) {
    ref.current = init();
  }

  return ref.current;
}
/**
 * An implementation of state with dependency-tracking.
 */
export function useStateWithDeps<State>(
  state: State,
  unmountedRef: MutableRefObject<boolean>
): [
  MutableRefObject<State>,
  Record<keyof State, boolean>,
  (payload: Partial<State>) => void
] {
  const rerender = useState<Record<string, unknown>>({})[1];
  const stateRef = useRef(state);

  const initStateDepsRef = useConstant(() => {
    const deps: Record<any, boolean> = {};

    for (const key in state) {
      deps[key] = false;
    }

    return deps as Record<keyof State, boolean>;
  });

  // If a state property (data, error or isValidating) is accessed by the render
  // function, we mark the property as a dependency so if it is updated again
  // in the future, we trigger a rerender.
  // This is also known as dependency-tracking.
  const stateDependenciesRef =
    useRef<Record<keyof State, boolean>>(initStateDepsRef);

  /**
   * @param payload To change stateRef, pass the values explicitly to setState:
   * @example
   * ```js
   * setState({
   *   isValidating: false
   *   data: newData // set data to newData
   *   error: undefined // set error to undefined
   * })
   *
   * setState({
   *   isValidating: false
   *   data: undefined // set data to undefined
   *   error: err // set error to err
   * })
   * ```
   */
  const setState = useCallback<(payload: Partial<State>) => void>(
    (payload) => {
      let shouldRerender = false;

      const currentState = stateRef.current;

      for (const k in payload) {
        // If the property has changed, update the state and mark rerender as
        // needed.
        if (currentState[k] !== payload[k]) {
          currentState[k] = payload[k] as State[typeof k];

          // If the property is accessed by the component, a rerender should be
          // triggered.
          if (stateDependenciesRef.current[k]) {
            shouldRerender = true;
          }
        }
      }

      if (shouldRerender && !unmountedRef.current) {
        rerender({});
      }
    },
    /* eslint-disable react-hooks/exhaustive-deps */
    []
  );

  return [stateRef, stateDependenciesRef.current, setState];
}
