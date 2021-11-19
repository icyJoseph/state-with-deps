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
