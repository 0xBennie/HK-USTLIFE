'use client';

import { useEffect, useState } from 'react';

import {
  clearLocalProfile,
  loadLocalProfile,
  saveLocalProfile,
  type BrowserNewcomerProfile,
} from '../lib/browser-profile';

const initialProfile: BrowserNewcomerProfile = {
  level: 'ug',
  residency: 'local',
  housing: 'not_arranged',
  intakeTerm: 'fall',
};

export function NewcomerFlow() {
  const [profile, setProfile] = useState<BrowserNewcomerProfile>(initialProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const existing = loadLocalProfile(window.localStorage);
    if (existing) {
      setProfile(existing);
      setSaved(true);
    }
  }, []);

  function change<K extends keyof BrowserNewcomerProfile>(key: K, value: BrowserNewcomerProfile[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }

  function save() {
    saveLocalProfile(window.localStorage, profile);
    setSaved(true);
  }

  function clear() {
    clearLocalProfile(window.localStorage);
    setProfile(initialProfile);
    setSaved(false);
  }

  return (
    <section className="local-flow" aria-labelledby="local-profile-heading">
      <div className="local-flow-heading">
        <div><p className="eyebrow">Optional · stored in this browser</p><h2 id="local-profile-heading">Save the four filters.</h2></div>
        <span className="local-pill">No account needed</span>
      </div>
      <div className="profile-grid">
        <label>Study level<select value={profile.level} onChange={(event) => change('level', event.target.value as BrowserNewcomerProfile['level'])}><option value="ug">Undergraduate</option><option value="rpg">Research postgraduate</option></select></label>
        <label>Student status<select value={profile.residency} onChange={(event) => change('residency', event.target.value as BrowserNewcomerProfile['residency'])}><option value="local">Local</option><option value="non_local">Non-local</option><option value="exchange">Exchange</option></select></label>
        <label>Housing<select value={profile.housing} onChange={(event) => change('housing', event.target.value as BrowserNewcomerProfile['housing'])}><option value="not_arranged">Not arranged</option><option value="on_campus">On campus</option><option value="off_campus">Off campus</option></select></label>
        <label>Intake term<select value={profile.intakeTerm} onChange={(event) => change('intakeTerm', event.target.value as BrowserNewcomerProfile['intakeTerm'])}><option value="fall">Fall</option><option value="spring">Spring</option></select></label>
      </div>
      <div className="local-actions">
        <button className="button button-blue" type="button" onClick={save}>Save on this device</button>
        {saved ? <><span className="saved-message" role="status">Saved locally. Use HKUST Newcomer in your agent for the source-linked checklist.</span><button className="plain-button" type="button" onClick={clear}>Clear local data</button></> : null}
      </div>
    </section>
  );
}
