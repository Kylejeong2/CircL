import React, { useContext, useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Alert } from "react-native";
import { Layout, Text, Button, TextInput } from "react-native-rapi-ui";
import { AuthContext } from "../provider/AuthProvider";
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, getDoc, setDoc } from "firebase/firestore";

export default function ({ navigation }) {
  const { userData, setUserData } = useContext(AuthContext);
  const [friendRequests, setFriendRequests] = useState([]);
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const db = getFirestore();

  useEffect(() => {
    if (userData?.uid) {
      const userRef = doc(db, "users", userData.uid);
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          setFriendRequests(doc.data().friendRequests || []);
        }
      });
      return () => unsubscribe();
    }
  }, [userData]);

  const sendFriendRequest = async () => {
    if (newFriendEmail.trim() === '') return;
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("email", "==", newFriendEmail));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        Alert.alert("Error", "User not found");
        return;
      }
      const friendDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "users", friendDoc.id), {
        friendRequests: arrayUnion(userData.uid)
      });
      setNewFriendEmail('');
      Alert.alert("Success", "Friend request sent");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  const acceptFriendRequest = async (friendId) => {
    try {
      await updateDoc(doc(db, "users", userData.uid), {
        friends: arrayUnion(friendId),
        friendRequests: arrayRemove(friendId)
      });
      await updateDoc(doc(db, "users", friendId), {
        friends: arrayUnion(userData.uid)
      });
      Alert.alert("Success", "Friend request accepted");
    } catch (error) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <Layout>
      <View style={styles.container}>
        <Text style={styles.title}>Friend Requests</Text>
        <TextInput
          placeholder="Friend's Email"
          value={newFriendEmail}
          onChangeText={setNewFriendEmail}
          style={styles.input}
        />
        <Button text="Send Friend Request" onPress={sendFriendRequest} style={styles.button} />
        <FlatList
          data={friendRequests}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <View style={styles.requestItem}>
              <Text>{item}</Text>
              <Button text="Accept" onPress={() => acceptFriendRequest(item)} />
            </View>
          )}
        />
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
  },
});