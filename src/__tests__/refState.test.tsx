import { render, fireEvent, screen } from "@testing-library/react";
import { useRef, useState } from "react";

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

test("State hidden inside a ref", () => {
  render(<EvenButton />);

  expect(screen.getByTestId("btn")).toHaveTextContent("0");

  fireEvent.click(screen.getByTestId("btn"));

  expect(screen.getByTestId("btn")).toHaveTextContent("0");

  fireEvent.click(screen.getByTestId("btn"));

  expect(screen.getByTestId("btn")).toHaveTextContent("2");
});
