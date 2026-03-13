import { useEffect, useState } from 'react';
import { scoreEngine, type EngineState } from '@renderer/ml/score-engine';

export function useScores(): EngineState {
  const [state, setState] = useState<EngineState>(scoreEngine.state);

  useEffect(() => scoreEngine.subscribe(setState), []);

  return state;
}
