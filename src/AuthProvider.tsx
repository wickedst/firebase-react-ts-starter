import React, { useEffect, useState } from "react";
import firebase from "./firebase";
import "firebase/firestore";

type ContextProps = {
  user: firebase.User | null;
  userProfile: firebase.firestore.DocumentData | null;
  authenticated: boolean;
  setUser: any;
  setUserProfile: any;
  loadingAuthState: boolean;
  toasts: { message: string; variant: string }[];
  addToasts: any;
};

export const AuthContext = React.createContext<Partial<ContextProps>>({});

export const AuthProvider = ({ children }: any) => {
  const [user, setUser] = useState(null as firebase.User | null);
  const [userProfile, setUserProfile] = useState(
    {} as firebase.firestore.DocumentData | null
  );
  const [loadingAuthState, setLoadingAuthState] = useState(true);
  const [toasts, addToasts] = useState<{ message: string; variant: string }[]>(
    []
  );

  useEffect(() => {
    firebase.auth().onAuthStateChanged((user: any) => {
      setUser(user);
      setLoadingAuthState(false);
      console.log(user, "ap user");
      console.log(user !== null, "ap authenticated");

      // Get user profile
      if (user !== null) {
        const db = firebase.firestore();
        db.collection("users")
          .where("uid", "==", firebase.auth().currentUser!.uid)
          .get()
          .then((snapshot) => {
            snapshot.forEach((doc) => {
              const user = doc.data();
              if (user) {
                console.log("Set user profile: ", user);
                setUserProfile(user);
              }
            });
          });
      } else {
        console.log("Emptied user profile");
        setUserProfile(null);
      }
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        authenticated: user !== null,
        userProfile,
        setUserProfile,
        loadingAuthState,
        toasts,
        addToasts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
