import { useEffect, useRef } from "react";
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

const useStarterPokemon = () => {
  const unmounted = useRef(false);

  const [stateRef, stateDependencies, setState] =
    useStateWithDeps<PokemonStarter>(
      { bulbasaur: null, charmander: null, squirtle: null },
      unmounted
    );

  useEffect(() => {
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
    const controller = new AbortController();

    fetcher(7, { signal: controller.signal })
      .then((data) => setState({ squirtle: data }))
      .catch((e) => {
        if (controller.signal.aborted) return;
        setState({ squirtle: null });
      });

    return () => controller.abort();
  }, [setState]);

  useEffect(() => {
    return () => {
      unmounted.current = true;
    };
  }, []);

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

export default function App() {
  const { bulbasaur } = useStarterPokemon();

  console.log(bulbasaur);
  console.count("Render App");

  return (
    <div className="App">
      <h1>Hello CodeSandbox</h1>
      <h2>Start editing to see some magic happen!</h2>
    </div>
  );
}
