import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [cards, setCards] = useState(null);
  const [imports, setImports] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [toasts, setToasts] = useState([]);
  const tid = useRef(0);

  const toast = useCallback((message, tone = 'info') => {
    const id = ++tid.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 3800);
  }, []);

  const reloadCards = useCallback(async () => {
    try {
      setCards(await api.cards());
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  const reloadImports = useCallback(async () => {
    try {
      setImports(await api.imports());
      setLoadError('');
    } catch (e) {
      setLoadError(e.message);
    }
  }, []);

  useEffect(() => {
    reloadCards();
    reloadImports();
  }, [reloadCards, reloadImports]);

  const value = useMemo(
    () => ({ cards, setCards, reloadCards, imports, setImports, reloadImports, toast, toasts, loadError }),
    [cards, reloadCards, imports, reloadImports, toast, toasts, loadError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
