'use client';

import { useState } from 'react';

import { CalendarParseError, parseIcsCalendar } from '../../../src/adapters/ics-calendar';

type ImportState = { kind: 'idle' } | { kind: 'success'; summary: string } | { kind: 'error'; summary: string };

export function IcsImport() {
  const [state, setState] = useState<ImportState>({ kind: 'idle' });

  async function importFile(file: File | undefined) {
    if (!file) return;
    try {
      const events = parseIcsCalendar(await file.text(), 'Asia/Hong_Kong');
      setState({ kind: 'success', summary: `${events.length} events read locally. You can now pass them to HKUST Today in your agent.` });
    } catch (error) {
      setState({ kind: 'error', summary: error instanceof CalendarParseError ? error.message : 'This calendar could not be read locally. Try an .ics export in Asia/Hong_Kong time.' });
    }
  }

  return (
    <section className="ics-import" aria-labelledby="ics-heading">
      <div><p className="eyebrow">Optional · no upload</p><h2 id="ics-heading">Already have an .ics export?</h2><p>Read it in this browser as an alternative to a timetable screenshot.</p></div>
      <label className="file-button">Choose .ics file<input type="file" accept="text/calendar,.ics" onChange={(event) => void importFile(event.target.files?.[0])} /></label>
      {state.kind !== 'idle' ? <p className={state.kind === 'error' ? 'import-error' : 'import-success'} role="status">{state.summary}</p> : null}
    </section>
  );
}
