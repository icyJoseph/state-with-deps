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
