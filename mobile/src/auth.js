// Login state for the whole app: the web App.jsx's isAuth/loading, plus the
// username it kept in localStorage (AsyncStorage here).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import client, { setSessionExpiredHandler } from './api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuth, setIsAuth] = useState(false);
  const [checking, setChecking] = useState(true); // asking /api/me on launch
  const [username, setUsername] = useState(null);
  const [expired, setExpired] = useState(false); // tells the login screen why it's showing
  const isAuthRef = useRef(false); // read by the session-expired handler below

  useEffect(() => {
    isAuthRef.current = isAuth;
  }, [isAuth]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      // Only a session that was live can expire; a first launch just isn't logged in
      if (isAuthRef.current) setExpired(true);
      setIsAuth(false);
    });

    (async () => {
      setUsername(await AsyncStorage.getItem('username'));
      try {
        await client.get('/api/me');
        setIsAuth(true);
      } catch {
        setIsAuth(false);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const signIn = async (name) => {
    await AsyncStorage.setItem('username', name);
    setUsername(name);
    setExpired(false);
    setIsAuth(true);
  };

  const signOut = async () => {
    try {
      await client.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      await AsyncStorage.removeItem('username');
      setUsername(null);
      setIsAuth(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuth, checking, username, expired, clearExpired: () => setExpired(false), signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
