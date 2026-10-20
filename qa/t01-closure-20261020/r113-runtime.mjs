// Preserve evidence from independent browser documents without filtering errors.
export function combineRuntimeSnapshots(...snapshots) {
  return () => {
    const observations = snapshots.map(snapshot => snapshot())
    return Object.fromEntries(Object.keys(observations[0]).map(key => [
      key, observations.flatMap(observation => observation[key]),
    ]))
  }
}
