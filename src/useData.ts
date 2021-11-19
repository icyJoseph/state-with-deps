import { useEffect, useState } from "react";
import { useStateWithDeps } from "./useStateWithDeps";

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

export const useDataWithDepsTracking = (label: string) => {
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
