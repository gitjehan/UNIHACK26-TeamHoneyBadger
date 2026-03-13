import type { LeaderboardEntry } from '@renderer/lib/types';

interface LeaderBoardProps {
  nickname: string;
  entries: LeaderboardEntry[];
  onNicknameChange: (value: string) => void;
  onSaveNickname: () => Promise<void>;
}

export function LeaderBoard({
  nickname,
  entries,
  onNicknameChange,
  onSaveNickname,
}: LeaderBoardProps): JSX.Element {
  return (
    <div className="card">
      <h3>Lock In Board</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          placeholder="Nickname"
          style={{
            flex: 1,
            background: '#ffffff',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-card)',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void onSaveNickname()}>
          Save
        </button>
      </div>
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Score</th>
            <th>Streak</th>
            <th>Pet</th>
          </tr>
        </thead>
        <tbody>
          {entries.slice(0, 20).map((entry, index) => (
            <tr key={`${entry.nickname}-${entry.sessionId}`}>
              <td>{index + 1}</td>
              <td>{entry.nickname}</td>
              <td>{entry.avgOverallScore}</td>
              <td>{entry.bestStreak}m</td>
              <td>{entry.levelTitle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
