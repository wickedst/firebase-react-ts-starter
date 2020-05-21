import React, { useEffect, useState } from "react";
import firebase from "./firebase";
import "firebase/firestore";

type ContextProps = {
  user: firebase.User | null;
  setUser: any;
  authenticated: boolean;
  userProfile: firebase.firestore.DocumentData | null;
  setUserProfile: any;
  userPrivate: firebase.firestore.DocumentData | null;
  notifications: firebase.firestore.DocumentData[];
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
  const [userPrivate, setUserPrivate] = useState(
    {} as firebase.firestore.DocumentData | null
  );
  const [notifications, setNotifications] = useState<
    firebase.firestore.DocumentData[]
  >([]);
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
        const uid = firebase.auth().currentUser!.uid;
        // prettier-ignore
        db.collection("users").doc(uid).get()
          .then((res) => {
            const user = res.data();
            user ? setUserProfile(user) : setUserProfile(null)
          })
          .then(() => {
            // notifications listener
            db.collection("notifications")
              .where("to", "==", uid)
              .onSnapshot(function (querySnapshot) {
                let notifications: firebase.firestore.DocumentData[] = [];
                querySnapshot.forEach(function (doc) {
                  notifications.push(doc.data());
                });
                setNotifications(notifications);
            });
          })
          .catch((error) => {
            console.log(error);
            setUserProfile(null);
          });
        // prettier-ignore
        db.collection("usersPrivate").doc(firebase.auth().currentUser!.uid).get().then((res) => {
            const user = res.data();
            user ? setUserPrivate(user) : setUserPrivate(null)
          })
          .catch((error) => {
            console.log(error);
            setUserProfile(null);
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
        userPrivate,
        setUserProfile,
        loadingAuthState,
        notifications,
        toasts,
        addToasts,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
