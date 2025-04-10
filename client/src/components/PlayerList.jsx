export default function PlayerList({ players, leaveRoom }) {
  const styles = {
    container: {
      backgroundColor: 'var(--background)',
      border: 'var(--border)',
      boxShadow: 'var(--shadow)',
      padding: '1.5rem',
      marginBottom: '1.5rem',
      width: '100%',
      maxWidth: '800px',
    },
 
    list: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
    },
    listItem: {
      padding: '0.75rem',
      marginBottom: '0.75rem',
      border: '2px solid var(--text)',
      backgroundColor: '#f0f0f0',
      fontWeight: 'bold',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    playerName: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
    },
    score: {
      backgroundColor: 'var(--secondary)',
      padding: '0.25rem 0.5rem',
      border: '2px solid var(--text)',
      fontFamily: "'Space Mono', monospace",
    },
    botBadge: {
      backgroundColor: 'var(--accent)',
      color: 'var(--text)',
      padding: '0.25rem 0.5rem',
      border: '2px solid var(--text)',
      marginLeft: '0.5rem',
      fontSize: '0.8rem',
      fontWeight: 'bold',
      fontFamily: "'Space Mono', monospace",
    },

    leaveButton: {
      padding: '0.75rem 1.5rem',
      fontSize: '1.5rem',
      fontFamily: "'Space Mono', monospace",
      backgroundColor: 'var(--primary)', // Bright red
      border: '3px solid var(--text)',
      cursor: 'pointer',
      boxShadow: '4px 4px 0px var(--text)',
      transition: 'transform 0.1s, box-shadow 0.1s',
      textTransform: 'uppercase',
      flex: 1,
      width: '100%',
    },
  };

  return (
    <div style={styles.container} className="player-list">
      <h3 className="section-header">PLAYERS ({players.length})</h3>
      <ul style={styles.list}>
        {players.map(player => (
          <li key={player.id} style={styles.listItem}>
            <div style={styles.playerName}>
              {player.name || player.id}
              {player.isBot && <span className="pill" style={styles.botBadge}>BOT</span>}
            </div>
            <div style={styles.score} className="pill">{player.score}</div>
          </li>
        ))}
      </ul>

      <button style={styles.leaveButton} onClick={leaveRoom}>
        Leave Room
      </button>
    </div>
  )
}