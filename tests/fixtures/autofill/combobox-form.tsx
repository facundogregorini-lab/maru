import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import Select from "react-select";

// Como el formulario nuevo de Greenhouse: listas con buscador de react-select (role="combobox").
type Opt = { value: string; label: string };
const opts = (...labels: string[]): Opt[] => labels.map((label) => ({ value: label.toLowerCase(), label }));

const QUESTIONS = [
  { id: "country", label: "Country", options: opts("Argentina", "Brazil", "Chile", "Uruguay") },
  { id: "authorized", label: "Are you legally authorized to work in Argentina?", options: opts("Yes", "No") },
  { id: "gender", label: "Gender", options: opts("Female", "Male", "Decline to self-identify") },
];

function App() {
  const [state, setState] = useState<Record<string, string>>({ prefilled: "uy" });
  // Greenhouse marca los obligatorios con aria-required en el input; react-select no lo hace solo.
  useEffect(() => {
    for (const q of QUESTIONS) document.getElementById(q.id)?.setAttribute("aria-required", "true");
  }, []);
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      {QUESTIONS.map((q) => (
        <div key={q.id} className="select">
          <label id={`${q.id}-label`} htmlFor={q.id}>
            {q.label}
            <span aria-hidden="true">*</span>
          </label>
          <Select<Opt>
            inputId={q.id}
            aria-labelledby={`${q.id}-label`}
            classNamePrefix="select"
            options={q.options}
            value={q.options.find((o) => o.value === state[q.id]) ?? null}
            onChange={(o) => setState((s) => ({ ...s, [q.id]: o?.value ?? "" }))}
          />
        </div>
      ))}
      <label id="nonsearch-label" htmlFor="nonsearch">País (menú sin escritura)</label>
      <Select<Opt>
        inputId="nonsearch"
        aria-labelledby="nonsearch-label"
        classNamePrefix="select"
        isSearchable={false}
        options={opts("Argentina", "Brazil", "Chile")}
        value={opts("Argentina", "Brazil", "Chile").find((o) => o.value === state.nonsearch) ?? null}
        onChange={(o) => setState((s) => ({ ...s, nonsearch: o?.value ?? "" }))}
      />
      {/* Como los buscadores de ciudades: sin opciones hasta que se tipea. */}
      <label id="city-label" htmlFor="city">City</label>
      <Select<Opt> inputId="city" aria-labelledby="city-label" classNamePrefix="select" options={[]} />
      <label id="prefilled-label" htmlFor="prefilled">Where do you live?</label>
      <Select<Opt>
        inputId="prefilled"
        aria-labelledby="prefilled-label"
        classNamePrefix="select"
        options={opts("Argentina", "Uy")}
        value={{ value: "uy", label: "Uruguay" }}
        onChange={(o) => setState((s) => ({ ...s, prefilled: o?.value ?? "" }))}
      />
      <pre id="state">{JSON.stringify(state)}</pre>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
