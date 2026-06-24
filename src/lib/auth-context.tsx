"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  signInWithPopup,
  GoogleAuthProvider
} from "firebase/auth";
import { auth, isFirebaseConfigured } from "./firebase";

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  signup: async () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email || "",
            displayName: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } else {
      // Mock Auth State from LocalStorage
      const localUser = localStorage.getItem("sb_user");
      if (localUser) {
        setUser(JSON.parse(localUser));
      }
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string) => {
    if (isFirebaseConfigured && auth) {
      await signInWithEmailAndPassword(auth, email, password);
    } else {
      // Mock login: create local session
      const mockUser: UserProfile = {
        uid: `mock_${email.replace(/[^a-zA-Z0-9]/g, "")}`,
        email,
        displayName: email.split("@")[0] || "Guest",
      };
      localStorage.setItem("sb_user", JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const signup = async (email: string, password: string, name: string) => {
    if (isFirebaseConfigured && auth) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      // Wait, let's update profile name if real firebase
      // firebase auth user updateProfile can be done here if needed
      setUser({
        uid: cred.user.uid,
        email: cred.user.email || "",
        displayName: name || email.split("@")[0],
      });
    } else {
      // Mock signup
      const mockUser: UserProfile = {
        uid: `mock_${email.replace(/[^a-zA-Z0-9]/g, "")}`,
        email,
        displayName: name || email.split("@")[0],
      };
      localStorage.setItem("sb_user", JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const loginWithGoogle = async () => {
    if (isFirebaseConfigured && auth) {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } else {
      // Mock Google Login
      const mockUser: UserProfile = {
        uid: "mock_google_user",
        email: "google.operator@secondbrain.ai",
        displayName: "Google Operator",
      };
      localStorage.setItem("sb_user", JSON.stringify(mockUser));
      setUser(mockUser);
    }
  };

  const logout = async () => {
    if (isFirebaseConfigured && auth) {
      await signOut(auth);
    } else {
      localStorage.removeItem("sb_user");
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
