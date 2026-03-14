import type { LeaderboardEntry } from '@renderer/lib/types';

interface LeaderBoardProps {
  nickname: string;
  entries: LeaderboardEntry[];
  onNicknameChange: (value: string) => void;
  onSaveNickname: () => Promise<void>;
}

const RANK_COLORS = ['#B8860B', '#9e9e9e', '#8B5E3C']; // gold, silver, bronze

export function LeaderBoard({
  nickname,
  entries,
  onNicknameChange,
  onSaveNickname,
}: LeaderBoardProps): JSX.Element {
  return (
    <div className="card">
      <h3>Lock In Board</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <input
          value={nickname}
          onChange={(event) => onNicknameChange(event.target.value)}
          placeholder="Your nickname"
          style={{
            flex: 1,
            background: '#ffffff',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-card)',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 13,
            transition: 'border-color 0.15s ease',
            outline: 'none',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-card)'; }}
        />
        <button className="btn btn-secondary" type="button" onClick={() => void onSaveNickname()}>
          Save
        </button>
      </div>

      {entries.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '24px 0',
            color: 'var(--text-tertiary)',
            fontSize: 13,
          }}
        >
          No entries yet. Complete a session to appear here.
        </div>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th style={{ width: 32 }}>#</th>
              <th>Name</th>
              <th style={{ textAlign: 'right' }}>Score</th>
              <th style={{ textAlign: 'right' }}>Streak</th>
              <th>Pet</th>
            </tr>
          </thead>
          <tbody>
            {entries.slice(0, 20).map((entry, index) => {
              const isCurrentUser = entry.nickname === nickname;
              return (
                <tr
                  key={`${entry.nickname}-${entry.sessionId}`}
                  style={{
                    background: isCurrentUser ? 'var(--green-bg)' : undefined,
                    fontWeight: isCurrentUser ? 600 : undefined,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: index < 3 ? 700 : undefined, color: index < 3 ? RANK_COLORS[index] : undefined }}>
                    {index + 1}
                  </td>
                  <td>
                    {entry.nickname}
                    {isCurrentUser ? <span style={{ color: 'var(--accent)', fontSize: 11, marginLeft: 4 }}>you</span> : null}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {entry.avgOverallScore}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {entry.bestStreak}m
                  </td>
                  <td>{entry.levelTitle}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
