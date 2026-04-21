import { useRef, useState, useCallback } from 'react';

const API = `${process.env.API_ENDPOINT ?? 'http://localhost:3000'}/api/vr`;

export const ACUITY_LEVELS = [
  { label:'0.00D',  sizeLevel:1,  sizePx:18,  diopters:0.00  },
  { label:'-0.25D', sizeLevel:2,  sizePx:20,  diopters:-0.25 },
  { label:'-0.50D', sizeLevel:3,  sizePx:23,  diopters:-0.50 },
  { label:'-0.75D', sizeLevel:4,  sizePx:25,  diopters:-0.75 },
  { label:'-1.00D', sizeLevel:5,  sizePx:29,  diopters:-1.00 },
  { label:'-1.25D', sizeLevel:6,  sizePx:32,  diopters:-1.25 },
  { label:'-1.50D', sizeLevel:7,  sizePx:36,  diopters:-1.50 },
  { label:'-1.75D', sizeLevel:8,  sizePx:40,  diopters:-1.75 },
  { label:'-2.00D', sizeLevel:9,  sizePx:45,  diopters:-2.00 },
  { label:'-2.25D', sizeLevel:10, sizePx:51,  diopters:-2.25 },
  { label:'-2.50D', sizeLevel:11, sizePx:57,  diopters:-2.50 },
  { label:'-2.75D', sizeLevel:12, sizePx:64,  diopters:-2.75 },
  { label:'-3.00D', sizeLevel:13, sizePx:72,  diopters:-3.00 },
  { label:'-3.25D', sizeLevel:14, sizePx:80,  diopters:-3.25 },
  { label:'-3.50D', sizeLevel:15, sizePx:90,  diopters:-3.50 },
  { label:'-3.75D', sizeLevel:16, sizePx:101, diopters:-3.75 },
  { label:'-4.00D', sizeLevel:17, sizePx:114, diopters:-4.00 },
  { label:'-4.25D', sizeLevel:18, sizePx:127, diopters:-4.25 },
  { label:'-4.50D', sizeLevel:19, sizePx:143, diopters:-4.50 },
  { label:'-4.75D', sizeLevel:20, sizePx:160, diopters:-4.75 },
  { label:'-5.00D', sizeLevel:21, sizePx:180, diopters:-5.00 },
];
export const ROTATIONS = [0, 90, 180, 270];

export function useVisionService(socket) {
  const [roomCode,        setRoomCode]        = useState('');
  const [phase,           setPhaseState]      = useState('waiting');
  const [currentOptotype, setCurrentOptotype] = useState(null);
  const idx  = useRef({ right:0, left:0, both:0 });
  const cw   = useRef({ right:0, left:0, both:0 });

  const generateRoom  = useCallback(async () => (await fetch(`${API}/session/new`)).json(), []);
  const getServerInfo = useCallback(async () => (await fetch(`${API}/server-info`)).json(), []);
  const getAllResults  = useCallback(async () => (await fetch(`${API}/results`)).json(), []);
  const deleteResult  = useCallback(id => fetch(`${API}/results/${id}`, { method:'DELETE' }), []);
  const saveResult    = useCallback(r => fetch(`${API}/results`, {
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(r),
  }).then(x => x.json()), []);

  const createSession   = useCallback((code, name) => {
    setRoomCode(code); socket.emit('vr_create_session', { roomCode:code, patientName:name });
  }, [socket]);
  const showInstruction = useCallback(msg => socket.emit('vr_show_instruction', { roomCode, message:msg }), [socket, roomCode]);
  const setPhase        = useCallback(p  => { setPhaseState(p); socket.emit('vr_next_phase', { roomCode, phase:p }); }, [socket, roomCode]);
  const endTest         = useCallback(()  => socket.emit('vr_end_test', { roomCode }), [socket, roomCode]);

  const showOptotype = useCallback((eye, forceLevel) => {
    const level = forceLevel ?? idx.current[eye];
    const a = ACUITY_LEVELS[Math.min(level, ACUITY_LEVELS.length - 1)];
    const rotation = ROTATIONS[Math.floor(Math.random() * 4)];
    const opt = { phase, letter:'E', rotation, sizeLevel:a.sizeLevel, sizePx:a.sizePx, eye, acuityLabel:a.label };
    setCurrentOptotype(opt);
    socket.emit('vr_show_optotype', { roomCode, ...opt });
  }, [socket, roomCode, phase]);

  const recordResponse = useCallback((eye, seen) => {
    if (seen) { cw.current[eye] = 0; idx.current[eye] = Math.max(0, idx.current[eye] - 1); }
    else       { cw.current[eye]++; idx.current[eye] = Math.min(ACUITY_LEVELS.length-1, idx.current[eye]+1); }
    socket.emit('vr_record_response', { roomCode, phase, eye, seen, sizeLevel:idx.current[eye] });
    return ACUITY_LEVELS[idx.current[eye]];
  }, [socket, roomCode, phase]);

  const resetAcuity      = useCallback(eye => { idx.current[eye]=0; cw.current[eye]=0; }, []);
  const getCurrentAcuity = useCallback(eye => ACUITY_LEVELS[idx.current[eye]], []);

  return { roomCode, phase, currentOptotype,
           generateRoom, getServerInfo, saveResult, getAllResults, deleteResult,
           createSession, showInstruction, setPhase, showOptotype,
           recordResponse, resetAcuity, getCurrentAcuity, endTest };
}