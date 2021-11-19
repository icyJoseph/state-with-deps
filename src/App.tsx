import { useStarterPokemon } from "./useStarterPokemon";

export default function App() {
  const { charmander } = useStarterPokemon();

  console.log({ charmander });
  console.count("App: ");

  return <div>Hello World</div>;
}
