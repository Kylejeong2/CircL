import React, { useContext, useState, useEffect } from "react";
import { View, StyleSheet, FlatList, Alert, TouchableOpacity, Image } from "react-native";
import { Layout, Text, Button, TextInput } from "react-native-rapi-ui";
import { AuthContext } from "../provider/AuthProvider";
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';

export default function Friends({ navigation }) {
  const { userData } = useContext(AuthContext);
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [friendCode, setFriendCode] = useState('');
  const [userFriendCode, setUserFriendCode] = useState('');
  const db = getFirestore();

  useEffect(() => {
    if (userData?.uid) {
      const userRef = doc(db, "users", userData.uid);
      const unsubscribe = onSnapshot(userRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          setFriends(userData.friends || []);
          setFriendRequests(userData.friendRequests || []);
          setUserFriendCode(userData.friendCode || '');
          fetchFriendRequestDetails(userData.friendRequests || []);
          fetchFriendsDetails(userData.friends || []);
        }
      });
      return () => unsubscribe();
    }
  }, [userData]);

  const fetchFriendRequestDetails = async (requestIds) => {
    const detailedRequests = await Promise.all(requestIds.map(async (id, index) => {
      const userDoc = await getDoc(doc(db, "users", id));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: id || `request_${Date.now()}_${index}`,
          name: userData.name || "Unknown User",
          profilePicture: userData.profilePictureURL || "https://via.placeholder.com/50"
        }
      }
      return null;
    }));
    setFriendRequests(detailedRequests.filter(request => request !== null));
  };

  const fetchFriendsDetails = async (friendIds) => {
    const detailedFriends = await Promise.all(friendIds.map(async (id, index) => {
      const userDoc = await getDoc(doc(db, "users", id));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          id: id || `friend_${Date.now()}_${index}`,
          name: userData.name || "Unknown User",
          profilePicture: userData.profilePictureURL || "https://via.placeholder.com/50"
        }
      }
      return null;
    }));
    setFriends(detailedFriends.filter(friend => friend !== null));
  };

  const generateFriendCode = async () => {
    const timestamp = Date.now().toString();
    const randomBytes = await Crypto.getRandomBytesAsync(4);
    const hexString = Array.from(randomBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const newFriendCode = (timestamp + hexString).slice(-8).toUpperCase();
    
    try {
      const userRef = doc(db, "users", userData.uid);
      await updateDoc(userRef, {
        friendCode: newFriendCode,
        codeGeneratedAt: new Date().toISOString()
      });
      setUserFriendCode(newFriendCode);
      Alert.alert('Code Generated', `Your unique friend code is: ${newFriendCode}`);
    } catch (error) {
      console.error('Friend code generation failed:', error);
      Alert.alert('Generation Failed', 'Unable to create a friend code. Please try again.');
    }
  };

  const copyFriendCode = () => {
    Clipboard.setString(userFriendCode);
    Alert.alert('Copied', 'Friend code copied to clipboard');
  };

  const sendFriendRequest = async () => {
    if (friendCode.trim() === '') {
      Alert.alert('Error', 'Please enter a friend code');
      return;
    }
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("friendCode", "==", friendCode));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        Alert.alert('Error', 'User not found');
        return;
      }
      const friendDoc = querySnapshot.docs[0];
      await updateDoc(doc(db, "users", friendDoc.id), {
        friendRequests: arrayUnion(userData.uid)
      });
      setFriendCode('');
      Alert.alert('Success', 'Friend request sent');
    } catch (error) {
      Alert.alert('Error', error.message);
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
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const denyFriendRequest = async (friendId) => {
    try {
      await updateDoc(doc(db, "users", userData.uid), {
        friendRequests: arrayRemove(friendId)
      });
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const renderFriendItem = ({ item }) => (
    <View style={styles.friendItem}>
      <Image source={{ uri: item.profilePicture }} style={styles.profilePicture} />
      <Text style={styles.name}>{item.name}</Text>
    </View>
  );

  const renderFriendRequestItem = ({ item }) => (
    <View style={styles.friendRequestItem}>
      <Image source={{ uri: item.profilePicture }} style={styles.profilePicture} />
      <Text style={styles.name}>{item.name}</Text>
      <View style={styles.friendRequestActions}>
        <TouchableOpacity onPress={() => acceptFriendRequest(item.id)} style={styles.acceptButton}>
          <Ionicons name="checkmark-circle" size={24} color="green" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => denyFriendRequest(item.id)} style={styles.denyButton}>
          <Ionicons name="close-circle" size={24} color="red" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <Layout>
      <View style={styles.container}>
        <Text style={styles.title}>Friends</Text>
        
        {userFriendCode ? (
          <View style={styles.friendCodeContainer}>
            <Text style={styles.friendCodeLabel}>Your Friend Code:</Text>
            <View style={styles.friendCodeRow}>
              <Text style={styles.friendCodeText}>{userFriendCode}</Text>
              <TouchableOpacity onPress={copyFriendCode} style={styles.copyButton}>
                <Ionicons name="copy-outline" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Button
            text="Generate Friend Code"
            onPress={generateFriendCode}
            style={styles.button}
          />
        )}

        <TextInput
          placeholder="Enter Friend Code"
          value={friendCode}
          onChangeText={(text) => setFriendCode(text.toUpperCase())}
          style={styles.input}
          autoCapitalize="characters"
        />
        <Button
          text="Send Friend Request"
          onPress={sendFriendRequest}
          style={styles.button}
        />

        <Text style={styles.sectionTitle}>Friend Requests</Text>
        <FlatList
          data={friendRequests}
          renderItem={renderFriendRequestItem}
          keyExtractor={(item, index) => item.id?.toString() || `request_${index}`}
          style={styles.list}
        />

        <Text style={styles.sectionTitle}>Your Friends</Text>
        <View style={styles.list}>
          {friends.map((item, index) => (
            <View key={item.id?.toString() || `friend_${index}`}>
              {renderFriendItem({ item })}
            </View>
          ))}
        </View>
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
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    marginBottom: 10,
  },
  button: {
    marginBottom: 20,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  list: {
    maxHeight: 200,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  friendRequestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  friendRequestActions: {
    flexDirection: 'row',
  },
  acceptButton: {
    marginRight: 10,
  },
  denyButton: {
    marginLeft: 10,
  },
  friendCodeContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  friendCodeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  friendCodeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  friendCodeText: {
    fontSize: 20,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  copyButton: {
    padding: 5,
  },
  profilePicture: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  name: {
    flex: 1,
    fontSize: 16,
  },
});