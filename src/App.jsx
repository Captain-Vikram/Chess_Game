import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, History, RotateCcw, Trophy, Scroll, Info } from 'lucide-react';

// --- Game Constants & Initial State ---

const INITIAL_BOARD = [
  ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
  ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  [null, null, null, null, null, null, null, null],
  ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
  ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
];

const PIECE_SYMBOLS = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

// Japanese Aesthetic Palette
const COLORS = {
  boardLight: '#E6CBA5', // Tatami Straw
  boardDark: '#8C6446',  // Aged Wood
  highlight: 'rgba(212, 163, 115, 0.6)', // Selection glow
  validMove: 'rgba(107, 142, 35, 0.5)', // Moss Green
  check: 'rgba(191, 75, 75, 0.6)', // Cinnabar Red
  textDark: '#1a1a1a', // Sumi Ink
  paper: '#F4F1EA', // Rice Paper
};

export default function App() {
  // --- State ---
  const [board, setBoard] = useState(INITIAL_BOARD);
  const [turn, setTurn] = useState('w'); // 'w' or 'b'
  const [selected, setSelected] = useState(null); // {r, c}
  const [validMoves, setValidMoves] = useState([]); // Array of {r, c}
  const [history, setHistory] = useState([]);
  const [gameState, setGameState] = useState('playing'); // playing, checkmate, stalemate, draw
  const [checkPos, setCheckPos] = useState(null); // {r,c} of King in check
  const [promotionSquare, setPromotionSquare] = useState(null); // {r, c} waiting for promotion
  
  // Special Move Tracking
  const [castlingRights, setCastlingRights] = useState({
    w: { kingSide: true, queenSide: true },
    b: { kingSide: true, queenSide: true }
  });
  const [enPassantTarget, setEnPassantTarget] = useState(null); // {r, c} square BEHIND the pawn
  
  // --- Logic Engine ---

  const getPieceColor = (piece) => {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? 'w' : 'b';
  };

  const isOpponent = (p1, p2) => {
    return p1 && p2 && getPieceColor(p1) !== getPieceColor(p2);
  };

  // 1. Geometry Validator: Can the piece physically move there?
  const getGeometryMoves = (boardState, r, c, piece, rights, epTarget) => {
    const moves = [];
    const color = getPieceColor(piece);
    const type = piece.toLowerCase();
    const forward = color === 'w' ? -1 : 1;

    // Helper to add if empty or capture
    const tryAdd = (tr, tc) => {
      if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const target = boardState[tr][tc];
        if (!target) moves.push({ r: tr, c: tc });
        else if (getPieceColor(target) !== color) moves.push({ r: tr, c: tc });
      }
    };

    // Helper for sliding pieces (Rook, Bishop, Queen)
    const slide = (dr, dc) => {
      let tr = r + dr;
      let tc = c + dc;
      while (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
        const target = boardState[tr][tc];
        if (!target) {
          moves.push({ r: tr, c: tc });
        } else {
          if (getPieceColor(target) !== color) moves.push({ r: tr, c: tc });
          break; // Blocked
        }
        tr += dr;
        tc += dc;
      }
    };

    if (type === 'p') {
      // Move Forward 1
      if (!boardState[r + forward][c]) {
        moves.push({ r: r + forward, c });
        // Move Forward 2 (Initial)
        const startRow = color === 'w' ? 6 : 1;
        if (r === startRow && !boardState[r + forward * 2][c]) {
          moves.push({ r: r + forward * 2, c, isDoublePush: true });
        }
      }
      // Captures
      [[forward, -1], [forward, 1]].forEach(([dr, dc]) => {
        const tr = r + dr, tc = c + dc;
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
          const target = boardState[tr][tc];
          if (target && getPieceColor(target) !== color) {
            moves.push({ r: tr, c: tc });
          }
          // En Passant
          if (epTarget && tr === epTarget.r && tc === epTarget.c) {
            moves.push({ r: tr, c: tc, isEnPassant: true });
          }
        }
      });
    } else if (type === 'n') {
      [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]].forEach(([dr, dc]) => tryAdd(r + dr, c + dc));
    } else if (type === 'b') {
      [[-1,-1], [-1,1], [1,-1], [1,1]].forEach(([dr, dc]) => slide(dr, dc));
    } else if (type === 'r') {
      [[-1,0], [1,0], [0,-1], [0,1]].forEach(([dr, dc]) => slide(dr, dc));
    } else if (type === 'q') {
      [[-1,-1], [-1,1], [1,-1], [1,1], [-1,0], [1,0], [0,-1], [0,1]].forEach(([dr, dc]) => slide(dr, dc));
    } else if (type === 'k') {
      [[-1,-1], [-1,0], [-1,1], [0,-1], [0,1], [1,-1], [1,0], [1,1]].forEach(([dr, dc]) => tryAdd(r + dr, c + dc));
      
      // Castling logic (Geometry only, safety checked later)
      // We check raw board emptiness here. Safety is checked in `getValidMoves`.
      if (rights && rights[color]) {
        if (rights[color].kingSide && boardState[r][c+1] === null && boardState[r][c+2] === null) {
          moves.push({ r, c: c + 2, isCastle: 'k' });
        }
        if (rights[color].queenSide && boardState[r][c-1] === null && boardState[r][c-2] === null && boardState[r][c-3] === null) {
          moves.push({ r, c: c - 2, isCastle: 'q' });
        }
      }
    }
    return moves;
  };

  // 2. Safety Validator: Does this move leave the King in check?
  const isKingInCheck = (currentBoard, kingColor) => {
    // Find King
    let kR, kC;
    for(let r=0; r<8; r++) {
      for(let c=0; c<8; c++) {
        if (currentBoard[r][c] === (kingColor === 'w' ? 'K' : 'k')) {
          kR = r; kC = c; break;
        }
      }
    }
    if (kR === undefined) return true; // Should not happen unless king captured (impossible)

    // Check if any opponent piece attacks (kR, kC)
    // We reverse check: pretend King is a Queen/Knight and see if it hits an enemy piece of that type
    const opponent = kingColor === 'w' ? 'b' : 'w';
    
    // Check Knight threats
    const knightMoves = [[-2,-1], [-2,1], [-1,-2], [-1,2], [1,-2], [1,2], [2,-1], [2,1]];
    for(let m of knightMoves) {
      const tr = kR + m[0], tc = kC + m[1];
      if (tr>=0 && tr<8 && tc>=0 && tc<8) {
        const p = currentBoard[tr][tc];
        if (p && getPieceColor(p) === opponent && p.toLowerCase() === 'n') return true;
      }
    }

    // Check Sliding (Rook/Queen)
    const orth = [[-1,0], [1,0], [0,-1], [0,1]];
    for(let m of orth) {
      let tr = kR + m[0], tc = kC + m[1];
      while(tr>=0 && tr<8 && tc>=0 && tc<8) {
        const p = currentBoard[tr][tc];
        if (p) {
          if (getPieceColor(p) === opponent && (p.toLowerCase() === 'r' || p.toLowerCase() === 'q')) return true;
          break; 
        }
        tr += m[0]; tc += m[1];
      }
    }

    // Check Diagonal (Bishop/Queen)
    const diag = [[-1,-1], [-1,1], [1,-1], [1,1]];
    for(let m of diag) {
      let tr = kR + m[0], tc = kC + m[1];
      while(tr>=0 && tr<8 && tc>=0 && tc<8) {
        const p = currentBoard[tr][tc];
        if (p) {
          if (getPieceColor(p) === opponent && (p.toLowerCase() === 'b' || p.toLowerCase() === 'q')) return true;
          break;
        }
        tr += m[0]; tc += m[1];
      }
    }

    // Check Pawn
    const forward = kingColor === 'w' ? -1 : 1;
    // Pawns attack from [forward, -1] and [forward, 1] relative to the attacking pawn
    // So looking FROM king, we check [ -forward, -1 ] and [ -forward, 1 ]
    const pawnRow = kR - forward; 
    if (pawnRow >= 0 && pawnRow < 8) {
      if (currentBoard[pawnRow][kC-1] && getPieceColor(currentBoard[pawnRow][kC-1]) === opponent && currentBoard[pawnRow][kC-1].toLowerCase() === 'p') return true;
      if (currentBoard[pawnRow][kC+1] && getPieceColor(currentBoard[pawnRow][kC+1]) === opponent && currentBoard[pawnRow][kC+1].toLowerCase() === 'p') return true;
    }

    // Check King (adjacent)
    for(let r=-1; r<=1; r++) {
      for(let c=-1; c<=1; c++) {
        if(r===0 && c===0) continue;
        const tr = kR + r, tc = kC + c;
        if(tr>=0 && tr<8 && tc>=0 && tc<8) {
           const p = currentBoard[tr][tc];
           if (p && getPieceColor(p) === opponent && p.toLowerCase() === 'k') return true;
        }
      }
    }

    return false;
  };

  // 3. Main Move Generator
  const getValidMoves = (r, c, checkCastlingSafety = true, currentBoard = board, activeColor = turn) => {
    const piece = currentBoard[r][c];
    if (!piece) return [];
    
    // 1. Get Physical Moves
    let moves = getGeometryMoves(currentBoard, r, c, piece, castlingRights, enPassantTarget);

    // 2. Filter Illegal Moves (Self-Check)
    moves = moves.filter(move => {
      // Create hypothetical board
      const tempBoard = currentBoard.map(row => [...row]);
      
      // Execute move on temp board
      tempBoard[move.r][move.c] = piece;
      tempBoard[r][c] = null;
      
      // Handle En Passant in temp board
      if (move.isEnPassant) {
        const captureRow = r; // Same row as start
        const captureCol = move.c;
        tempBoard[captureRow][captureCol] = null;
      }

      // Handle Castling King Movement in temp board (Rook move doesn't matter for King safety check usually, but King position does)
      // Actually, standard castling rules say you cannot castle OUT of check, THROUGH check, or INTO check.
      // The `isKingInCheck` on the final state handles "Into Check".
      // "Out of Check" is handled because if we are currently in check, any move must resolve it.
      
      return !isKingInCheck(tempBoard, activeColor);
    });

    // 3. Special Castling Safety Rules (Cannot move through check)
    if (checkCastlingSafety && piece.toLowerCase() === 'k') {
      moves = moves.filter(move => {
        if (!move.isCastle) return true;
        
        // 1. Cannot castle if currently in check
        if (isKingInCheck(currentBoard, activeColor)) return false;

        // 2. Cannot move THROUGH check
        const dir = move.isCastle === 'k' ? 1 : -1;
        const pathSquareC = c + dir;
        
        // Check if the intermediate square is under attack
        const tempBoard = currentBoard.map(row => [...row]);
        tempBoard[r][pathSquareC] = piece; // Move king 1 step
        tempBoard[r][c] = null;
        if (isKingInCheck(tempBoard, activeColor)) return false;

        return true;
      });
    }

    return moves;
  };

  // --- Interaction Handlers ---

  const handleSquareClick = (r, c) => {
    if (gameState !== 'playing' || promotionSquare) return;

    // If clicking a valid move for selected piece
    const move = validMoves.find(m => m.r === r && m.c === c);
    
    if (selected && move) {
      executeMove(selected.r, selected.c, move);
    } else {
      // Selecting a piece
      const piece = board[r][c];
      if (piece && getPieceColor(piece) === turn) {
        setSelected({ r, c });
        setValidMoves(getValidMoves(r, c));
      } else {
        setSelected(null);
        setValidMoves([]);
      }
    }
  };

  const executeMove = (startR, startC, move) => {
    const piece = board[startR][startC];
    const newBoard = board.map(row => [...row]);
    let moveStr = piece.toUpperCase() === 'P' ? '' : piece.toUpperCase();
    
    // Capture String Logic
    if (newBoard[move.r][move.c] || move.isEnPassant) {
      if (piece.toLowerCase() === 'p') moveStr = "abcdefgh"[startC] + 'x';
      else moveStr += 'x';
    }
    moveStr += "abcdefgh"[move.c] + (8 - move.r);

    // Update Board
    newBoard[move.r][move.c] = piece;
    newBoard[startR][startC] = null;

    // Handle En Passant Capture
    if (move.isEnPassant) {
      newBoard[startR][move.c] = null; // Remove the pawn behind
      moveStr += ' e.p.';
    }

    // Handle Castling Rook Move
    if (move.isCastle) {
      const row = startR;
      if (move.isCastle === 'k') {
        newBoard[row][5] = newBoard[row][7]; // Move Rook to F
        newBoard[row][7] = null;
        moveStr = 'O-O';
      } else {
        newBoard[row][3] = newBoard[row][0]; // Move Rook to D
        newBoard[row][0] = null;
        moveStr = 'O-O-O';
      }
    }

    // Update Castling Rights
    const newRights = { ...castlingRights };
    
    // 1. If King or Rook moves, disable rights
    if (piece.toLowerCase() === 'k') {
      newRights[turn].kingSide = false;
      newRights[turn].queenSide = false;
    }
    if (piece.toLowerCase() === 'r') {
      if (startC === 0) newRights[turn].queenSide = false;
      if (startC === 7) newRights[turn].kingSide = false;
    }

    // 2. If Rook is captured, disable opponent's rights
    // We check the destination square `move.r, move.c` in the OLD board (before update, but we have `newBoard` here)
    // Actually, we need to check what was at `board[move.r][move.c]` BEFORE the move.
    // But we already overwrote it in `newBoard`. Let's check `board` (state).
    const capturedPiece = board[move.r][move.c];
    if (capturedPiece && capturedPiece.toLowerCase() === 'r') {
      const opponent = turn === 'w' ? 'b' : 'w';
      // If captured rook was at specific initial positions
      // Black Rooks: 0,0 and 0,7. White Rooks: 7,0 and 7,7.
      if (move.r === 0 && move.c === 0) newRights['b'].queenSide = false;
      if (move.r === 0 && move.c === 7) newRights['b'].kingSide = false;
      if (move.r === 7 && move.c === 0) newRights['w'].queenSide = false;
      if (move.r === 7 && move.c === 7) newRights['w'].kingSide = false;
    }
    
    // Update En Passant Target
    let newEpTarget = null;
    if (move.isDoublePush) {
      const behindR = turn === 'w' ? move.r + 1 : move.r - 1;
      newEpTarget = { r: behindR, c: move.c };
    }

    // Handle Promotion
    if (piece.toLowerCase() === 'p' && (move.r === 0 || move.r === 7)) {
      setBoard(newBoard);
      setPromotionSquare({ r: move.r, c: move.c, moveStr }); // Pause for selection
      setValidMoves([]);
      setSelected(null);
      setEnPassantTarget(newEpTarget);
      setCastlingRights(newRights);
      return; // Wait for modal
    }

    finalizeMove(newBoard, turn === 'w' ? 'b' : 'w', newEpTarget, newRights, moveStr);
  };

  const handlePromotion = (type) => {
    const { r, c, moveStr } = promotionSquare;
    const newBoard = board.map(row => [...row]);
    const color = turn;
    newBoard[r][c] = color === 'w' ? type.toUpperCase() : type.toLowerCase();
    
    finalizeMove(newBoard, color === 'w' ? 'b' : 'w', enPassantTarget, castlingRights, moveStr + "=" + type.toUpperCase());
    setPromotionSquare(null);
  };

  const finalizeMove = (newBoard, nextTurn, epTarget, rights, moveStr) => {
    // Check for check/mate
    let state = 'playing';
    let checkP = null;

    if (isKingInCheck(newBoard, nextTurn)) {
      // It is Check. Is it Checkmate?
      // Get all pieces for nextTurn
      let hasLegal = false;
      for(let r=0; r<8; r++) {
        for(let c=0; c<8; c++) {
          if (newBoard[r][c] && getPieceColor(newBoard[r][c]) === nextTurn) {
            // Can check valid moves? 
          }
        }
      }
      moveStr += '+';
      checkP = findKing(newBoard, nextTurn);
    }
    
    setBoard(newBoard);
    setTurn(nextTurn);
    setEnPassantTarget(epTarget);
    setCastlingRights(rights);
    setHistory([...history, moveStr]);
    setSelected(null);
    setValidMoves([]);
    setCheckPos(checkP);
  };

  // Find King helper
  const findKing = (b, color) => {
    for(let r=0; r<8; r++) for(let c=0; c<8; c++) if(b[r][c] === (color==='w'?'K':'k')) return {r,c};
    return null;
  };

  // Check Game Over Conditions in Effect
  useEffect(() => {
    if (isKingInCheck(board, turn)) {
      // Check for Mate
      if (!hasAnyValidMoves(board, turn)) {
        setGameState('checkmate');
      } else {
        setCheckPos(findKing(board, turn));
      }
    } else {
      setCheckPos(null);
      // Check for Stalemate
      if (!hasAnyValidMoves(board, turn)) {
        setGameState('stalemate');
      }
    }
  }, [board, turn]);

  // Helper to check if ANY valid move exists (optimized for speed)
  const hasAnyValidMoves = (currentBoard, color) => {
    for(let r=0; r<8; r++) {
      for(let c=0; c<8; c++) {
        const p = currentBoard[r][c];
        if (p && getPieceColor(p) === color) {
          // We only need ONE valid move to prove it's not mate
          const moves = getValidMoves(r, c, true, currentBoard, color);
          if (moves.length > 0) return true;
        }
      }
    }
    return false;
  };
  
  // --- Render Helpers ---

  const CapturedPieces = ({ color }) => {
    const captured = [];
    const counts = { p:8, n:2, b:2, r:2, q:1 };
    
    // Naive count based on what's missing from board
    const onBoard = { p:0, n:0, b:0, r:0, q:0, k:0 };
    board.forEach(row => row.forEach(p => {
      if(p && getPieceColor(p) !== color) onBoard[p.toLowerCase()]++;
    }));

    Object.keys(counts).forEach(type => {
      const lost = counts[type] - onBoard[type];
      for(let i=0; i<lost; i++) captured.push(type);
    });

    return (
      <div className="flex flex-wrap gap-1 p-2 bg-stone-200/50 rounded-lg min-h-[50px] shadow-inner">
        {captured.map((type, i) => (
          <span key={i} className="text-2xl" style={{color: color === 'w' ? '#000' : '#555'}}>
            {PIECE_SYMBOLS[color === 'w' ? 'b' : 'w'][type]}
          </span>
        ))}
        {captured.length === 0 && <span className="text-xs text-stone-400 italic self-center">No captures</span>}
      </div>
    );
  };

  const restart = () => {
    setBoard(INITIAL_BOARD);
    setTurn('w');
    setHistory([]);
    setGameState('playing');
    setCastlingRights({ w: { kingSide: true, queenSide: true }, b: { kingSide: true, queenSide: true } });
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center font-serif text-stone-800 relative overflow-hidden"
         style={{ backgroundColor: COLORS.paper }}>
      
      {/* Background Texture */}
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#8C6446 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>

      {/* Header */}
      <div className="z-10 mb-6 text-center">
        <h1 className="text-4xl font-bold tracking-widest uppercase mb-1" style={{ color: COLORS.textDark }}>Dojo Chess</h1>
        <div className="flex items-center justify-center gap-2 text-sm uppercase tracking-wide opacity-70">
          <Sparkles size={16} /> <span>Tactical Strategy</span> <Sparkles size={16} />
        </div>
      </div>

      <div className="z-10 flex flex-col md:flex-row gap-8 items-start max-w-6xl w-full px-4 justify-center">
        
        {/* Left Panel: Black Player Stats */}
        <div className="w-full md:w-64 bg-white/60 backdrop-blur-sm p-4 rounded-xl border-2 border-stone-200 shadow-xl flex flex-col gap-4 order-2 md:order-1">
          <div className="flex items-center justify-between border-b pb-2 border-stone-300">
            <span className="font-bold flex items-center gap-2"><span className="text-2xl">♟</span> Black</span>
            {turn === 'b' && <span className="animate-pulse w-3 h-3 rounded-full bg-red-500"></span>}
          </div>
          <div className="text-xs uppercase tracking-wider text-stone-500">Captured White Pieces</div>
          <CapturedPieces color="w" />
          
          <div className="mt-auto pt-4 border-t border-stone-300 text-center text-sm text-stone-500">
             {gameState === 'checkmate' && turn === 'b' ? 'Checkmated' : gameState === 'stalemate' && turn === 'b' ? 'Stalemate' : turn === 'b' ? 'Thinking...' : 'Waiting'}
          </div>
        </div>

        {/* Center: The Board */}
        <div className="relative p-3 rounded-sm shadow-2xl order-1 md:order-2" 
             style={{ backgroundColor: '#5c4033', boxShadow: '0 20px 50px -12px rgba(0,0,0,0.5)' }}>
          
          {/* Coordinates */}
          <div className="absolute left-0 top-0 bottom-0 w-6 flex flex-col justify-around text-xs text-[#E6CBA5] font-bold pl-1">
            {[8,7,6,5,4,3,2,1].map(n => <span key={n}>{n}</span>)}
          </div>
          <div className="absolute left-6 right-6 bottom-0 h-6 flex justify-around text-xs text-[#E6CBA5] font-bold pt-1">
            {['a','b','c','d','e','f','g','h'].map(c => <span key={c}>{c}</span>)}
          </div>

          <div className="grid grid-cols-8 grid-rows-8 w-[320px] h-[320px] sm:w-[480px] sm:h-[480px] border-4 border-[#4a332a] ml-4 mb-4">
            {board.map((row, r) => 
              row.map((piece, c) => {
                const isBlackSq = (r + c) % 2 === 1;
                const isSelected = selected && selected.r === r && selected.c === c;
                const isValid = validMoves.some(m => m.r === r && m.c === c);
                const isCheck = checkPos && checkPos.r === r && checkPos.c === c;
                const isLastMoveSrc = false; // TODO: Parse history for highlights
                const isLastMoveDst = false; 

                return (
                  <div 
                    key={`${r}-${c}`}
                    onClick={() => handleSquareClick(r, c)}
                    className={`relative flex items-center justify-center text-3xl sm:text-5xl cursor-pointer transition-colors duration-150 select-none
                      ${isBlackSq ? '' : ''}
                    `}
                    style={{
                      backgroundColor: isCheck ? COLORS.check : 
                                       isSelected ? COLORS.highlight : 
                                       isBlackSq ? COLORS.boardDark : COLORS.boardLight,
                    }}
                  >
                    {/* Valid Move Indicator */}
                    {isValid && (
                      <div className="absolute w-3 h-3 sm:w-4 sm:h-4 rounded-full z-10" 
                           style={{ backgroundColor: !piece ? 'rgba(0,0,0,0.2)' : 'rgba(200,0,0,0.4)' }}></div>
                    )}

                    {/* The Piece */}
                    {piece && (
                      <span 
                        className={`z-20 drop-shadow-md transform hover:scale-105 transition-transform duration-200`}
                        style={{ color: getPieceColor(piece) === 'w' ? '#fff' : '#000', textShadow: getPieceColor(piece) === 'w' ? '0 1px 2px rgba(0,0,0,0.5)' : '0 1px 1px rgba(255,255,255,0.2)' }}
                      >
                        {PIECE_SYMBOLS[getPieceColor(piece)][piece.toLowerCase()]}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Promotion Modal Overlay */}
          {promotionSquare && (
            <div className="absolute inset-0 bg-black/60 z-50 flex flex-col items-center justify-center rounded-sm backdrop-blur-sm">
              <div className="bg-[#F4F1EA] p-6 rounded-lg shadow-2xl text-center border-4 border-[#8C6446]">
                <h3 className="mb-4 font-bold text-xl uppercase tracking-widest text-[#8C6446]">Promote Pawn</h3>
                <div className="flex gap-4">
                  {['q', 'r', 'b', 'n'].map(p => (
                    <button key={p} onClick={() => handlePromotion(p)} 
                            className="text-4xl w-16 h-16 rounded hover:bg-[#E6CBA5] transition-colors border border-stone-300 shadow-sm">
                      {PIECE_SYMBOLS[turn][p]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Game Over Overlay */}
          {gameState !== 'playing' && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-sm">
              <div className="bg-white p-8 rounded-xl shadow-2xl text-center border-4 border-stone-800 animate-in fade-in zoom-in duration-300">
                <Trophy className="mx-auto mb-4 text-yellow-500 w-12 h-12" />
                <h2 className="text-3xl font-bold mb-2 uppercase">
                  {gameState === 'checkmate' ? (turn === 'w' ? 'Black Wins' : 'White Wins') : 'Draw'}
                </h2>
                <p className="text-stone-500 mb-6 font-mono text-sm">{gameState.toUpperCase()}</p>
                <button onClick={restart} className="flex items-center gap-2 bg-stone-800 text-white px-6 py-2 rounded-full mx-auto hover:bg-stone-700 transition">
                  <RotateCcw size={18} /> New Game
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: White Stats & History */}
        <div className="w-full md:w-64 bg-white/60 backdrop-blur-sm p-4 rounded-xl border-2 border-stone-200 shadow-xl flex flex-col gap-4 order-3 h-full max-h-[600px]">
          <div className="flex items-center justify-between border-b pb-2 border-stone-300">
            <span className="font-bold flex items-center gap-2"><span className="text-2xl text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">♟</span> White</span>
            {turn === 'w' && <span className="animate-pulse w-3 h-3 rounded-full bg-green-500"></span>}
          </div>
          <div className="text-xs uppercase tracking-wider text-stone-500">Captured Black Pieces</div>
          <CapturedPieces color="b" />

          <div className="flex-1 overflow-hidden flex flex-col min-h-[200px] mt-2 bg-white/50 rounded-lg border border-stone-200">
             <div className="p-2 bg-stone-100 border-b border-stone-200 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
               <History size={14} /> Move History
             </div>
             <div className="overflow-y-auto p-2 font-mono text-sm space-y-1">
               {history.length === 0 && <div className="text-stone-400 text-center py-4 italic">Match Start</div>}
               {history.map((move, i) => {
                 if (i % 2 === 0) {
                   return (
                     <div key={i} className="flex border-b border-stone-100 last:border-0 hover:bg-stone-100">
                       <span className="w-8 text-stone-400 border-r border-stone-200 mr-2 text-right pr-1">{(i/2)+1}.</span>
                       <span className="w-12 font-medium text-stone-800">{move}</span>
                       <span className="w-12 font-medium text-stone-800">{history[i+1] || ''}</span>
                     </div>
                   );
                 }
                 return null;
               })}
               <div id="scroll-anchor"></div>
             </div>
          </div>
          
          <div className="mt-auto pt-4 border-t border-stone-300 text-center">
            <button onClick={restart} className="text-xs text-stone-400 hover:text-stone-700 underline flex items-center justify-center gap-1 mx-auto">
               <RotateCcw size={12} /> Reset Board
            </button>
          </div>
        </div>

      </div>
      
      {/* Footer Info */}
      <div className="z-10 mt-8 text-xs text-stone-400 flex gap-6">
        <span className="flex items-center gap-1"><Info size={12}/> Standard Rules</span>
        <span className="flex items-center gap-1"><Info size={12}/> Castling</span>
        <span className="flex items-center gap-1"><Info size={12}/> En Passant</span>
      </div>

    </div>
  );
}