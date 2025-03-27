import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import Head from 'next/head';
import PlayerList from '../../components/PlayerList';

const socket = io('https://acrophylia.onrender.com', {
  withCredentials: true,
  transports: ['polling', 'websocket'],
  reconnection: true,
  reconnectionAttempts: 15,
  reconnectionDelay: 1000,
  timeout: 30000,
});

const GameRoom = () => {
  const router = useRouter();
  const { roomId: urlRoomId, creatorId } = router.query;
  const [roomId, setRoomId] = useState(urlRoomId || null);
  const [players, setPlayers] = useState([]);
  const [roundNum, setRoundNum] = useState(0);
  const [letterSet, setLetterSet] = useState([]);
  const [category, setCategory] = useState('');
  const [acronym, setAcronym] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [gameState, setGameState] = useState('waiting');
  const [hasVoted, setHasVoted] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState(null);
  const [winner, setWinner] = useState(null);
  const [isCreator, setIsCreator] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [nameSet, setNameSet] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const chatListRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedCreator = sessionStorage.getItem('isCreator') === 'true';
      setIsCreator(storedCreator);
    }

    if (!urlRoomId || hasJoined) return;

    socket.on('connect', () => {
      setIsConnected(true);
      if (urlRoomId && !hasJoined) {
        socket.emit('joinRoom', { roomId: urlRoomId, creatorId });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('roomJoined', ({ roomId, isCreator: serverIsCreator }) => {
      setRoomId(roomId);
      setIsCreator(serverIsCreator);
      sessionStorage.setItem('isCreator', serverIsCreator);
    });

    socket.on('roomNotFound', () => {
      alert('Room not found!');
      router.push('/');
    });

    socket.on('playerUpdate', (updatedPlayers) => {
      setPlayers(updatedPlayers);
      const currentPlayer = updatedPlayers.find(p => p.id === socket.id);
      if (currentPlayer && currentPlayer.name) setNameSet(true);
    });

    socket.on('creatorUpdate', (newCreatorId) => {
      setIsCreator(socket.id === newCreatorId);
      sessionStorage.setItem('isCreator', socket.id === newCreatorId);
    });

    socket.on('gameStarted', () => {
      setGameStarted(true);
    });

    socket.on('newRound', ({ roundNum, letterSet, timeLeft: initialTime, category }) => {
      setRoundNum(roundNum);
      setLetterSet(letterSet);
      setCategory(category);
      setGameState('submitting');
      setSubmissions([]);
      setHasVoted(false);
      setHasSubmitted(false);
      setResults(null);
      setTimeLeft(initialTime);
    });

    socket.on('timeUpdate', ({ timeLeft }) => {
      setTimeLeft(timeLeft);
    });

    socket.on('submissionsReceived', (submissionList) => {
      setSubmissions(submissionList);
    });

    socket.on('votingStart', () => {
      setGameState('voting');
    });

    socket.on('roundResults', (roundResults) => {
      setResults(roundResults);
      setPlayers(roundResults.updatedPlayers);
      setGameState('results');
      setTimeLeft(null);
    });

    socket.on('gameEnd', ({ winner }) => {
      setWinner(winner);
      setGameState('ended');
    });

    socket.on('gameReset', () => {
      setRoundNum(0);
      setGameState('waiting');
      setSubmissions([]);
      setHasVoted(false);
      setHasSubmitted(false);
      setResults(null);
      setWinner(null);
      setTimeLeft(null);
      setGameStarted(false);
      setCategory('');
    });

    socket.on('chatMessage', ({ senderId, senderName, message }) => {
      setChatMessages((prev) => [...prev, { senderId, senderName, message }]);
    });

    socket.emit('joinRoom', { roomId: urlRoomId, creatorId });
    setHasJoined(true);

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('roomJoined');
      socket.off('roomNotFound');
      socket.off('playerUpdate');
      socket.off('creatorUpdate');
      socket.off('gameStarted');
      socket.off('newRound');
      socket.off('timeUpdate');
      socket.off('submissionsReceived');
      socket.off('votingStart');
      socket.off('roundResults');
      socket.off('gameEnd');
      socket.off('gameReset');
      socket.off('chatMessage');
    };
  }, [urlRoomId, router, creatorId]);

  useEffect(() => {
    if (chatListRef.current) {
      chatListRef.current.scrollTop = chatListRef.current.scrollHeight;
    }
  }, [chatMessages]);

  useEffect(() => {
    if (gameState === 'voting' && hasVoted) {
      const timeout = setTimeout(() => {
        if (!results && roomId) socket.emit('requestResults', roomId);
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [gameState, hasVoted, results, roomId]);

  const debounce = (func, delay) => {
    let timeout;
    return (...args) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), delay);
    };
  };

  const startGame = useCallback(
    debounce(() => {
      if (roomId && isCreator && !isStarting) {
        setIsStarting(true);
        socket.emit('startGame', roomId);
        setTimeout(() => setIsStarting(false), 1000);
      }
    }, 500),
    [roomId, isCreator, isStarting]
  );

  const submitAcronym = () => {
    if (acronym && roomId && !hasSubmitted) {
      socket.emit('submitAcronym', { roomId, acronym });
      setHasSubmitted(true);
      setAcronym('');
    }
  };

  const submitVote = (submissionId) => {
    if (!hasVoted && roomId && submissionId !== socket.id) {
      socket.emit('vote', { roomId, submissionId });
      setHasVoted(true);
    } else if (submissionId === socket.id) {
      alert('You cannot vote for your own submission!');
    }
  };

  const leaveRoom = () => {
    if (roomId) {
      socket.emit('leaveRoom', roomId);
      setRoomId(null);
      setPlayers([]);
      setGameState('waiting');
      setGameStarted(false);
      setHasJoined(false);
      sessionStorage.clear();
      router.push('/');
    }
  };

  const resetGame = () => {
    if (isCreator && roomId) {
      socket.emit('resetGame', roomId);
    }
  };

  const setName = () => {
    if (playerName.trim() && roomId) {
      socket.emit('setName', { roomId, name: playerName });
      setNameSet(true);
      setPlayerName('');
    }
  };

  const sendChatMessage = () => {
    if (chatInput.trim() && roomId) {
      socket.emit('sendMessage', { roomId, message: chatInput });
      setChatInput('');
    }
  };

  console.log({players})

  const inviteLink = roomId ? `${window.location.origin}/room/${roomId}` : '';

  return (
    <>
      <Head>
        <title>Acrophylia - Room {roomId}</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
        <style>{`
          @media (max-width: 768px) {
            .container { padding: 1rem; }
            .title { font-size: 1.75rem; }
            .subtitle { font-size: 1.25rem; }
            .input { padding: 0.5rem; }
            .button { padding: 0.5rem 1rem; }
          }
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
          }
          button:hover {
            transform: translate(-2px, -2px);
            box-shadow: 6px 6px 0px #000000;
          }
          button:active {
            transform: translate(2px, 2px);
            box-shadow: 2px 2px 0px #000000;
          }
        `}</style>
      </Head>
      <div style={styles.container}>
        {roomId ? (
          <>
            <header style={styles.header}>
              <div style={styles.roomInfo}>
                <h2 style={styles.roomTitle}>ROOM: {roomId}</h2>
              </div>
              <div style={styles.statusContainer}>
                {!isConnected && (
                  <div style={styles.reconnectingBadge}>
                    <span style={styles.reconnectingText}>RECONNECTING</span>
                    <span style={styles.reconnectingDots}>...</span>
                  </div>
                )}
                <div style={{
                  ...styles.gameStatusBadge,
                  backgroundColor: 
                    gameState === 'waiting' ? '#ffde59' : 
                    gameState === 'submitting' ? '#00c2ff' : 
                    gameState === 'voting' ? '#ff3c00' :
                    gameState === 'results' ? '#00c2ff' : '#ffffff',
                }}>
                  <span style={styles.gameStatusText}>
                    {gameState.toUpperCase()}
                  </span>
                </div>
              </div>
            </header>

            {!gameStarted && (
              <div style={styles.inviteContainer}>
                <div style={styles.inviteHeader}>
                  <h3 style={styles.inviteTitle}>INVITE FRIENDS</h3>
                </div>
                <div style={styles.inviteContent}>
                  <input style={styles.inviteInput} type="text" value={inviteLink} readOnly />
                  <button 
                    style={styles.inviteButton} 
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      alert('Link copied to clipboard!');
                    }}
                  >
                    COPY LINK
                  </button>
                </div>
                <div className="info-box">
                  Share this link with friends to invite them to your game room!
                </div>
              </div>
            )}

            {!nameSet && gameState === 'waiting' && (
              <div style={styles.section}>
                <div style={styles.nameSetForm}>
                  <input
                    style={styles.nameInput}
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Enter your name"
                    maxLength={20}
                    onKeyPress={(e) => e.key === 'Enter' && playerName.trim() && setName()}
                  />
                  <button 
                    style={styles.nameButton} 
                    onClick={setName}
                    disabled={!playerName.trim()}
                  >
                    Set Name
                  </button>
                </div>
                <div className="info-box">
                  Enter a name to join the game. You'll be able to play once the room creator starts the game.
                </div>
              </div>
            )}

            <PlayerList players={players} />

            {gameState === 'waiting' && nameSet && (
              <div style={styles.section}>
                <div style={styles.waitingHeader}>
                  <h3 style={styles.waitingTitle}>WAITING FOR PLAYERS</h3>
                </div>
                
                <div style={styles.waitingInfo}>
                  <div className="info-box">
                    Game starts with 4 players. Bots will be added if needed.
                  </div>
                  <div style={styles.playerCount}>
                    <span style={styles.playerCountLabel}>PLAYERS:</span>
                    <span style={styles.playerCountValue}>{players.length}/4</span>
                  </div>
                </div>
                
                {isCreator ? (
                  <button 
                    style={{
                      ...styles.startGameButton,
                      opacity: isStarting ? 0.7 : 1,
                      animation: players.length >= 2 && !isStarting ? 'pulse 1.5s infinite' : 'none',
                    }} 
                    onClick={startGame} 
                    disabled={isStarting}
                  >
                    {isStarting ? 'STARTING...' : 'START GAME'}
                  </button>
                ) : (
                  <div style={styles.creatorNote}>
                    <div style={styles.creatorIcon}>👑</div>
                    <div style={styles.creatorText}>
                      Waiting for the room creator to start the game...
                    </div>
                  </div>
                )}
              </div>
            )}

            {gameState === 'submitting' && (
              <div style={styles.section}>
                <div style={styles.roundHeader}>
                  <h3 style={styles.roundTitle}>ROUND {roundNum} OF 5</h3>
                </div>
                
                <div style={styles.gameInfo}>
                  <div style={styles.categoryContainer}>
                    <span style={styles.categoryLabel}>CATEGORY:</span>
                    <span style={styles.categoryValue}>{category}</span>
                  </div>
                  
                  <div style={styles.lettersContainer}>
                    <span style={styles.lettersLabel}>LETTERS:</span>
                    <div style={styles.letterBoxes}>
                      {letterSet.map((letter, index) => (
                        <span key={index} style={styles.letterBox}>{letter}</span>
                      ))}
                    </div>
                  </div>
                </div>
                
                <div style={{
                  ...styles.timerContainer,
                  backgroundColor: timeLeft <= 10 ? '#ff3c00' : '#00c2ff',
                  animation: timeLeft <= 10 ? 'shake 0.5s infinite' : 'none',
                }}>
                  <span style={styles.timerLabel}>TIME LEFT:</span>
                  <span style={styles.timerValue}>
                    {timeLeft !== null ? `${timeLeft}s` : 'WAITING...'}
                  </span>
                </div>
                
                <div style={styles.submissionForm}>
                  <input
                    style={{
                      ...styles.submissionInput,
                      backgroundColor: hasSubmitted ? '#ffde59' : '#ffffff',
                    }}
                    type="text"
                    value={acronym}
                    onChange={(e) => setAcronym(e.target.value)}
                    placeholder="ENTER YOUR ACRONYM"
                    disabled={hasSubmitted || timeLeft === 0}
                    onKeyPress={(e) => e.key === 'Enter' && !hasSubmitted && timeLeft > 0 && submitAcronym()}
                  />
                  <button 
                    style={{
                      ...styles.submissionButton,
                      opacity: hasSubmitted || timeLeft === 0 ? 0.7 : 1,
                    }} 
                    onClick={submitAcronym} 
                    disabled={hasSubmitted || timeLeft === 0}
                  >
                    {hasSubmitted ? 'SUBMITTED!' : 'SUBMIT'}
                  </button>
                </div>
                
                {hasSubmitted && (
                  <div style={styles.submittedMessage}>
                    Your submission has been received! Waiting for other players...
                  </div>
                )}
              </div>
            )}

            {gameState === 'voting' && (
              <div style={styles.section}>
                <div style={styles.roundHeader}>
                  <h3 style={styles.roundTitle}>VOTE FOR AN ACRONYM</h3>
                </div>
                
                <div style={{
                  ...styles.timerContainer,
                  backgroundColor: timeLeft <= 10 ? '#ff3c00' : '#00c2ff',
                  animation: timeLeft <= 10 ? 'shake 0.5s infinite' : 'none',
                }}>
                  <span style={styles.timerLabel}>TIME LEFT:</span>
                  <span style={styles.timerValue}>
                    {timeLeft !== null ? `${timeLeft}s` : 'WAITING...'}
                  </span>
                </div>
                
                <div style={styles.votingInstructions}>
                  {hasVoted ? 
                    'You have cast your vote! Waiting for others...' : 
                    'Choose your favorite acronym below:'}
                </div>
                
                <ul style={styles.votingList}>
                  {submissions.map(([playerId, acronym]) => {
                    const isOwnSubmission = playerId === socket.id;
                    const isDisabled = hasVoted || isOwnSubmission || timeLeft === 0;
                    
                    return (
                      <li key={playerId} style={{
                        ...styles.votingItem,
                        backgroundColor: isOwnSubmission ? '#ffde59' : '#ffffff',
                        opacity: isDisabled ? 0.8 : 1,
                      }}>
                        <div style={styles.acronymDisplay}>
                          {acronym || '(No submission)'}
                          {isOwnSubmission && <span style={styles.yourSubmissionBadge}>YOUR SUBMISSION</span>}
                        </div>
                        <button
                          style={{
                            ...styles.voteButton,
                            opacity: isDisabled ? 0.7 : 1,
                          }}
                          onClick={() => submitVote(playerId)}
                          disabled={isDisabled}
                        >
                          {hasVoted ? 'VOTED' : 'VOTE'}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {gameState === 'results' && results && (
              <div style={styles.section}>
                <div style={styles.roundHeader}>
                  <h3 style={styles.roundTitle}>ROUND {roundNum} RESULTS</h3>
                </div>
                
                <div style={styles.resultsContainer}>
                  {results.submissions.map(([playerId, acronym]) => {
                    const voteCount = (results.votes || []).filter(([_, votedId]) => votedId === playerId).length || 0;
                    const player = players.find(p => p.id === playerId);
                    const isOwnSubmission = playerId === socket.id;
                    const hasVotes = voteCount > 0;
                    
                    return (
                      <div key={playerId} style={{
                        ...styles.resultItem,
                        backgroundColor: isOwnSubmission ? '#ffde59' : '#ffffff',
                        borderColor: hasVotes ? '#ff3c00' : '#000000',
                        borderWidth: hasVotes ? '4px' : '3px',
                      }}>
                        <div style={styles.resultAcronym}>
                          {acronym || '(No submission)'}
                        </div>
                        
                        <div style={styles.resultDetails}>
                          <div style={styles.resultPlayer}>
                            <span style={styles.resultPlayerLabel}>PLAYER:</span>
                            <span style={styles.resultPlayerName}>
                              {player?.name || (player?.isBot ? player.name : playerId)}
                              {isOwnSubmission && <span style={styles.yourResultBadge}>YOU</span>}
                            </span>
                          </div>
                          
                          <div style={{
                            ...styles.resultVotes,
                            backgroundColor: voteCount > 0 ? '#ff3c00' : '#f0f0f0',
                            color: voteCount > 0 ? '#ffffff' : '#000000',
                          }}>
                            <span style={styles.resultVotesLabel}>VOTES:</span>
                            <span style={styles.resultVotesCount}>{voteCount}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {gameState === 'ended' && winner && (
              <div style={styles.section}>
                <div style={styles.gameOverHeader}>
                  <h3 style={styles.gameOverTitle}>GAME OVER!</h3>
                </div>
                
                <div style={styles.winnerContainer}>
                  <div style={styles.winnerLabel}>WINNER</div>
                  <div style={styles.winnerName}>
                    {winner.name || winner.id}
                  </div>
                  <div style={styles.winnerScore}>
                    <span style={styles.winnerScoreLabel}>SCORE</span>
                    <span style={styles.winnerScoreValue}>{winner.score}</span>
                  </div>
                  
                  <div style={styles.trophyIcon}>🏆</div>
                </div>
                
                <div style={styles.gameOverActions}>
                  {isCreator ? (
                    <button style={styles.newGameButton} onClick={resetGame}>
                      START NEW GAME
                    </button>
                  ) : (
                    <div className="info-box">
                      Waiting for room creator to start a new game...
                    </div>
                  )}
                </div>
              </div>
            )}

            <button style={styles.leaveButton} onClick={leaveRoom}>
              Leave Room
            </button>

            {gameStarted && (
              <div style={styles.chatContainer}>
                <h3 style={styles.chatTitle}>GAME CHAT</h3>
                <div style={styles.chatListWrapper}>
                  <ul style={styles.chatList} ref={chatListRef}>
                    {chatMessages.map((msg, index) => (
                      <li key={index} style={{
                        ...styles.chatItem,
                        backgroundColor: msg.senderId === socket.id ? '#ffde59' : '#ffffff',
                        alignSelf: msg.senderId === socket.id ? 'flex-end' : 'flex-start',
                      }}>
                        <div style={styles.chatSender}>
                          {msg.senderName}
                        </div>
                        <div style={styles.chatMessage}>
                          {msg.message}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={styles.chatInputContainer}>
                  <input
                    style={styles.chatInput}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={100}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  />
                  <button style={styles.chatButton} onClick={sendChatMessage}>
                    SEND
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <p style={styles.loading}>Loading room...</p>
        )}
      </div>
    </>
  );
};

const styles = {
  container: {
    padding: '1.5rem',
    backgroundColor: 'var(--secondary)',
    minHeight: '100vh',
    fontFamily: "'Space Grotesk', sans-serif",
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '0 auto',
    color: '#000000',
    gap: '1.5rem',
    fontSize: 'calc(16px + 0.5vw)',
  },
  
  // Round header and title styles
  roundHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: '#ff3c00', // Bright red
    padding: '1rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
  },
  roundTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#ffffff',
    margin: 0,
    textAlign: 'center',
  },
  
  // Game info styles
  gameInfo: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  categoryContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: '#ffffff',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
  },
  categoryLabel: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1rem',
  },
  categoryValue: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 'bold',
    fontSize: '1.5rem',
    backgroundColor: '#00c2ff', // Bright blue
    padding: '0.5rem',
    border: '2px solid #000000',
    display: 'inline-block',
  },
  lettersContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    padding: '1rem',
    backgroundColor: '#ffffff',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
  },
  lettersLabel: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1rem',
  },
  letterBoxes: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  letterBox: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
    backgroundColor: '#ffde59', // Bright yellow
    padding: '0.5rem 0.75rem',
    border: '2px solid #000000',
    boxShadow: '2px 2px 0px #000000',
  },
  
  // Timer styles
  timerContainer: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    marginBottom: '1.5rem',
  },
  timerLabel: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
    color: '#000000',
  },
  timerValue: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.5rem',
    color: '#000000',
    backgroundColor: '#ffffff',
    padding: '0.5rem 0.75rem',
    border: '2px solid #000000',
  },
  
  // Submission form styles
  submissionForm: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1rem',
  },
  submissionInput: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.25rem',
    fontFamily: "'Space Grotesk', sans-serif",
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    outline: 'none',
  },
  submissionButton: {
    padding: '1rem',
    fontSize: '1.25rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: '#ff3c00', // Bright red
    color: '#ffffff',
    border: '3px solid #000000',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px #000000',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
  submittedMessage: {
    backgroundColor: '#ffde59', // Bright yellow
    padding: '1rem',
    border: '3px solid #000000',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: '1rem',
  },
  
  // Voting styles
  votingInstructions: {
    backgroundColor: '#ffffff',
    padding: '1rem',
    border: '3px solid #000000',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '1.5rem',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  votingList: {
    listStyle: 'none',
    padding: 0,
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  votingItem: {
    padding: '1rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  acronymDisplay: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 'bold',
    fontSize: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  yourSubmissionBadge: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.75rem',
    backgroundColor: '#ff3c00',
    color: '#ffffff',
    padding: '0.25rem 0.5rem',
    border: '2px solid #000000',
    display: 'inline-block',
  },
  
  // Results styles
  resultsContainer: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  resultItem: {
    padding: '1rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  resultAcronym: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 'bold',
    fontSize: '1.5rem',
    padding: '0.75rem',
    backgroundColor: '#f0f0f0',
    border: '2px solid #000000',
  },
  resultDetails: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  resultPlayer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  resultPlayerLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  resultPlayerName: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 'bold',
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  yourResultBadge: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.75rem',
    backgroundColor: '#ff3c00',
    color: '#ffffff',
    padding: '0.25rem 0.5rem',
    border: '2px solid #000000',
    display: 'inline-block',
  },
  resultVotes: {
    padding: '0.5rem 0.75rem',
    border: '2px solid #000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
  },
  resultVotesLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.85rem',
    fontWeight: 'bold',
  },
  resultVotesCount: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.5rem',
  },
  
  // Game over styles
  gameOverHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: '#ff3c00', // Bright red
    padding: '1.5rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
  },
  gameOverTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '2rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#ffffff',
    margin: 0,
    textAlign: 'center',
  },
  winnerContainer: {
    width: '100%',
    backgroundColor: '#ffde59',
    padding: '1.5rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    position: 'relative',
  },
  winnerLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.25rem',
    fontWeight: 'bold',
    backgroundColor: '#ffffff',
    padding: '0.5rem 1rem',
    border: '3px solid #000000',
    boxShadow: '3px 3px 0px #000000',
  },
  winnerName: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '2rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: '0.5rem',
  },
  winnerScore: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    backgroundColor: '#ffffff',
    padding: '1rem',
    border: '3px solid #000000',
    boxShadow: '3px 3px 0px #000000',
  },
  winnerScoreLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  winnerScoreValue: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#ff3c00',
  },
  trophyIcon: {
    fontSize: '4rem',
    position: 'absolute',
    top: '-1.5rem',
    right: '1rem',
    transform: 'rotate(15deg)',
  },
  gameOverActions: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    marginTop: '1rem',
  },
  newGameButton: {
    padding: '1rem 2rem',
    fontSize: '1.25rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: '#00c2ff', // Bright blue
    color: '#000000',
    border: '3px solid #000000',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px #000000',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
 
  
  // Name set styles
  nameSetHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: '#00c2ff', // Bright blue
    padding: '1rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
  },
  nameSetTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#000000',
    margin: 0,
    textAlign: 'center',
  },
  nameSetForm: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  nameInput: {
    width: '100%',
    padding: '1rem',
    fontSize: 'var(--fontSecondarySize)',
    fontFamily: "'Space Grotesk', sans-serif",
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    outline: 'none',
  },
  nameButton: {
    padding: '1rem',
    fontSize: '1.25rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--primary)',
    color: 'var(--text)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
  nameSetInfo: {
    backgroundColor: 'var(--backgroundSecondary)',
    padding: '1rem',
    border: '3px solid var(--text)',
    fontSize: 'var(--fontSecondarySize)',
    textAlign: 'center',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  
  // Waiting styles
  waitingHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--accent)',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  waitingTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#000000',
    margin: 0,
    textAlign: 'center',
  },
  waitingInfo: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },

  playerCount: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--background)',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  playerCountLabel: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
  },
  playerCountValue: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '2rem',
    backgroundColor: '#ffffff',
    padding: '0.25rem 0.75rem',
    border: '2px solid #000000',
  },
  startGameButton: {
    padding: '1.25rem',
    fontSize: '1.5rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--primary)',
    color: '#ffffff',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
    width: '100%',
  },
  creatorNote: {
    backgroundColor: '#ffffff',
    padding: '1.25rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  creatorIcon: {
    fontSize: '2.5rem',
  },
  creatorText: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  
  // Invite styles
  inviteContainer: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: '#ffffff',
    padding: '1.5rem',
    border: '4px solid #000000',
    boxShadow: '6px 6px 0px #000000',
    marginBottom: '1.5rem',
  },
  inviteHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--accent)',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  inviteTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#000000',
    margin: 0,
    textAlign: 'center',
  },
  inviteContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
    width: '100%',
  },
  inviteInput: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontFamily: "'Space Mono', monospace",
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
    backgroundColor: '#f0f0f0',
    color: '#000000',
    outline: 'none',
  },
  inviteButton: {
    padding: '1rem',
    fontSize: '1.25rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: '#00c2ff', // Bright blue
    color: '#000000',
    border: '3px solid #000000',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px #000000',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
  inviteInfo: {
    backgroundColor: 'var(--backgroundSecondary)',
    padding: '1rem',
    border: '3px solid var(--text)',
    fontSize: 'var(--fontSecondarySize)',
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  header: {
    position: 'sticky',
    top: '1rem',
    backgroundColor: 'var(--background)',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    border: 'var(--border)',
    boxShadow: 'var(--shadow)',
    zIndex: 10,
    marginBottom: '1.5rem',
  },
  roomInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  roomTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    margin: 0,
    color: 'var(--text)',
    backgroundColor: 'var(--secondary)',
    padding: '0.5rem 1rem',
    border: '3px solid var(--text)',
    boxShadow: '3px 3px 0px var(--text)',
  },
  statusContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '0.75rem',
  },
  reconnectingBadge: {
    backgroundColor: 'var(--primary)',
    color: 'var(--background)',
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    padding: '0.5rem 0.75rem',
    border: '3px solid var(--text)',
    boxShadow: '3px 3px 0px var(--text)',
    animation: 'pulse 1s infinite',
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
  },
  reconnectingText: {
    fontSize: '0.9rem',
  },
  reconnectingDots: {
    animation: 'pulse 1s infinite',
  },
  gameStatusBadge: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    padding: '0.5rem 0.75rem',
    border: '3px solid var(--text)',
    boxShadow: '3px 3px 0px var(--text)',
  },
  gameStatusText: {
    color: 'var(--text)',
    fontSize: '1rem',
  },
  
  // Game section styles
  roundHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--primary)', // Bright red
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  roundTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: 'var(--background)',
    margin: 0,
    textAlign: 'center',
  },
  gameInfo: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  categoryContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--background)',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  categoryLabel: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
  },
  categoryValue: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 'bold',
    fontSize: '1.25rem',
    backgroundColor: 'var(--secondary)', // Bright yellow
    padding: '0.5rem 1rem',
    border: '2px solid var(--text)',
  },
  lettersContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    backgroundColor: 'var(--background)',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  lettersLabel: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
  },
  letterBoxes: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  letterBox: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.5rem',
    backgroundColor: 'var(--accent)', // Bright blue
    color: 'var(--text)',
    padding: '0.5rem 0.75rem',
    border: '3px solid var(--text)',
    boxShadow: '3px 3px 0px var(--text)',
    minWidth: '2.5rem',
    textAlign: 'center',
  },
  timerContainer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
    marginBottom: '1.5rem',
  },
  timerLabel: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
    color: 'var(--text)',
  },
  timerValue: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '2rem',
    backgroundColor: 'var(--background)',
    padding: '0.25rem 0.75rem',
    border: '2px solid var(--text)',
    color: 'var(--text)',
  },
  submissionForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1rem',
    width: '100%',
  },
  submissionInput: {
    width: '100%',
    padding: '1rem',
    fontSize: '1.25rem',
    fontFamily: "'Space Mono', monospace",
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
    color: 'var(--text)',
    outline: 'none',
  },
  submissionButton: {
    padding: '1rem',
    fontSize: '1.5rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--secondary)', // Bright yellow
    color: 'var(--text)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
  submittedMessage: {
    backgroundColor: 'var(--accent)', // Bright blue
    padding: '1rem',
    border: '3px solid var(--text)',
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: "'Space Grotesk', sans-serif",
    color: 'var(--text)',
  },
  votingInstructions: {
    backgroundColor: 'var(--background)',
    padding: '1rem',
    border: '3px solid var(--text)',
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: "'Space Grotesk', sans-serif",
    marginBottom: '1.5rem',
  },
  votingList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
  },
  votingItem: {
    backgroundColor: 'var(--background)',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    cursor: 'pointer',
    transition: 'transform 0.1s, box-shadow 0.1s',
  },
  votingItemHighlighted: {
    backgroundColor: 'var(--secondary)', // Bright yellow
    transform: 'translate(-2px, -2px)',
    boxShadow: '6px 6px 0px var(--text)',
  },
  votingItemDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  votingItemOwn: {
    backgroundColor: '#f0f0f0',
    borderColor: 'var(--primary)',
  },
  votingAcronym: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
    color: 'var(--text)',
  },
  votingLabel: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '0.9rem',
    color: 'var(--text)',
    backgroundColor: 'var(--accent)', // Bright blue
    padding: '0.25rem 0.5rem',
    border: '2px solid var(--text)',
    alignSelf: 'flex-start',
  },
  resultsHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--accent)', // Bright blue
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  resultsTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: 'var(--text)',
    margin: 0,
    textAlign: 'center',
  },
  resultsList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    width: '100%',
    marginBottom: '1.5rem',
  },
  resultItem: {
    backgroundColor: 'var(--background)',
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  resultWinner: {
    backgroundColor: 'var(--secondary)', // Bright yellow
    borderColor: 'var(--primary)',
    borderWidth: '4px',
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultPlayer: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 'bold',
    fontSize: '1.1rem',
  },
  resultVotes: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    backgroundColor: 'var(--accent)', // Bright blue
    padding: '0.25rem 0.5rem',
    border: '2px solid var(--text)',
  },
  resultAcronym: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '1.25rem',
  },
  nextRoundButton: {
    padding: '1.25rem',
    fontSize: '1.5rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--primary)', // Bright red
    color: 'var(--background)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
    width: '100%',
  },
  
  // Game over styles
  gameOverHeader: {
    width: '100%',
    marginBottom: '1.5rem',
    backgroundColor: 'var(--primary)', // Bright red
    padding: '1rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
  },
  gameOverTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '2rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: 'var(--background)',
    margin: 0,
    textAlign: 'center',
  },
  winnerContainer: {
    backgroundColor: 'var(--secondary)', // Bright yellow
    padding: '2rem',
    border: '4px solid var(--text)',
    boxShadow: '6px 6px 0px var(--text)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '2rem',
    position: 'relative',
  },
  winnerLabel: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.25rem',
    fontWeight: 'bold',
    backgroundColor: 'var(--background)',
    padding: '0.5rem 1rem',
    border: '3px solid var(--text)',
    boxShadow: '3px 3px 0px var(--text)',
  },
  winnerName: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '2.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: 'var(--text)',
    textAlign: 'center',
    textShadow: '2px 2px 0px var(--primary)',
  },
  winnerScore: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  winnerScoreLabel: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  winnerScoreValue: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '3rem',
    fontWeight: 'bold',
    backgroundColor: 'var(--background)',
    padding: '0.5rem 1.5rem',
    border: '3px solid var(--text)',
    boxShadow: '3px 3px 0px var(--text)',
  },
  trophyIcon: {
    fontSize: '4rem',
    marginTop: '1rem',
  },
  gameOverActions: {
    width: '100%',
  },
  newGameButton: {
    padding: '1.5rem',
    fontSize: '1.5rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--accent)', // Bright blue
    color: 'var(--text)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
    width: '100%',
  },

  resultPlayerLabel: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '0.9rem',
    fontWeight: 'bold',
    marginRight: '0.5rem',
  },
  resultPlayerName: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  yourResultBadge: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '0.8rem',
    backgroundColor: 'var(--primary)',
    color: 'var(--background)',
    padding: '0.1rem 0.3rem',
    border: '1px solid var(--text)',
  },
  resultVotesLabel: {
    marginRight: '0.5rem',
  },
  
  // Chat styles
  chatContainer: {
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'var(--background)',
    padding: '1.5rem',
    border: 'var(--border)',
    boxShadow: 'var(--shadow)',
    marginTop: '2rem',
  },
  chatTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: 'var(--text)',
    marginTop: 0,
    marginBottom: '1rem',
    backgroundColor: 'var(--accent)', // Bright blue
    padding: '0.75rem',
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
    textAlign: 'center',
  },
  chatListWrapper: {
    border: '3px solid var(--text)',
    height: '300px',
    overflowY: 'auto',
    marginBottom: '1rem',
    backgroundColor: '#f0f0f0',
  },
  chatList: {
    listStyle: 'none',
    padding: '1rem',
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  chatItem: {
    padding: '0.75rem',
    border: '2px solid var(--text)',
    boxShadow: '3px 3px 0px var(--text)',
    maxWidth: '80%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  chatSender: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '0.9rem',
    color: 'var(--text)',
  },
  chatMessage: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '1rem',
    color: 'var(--text)',
    wordBreak: 'break-word',
  },
  chatInputContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    width: '100%',
  },
  chatInput: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontFamily: "'Space Grotesk', sans-serif",
    border: '3px solid var(--text)',
    boxShadow: '4px 4px 0px var(--text)',
    backgroundColor: 'var(--background)',
    color: 'var(--text)',
    outline: 'none',
  },
  chatButton: {
    padding: '0.75rem',
    fontSize: '1.25rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--secondary)', // Bright yellow
    color: 'var(--text)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '2rem',
    color: 'var(--text)',
    margin: 0,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    textShadow: `2px 0 0 var(--primary), -2px 0 0 var(--accent)`,
  },
  subtitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    color: 'var(--text)',
    marginBottom: '1rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    position: 'relative',
    display: 'inline-block',
  },
  category: {
    fontWeight: 'bold',
    color: 'var(--primary)', // Bright red
    backgroundColor: 'var(--background)',
    padding: '0.25rem 0.5rem',
    border: '2px solid var(--text)',
  },
  timer: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.25rem',
    marginBottom: '1rem',
    fontWeight: 'bold',
    backgroundColor: 'var(--background)',
    padding: '0.5rem 1rem',
    border: '3px solid var(--text)',
    display: 'inline-block',
  },
  invite: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginBottom: '1.5rem',
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'var(--background)',
    padding: '1.5rem',
    border: 'var(--border)',
    boxShadow: 'var(--shadow)',
  },
  input: {
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    fontFamily: "'Space Mono', monospace",
    border: '3px solid var(--text)',
    width: '100%',
    boxSizing: 'border-box',
    backgroundColor: 'var(--background)',
    color: 'var(--text)',
    outline: 'none',
  },
  button: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--accent)', // Bright blue
    color: 'var(--text)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
  voteButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.9rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--primary)', // Bright red
    color: 'var(--background)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '3px 3px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
  leaveButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: 'var(--primary)', // Bright red
    color: 'var(--background)',
    border: '3px solid var(--text)',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px var(--text)',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
    margin: '1.5rem auto 0',
  },
  playerList: {
    listStyle: 'none',
    padding: '1rem',
    marginBottom: '1.5rem',
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'var(--background)',
    border: 'var(--border)',
    boxShadow: 'var(--shadow)',
  },
  playerItem: {
    padding: '0.75rem',
    marginBottom: '0.75rem',
    border: '2px solid var(--text)',
    textAlign: 'center',
    color: 'var(--text)',
    fontWeight: 'bold',
    backgroundColor: '#f0f0f0',
  },
  submissionList: {
    listStyle: 'none',
    padding: 0,
    width: '100%',
    maxWidth: '800px',
  },
  submissionItem: {
    padding: '1rem',
    backgroundColor: 'var(--background)',
    marginBottom: '0.75rem',
    border: '3px solid var(--text)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    maxWidth: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
    boxShadow: '4px 4px 0px var(--text)',
    color: 'var(--text)',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: '1.5rem',
    width: '100%',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'var(--background)',
    padding: '1.5rem',
    border: 'var(--border)',
    boxShadow: 'var(--shadow)',
  },
  note: {
    color: 'var(--text)',
    fontSize: '1rem',
    marginTop: '0.75rem',
    fontWeight: 'bold',
    backgroundColor: 'var(--secondary)', // Bright yellow
    padding: '0.5rem',
    border: '2px solid var(--text)',
    display: 'inline-block',
  },
  loading: {
    fontSize: '1.5rem',
    textAlign: 'center',
    marginTop: '20vh',
    color: 'var(--text)',
    fontWeight: 'bold',
    backgroundColor: 'var(--background)',
    padding: '1.5rem',
    border: 'var(--border)',
    boxShadow: 'var(--shadow)',
  },
  chatContainer: {
    marginTop: '1.5rem',
    width: '100%',
    maxWidth: '800px',
    backgroundColor: 'var(--background)',
    padding: '1.5rem',
    border: 'var(--border)',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  chatTitle: {
    fontFamily: "'Space Mono', monospace",
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: '1rem',
    position: 'relative',
    display: 'inline-block',
    backgroundColor: '#00c2ff',
    padding: '0.5rem 1rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
    alignSelf: 'flex-start',
  },
  chatListWrapper: {
    border: '3px solid #000000',
    backgroundColor: '#f0f0f0',
    padding: '1rem',
    width: '100%',
    height: '300px',
    overflowY: 'auto',
  },
  chatList: {
    listStyle: 'none',
    padding: '0',
    margin: '0',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  chatItem: {
    padding: '0.75rem',
    marginBottom: '0.5rem',
    border: '2px solid #000000',
    boxShadow: '3px 3px 0px #000000',
    maxWidth: '80%',
    wordBreak: 'break-word',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  chatSender: {
    fontFamily: "'Space Mono', monospace",
    fontWeight: 'bold',
    fontSize: '0.9rem',
    backgroundColor: '#ff3c00',
    color: '#ffffff',
    padding: '0.25rem 0.5rem',
    border: '2px solid #000000',
    display: 'inline-block',
    alignSelf: 'flex-start',
  },
  chatMessage: {
    fontFamily: "'Space Grotesk', sans-serif",
    fontSize: '1rem',
    color: '#000000',
  },
  chatInputContainer: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
    backgroundColor: '#00c2ff', // Bright blue
    padding: '0.75rem',
    border: '3px solid #000000',
    boxShadow: '4px 4px 0px #000000',
  },
  chatInput: {
    flex: '1',
    padding: '0.75rem',
    fontSize: '1rem',
    fontFamily: "'Space Grotesk', sans-serif",
    border: '3px solid #000000',
    backgroundColor: '#ffffff',
    color: '#000000',
    outline: 'none',
  },
  chatButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    fontFamily: "'Space Mono', monospace",
    backgroundColor: '#ff3c00', // Bright red
    color: '#ffffff',
    border: '3px solid #000000',
    cursor: 'pointer',
    fontWeight: 'bold',
    boxShadow: '4px 4px 0px #000000',
    transition: 'transform 0.1s, box-shadow 0.1s',
    textTransform: 'uppercase',
  },
};

export default GameRoom;