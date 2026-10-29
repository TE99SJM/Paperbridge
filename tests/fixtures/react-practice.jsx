import React, { useState } from "react";
import { createRoot } from "react-dom/client";
function Practice() {
  const [name, setName] = useState("");
  const [choice, setChoice] = useState("");
  const [remote, setRemote] = useState(false);
  const [availability, setAvailability] = useState("");
  const [submits, setSubmits] = useState(0);
  return <>
    <form onSubmit={event => { event.preventDefault(); setSubmits(n => n + 1); }}>
      <label htmlFor="react-name">Full name</label><input id="react-name" value={name} onChange={e => setName(e.target.value)}/>
      <label htmlFor="react-choice">Position of interest</label><select id="react-choice" value={choice} onChange={e => setChoice(e.target.value)}><option value="">Choose</option><option value="operations">Operations Coordinator</option><option value="sales">Sales Associate</option></select>
      <label><input id="react-remote" type="checkbox" checked={remote} onChange={e => setRemote(e.target.checked)}/>Remote work preferred</label>
      <fieldset><legend>Availability</legend><label><input name="react-availability" type="radio" value="full" checked={availability === "full"} onChange={e => setAvailability(e.target.value)}/>Full time</label><label><input name="react-availability" type="radio" value="part" checked={availability === "part"} onChange={e => setAvailability(e.target.value)}/>Part time</label></fieldset>
      <button type="submit">Submit practice</button>
    </form>
    <h2>Actual React state</h2><pre id="react-state">{JSON.stringify({ name, choice, remote, availability, submits }, null, 2)}</pre>
  </>;
}
createRoot(document.getElementById("root")).render(<Practice/>);
