import { useState } from "react";
import { createRoot } from "react-dom/client";

// Formulario controlado: si el autocompletado no dispara onChange, React vuelve el valor al estado anterior.
function App() {
  const [state, setState] = useState({ name: "", email: "", country: "", remote: "", cover: "" });
  const set = (k: keyof typeof state) => (e: { target: { value: string } }) => setState((s) => ({ ...s, [k]: e.target.value }));
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <label htmlFor="name">Full name</label>
      <input id="name" value={state.name} onChange={set("name")} required />
      <label htmlFor="email">Email address</label>
      <input id="email" type="email" value={state.email} onChange={set("email")} />
      <label htmlFor="country">Country</label>
      <select id="country" value={state.country} onChange={set("country")}>
        <option value="">Choose one</option>
        <option value="AR">Argentina</option>
        <option value="UY">Uruguay</option>
      </select>
      <div role="radiogroup" aria-labelledby="remote-q">
        <span id="remote-q">Are you open to remote work?</span>
        <label><input type="radio" name="remote" value="yes" checked={state.remote === "yes"} onChange={set("remote")} /> Yes</label>
        <label><input type="radio" name="remote" value="no" checked={state.remote === "no"} onChange={set("remote")} /> No</label>
      </div>
      <label htmlFor="cover">Tell us about yourself</label>
      <textarea id="cover" value={state.cover} onChange={set("cover")} />
      <pre id="state">{JSON.stringify(state)}</pre>
    </form>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
