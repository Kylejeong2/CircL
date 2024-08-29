import React, { createContext, useState, useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const AuthContext = createContext();
const AuthProvider = (props) => {
  const auth = getAuth();
  const db = getFirestore();
  // user null = loading
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    checkLogin();
  }, []);

  function checkLogin() {
    onAuthStateChanged(auth, (u) => {
      if (u) {
        setUser(true);
        getUserData(u.uid);
      } else {
        setUser(false);
        setUserData(null);
      }
    });
  }

  async function getUserData(uid) {
    try {
      const userDocRef = doc(db, "users", uid);
      const userDocSnap = await getDoc(userDocRef);
      
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setUserData({
          ...data,
          uid,
          proximityDistance: data.proximityDistance || 0.5,
          profilePictureURL: data.profilePictureURL,
          friends: data.friends || [],
        });
      } else {
        console.log("No user data found!");
        setUserData(null);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        setUserData,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export { AuthContext, AuthProvider };
