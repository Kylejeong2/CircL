import React, { useContext, useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity, Alert, Modal, FlatList, Dimensions } from "react-native";
import { Layout, Text, Section, SectionContent, Button, TextInput } from "react-native-rapi-ui";
import { AuthContext } from "../provider/AuthProvider";
import { getFirestore, doc, updateDoc, arrayUnion, onSnapshot, collection, getDoc, setDoc, getDocs, query, where, arrayRemove, deleteDoc } from "firebase/firestore";
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Ionicons } from '@expo/vector-icons';

const { height, width } = Dimensions.get('window');

export default function CircleManagement({ navigation }) {
  const { userData } = useContext(AuthContext);
  const [ownedCircles, setOwnedCircles] = useState([]);
  const [memberCircles, setMemberCircles] = useState([]);
  const [newCircleName, setNewCircleName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const db = getFirestore();

  useEffect(() => {
    if (userData?.uid) {
      fetchCircles();
    }
  }, [userData]);

  const fetchCircles = async () => {
    const userRef = doc(db, "users", userData.uid);
    const unsubscribe = onSnapshot(userRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const userData = docSnapshot.data();
        const ownedCircleIds = userData.ownedCircles || [];
        const memberCircleIds = userData.memberCircles || [];

        const ownedCirclesData = await Promise.all(
          ownedCircleIds.map(id => getDoc(doc(db, "circles", id)))
        );
        setOwnedCircles(ownedCirclesData.map(doc => ({ id: doc.id, ...doc.data() })));

        const memberCirclesData = await Promise.all(
          memberCircleIds.map(id => getDoc(doc(db, "circles", id)))
        );
        setMemberCircles(memberCirclesData.map(doc => ({ id: doc.id, ...doc.data() })));
      }
    });
    return unsubscribe;
  };

  const createCircle = async () => {
    if (newCircleName.trim() === '') return;
    const circleId = uuidv4();
    const circleRef = doc(db, "circles", circleId);
    await setDoc(circleRef, {
      name: newCircleName,
      owner: userData.uid,
      members: [userData.uid],
      inviteCode: null,
      inviteCodeExpiry: null
    });
    const userRef = doc(db, "users", userData.uid);
    await updateDoc(userRef, {
      ownedCircles: arrayUnion(circleId),
      memberCircles: arrayUnion(circleId)
    });
    setNewCircleName('');
    setIsCreateModalVisible(false);
  };

  const joinCircle = async () => {
    if (joinCode.trim() === '') return;
    const circlesRef = collection(db, "circles");
    const querySnapshot = await getDocs(query(circlesRef, where("inviteCode", "==", joinCode)));
    if (querySnapshot.empty) {
      Alert.alert("Error", "Invalid or expired invite code");
      return;
    }
    const circleDoc = querySnapshot.docs[0];
    const circleData = circleDoc.data();
    if (new Date() > circleData.inviteCodeExpiry.toDate()) {
      Alert.alert("Error", "Invite code has expired");
      return;
    }
    await updateDoc(doc(db, "circles", circleDoc.id), {
      members: arrayUnion(userData.uid),
      inviteCode: null,
      inviteCodeExpiry: null
    });
    await updateDoc(doc(db, "users", userData.uid), {
      memberCircles: arrayUnion(circleDoc.id)
    });
    setJoinCode('');
    setIsJoinModalVisible(false);
    Alert.alert("Success", "You have joined the CircL");
  };

  const leaveCircle = async (circleId) => {
    try {
      const circleRef = doc(db, "circles", circleId);
      const userRef = doc(db, "users", userData.uid);

      await updateDoc(circleRef, {
        members: arrayRemove(userData.uid)
      });

      await updateDoc(userRef, {
        memberCircles: arrayRemove(circleId)
      });

      setMemberCircles(memberCircles.filter(circle => circle.id !== circleId));
      Alert.alert("Success", "You have left the CircL");
    } catch (error) {
      console.error("Error leaving CircL:", error);
      Alert.alert("Error", "Failed to leave the CircL");
    }
  };

  const deleteCircle = async (circleId) => {
    try {
      const circleRef = doc(db, "circles", circleId);
      const userRef = doc(db, "users", userData.uid);

      const circleDoc = await getDoc(circleRef);
      const circleData = circleDoc.data();
      const memberUpdates = circleData.members.map(memberId => 
        updateDoc(doc(db, "users", memberId), {
          memberCircles: arrayRemove(circleId)
        })
      );
      await Promise.all(memberUpdates);

      await deleteDoc(circleRef);

      await updateDoc(userRef, {
        ownedCircles: arrayRemove(circleId)
      });

      setOwnedCircles(ownedCircles.filter(circle => circle.id !== circleId));
      Alert.alert("Success", "CircL has been deleted");
    } catch (error) {
      console.error("Error deleting CircL:", error);
      Alert.alert("Error", "Failed to delete the CircL");
    }
  };

  const renderCircleItem = ({ item, isOwned }) => (
    <TouchableOpacity 
      style={styles.circleItem}
      onPress={() => navigation.navigate('CircleDetails', { circleId: item.id })}
    >
      <Text style={styles.circleName}>{item.name}</Text>
      <View style={styles.circleActions}>
        {isOwned ? (
          <TouchableOpacity onPress={() => deleteCircle(item.id)}>
            <Ionicons name="trash-outline" size={24} color="red" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => leaveCircle(item.id)}>
            <Ionicons name="exit-outline" size={24} color="orange" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <Layout>
      <View style={styles.container}>
        <Text style={styles.title}>CircL Management</Text>
        
        <View style={styles.buttonContainer}>
          <Button 
            text="Create CircL" 
            onPress={() => setIsCreateModalVisible(true)} 
            style={styles.button}
          />
          <Button 
            text="Join CircL" 
            onPress={() => setIsJoinModalVisible(true)} 
            style={styles.button}
          />
        </View>

        <View style={styles.circlesContainer}>
          <Section style={styles.section}>
            <Text style={styles.sectionTitle}>Owned CircLs</Text>
            <FlatList
              data={ownedCircles}
              renderItem={({ item }) => renderCircleItem({ item, isOwned: true })}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>You don't own any CircLs yet.</Text>}
            />
          </Section>

          <Section style={styles.section}>
            <Text style={styles.sectionTitle}>CircLs You're In</Text>
            <FlatList
              data={memberCircles}
              renderItem={({ item }) => renderCircleItem({ item, isOwned: false })}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.emptyText}>You're not a member of any CircLs yet.</Text>}
            />
          </Section>
        </View>

        <Modal
          visible={isCreateModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsCreateModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Create New CircL</Text>
              <TextInput
                placeholder="CircL Name"
                value={newCircleName}
                onChangeText={setNewCircleName}
                style={styles.input}
              />
              <View style={styles.modalButtonContainer}>
                <Button text="Create" onPress={createCircle} style={styles.modalButton} />
                <Button text="Cancel" status="danger" onPress={() => setIsCreateModalVisible(false)} style={styles.modalButton} />
              </View>
            </View>
          </View>
        </Modal>

        <Modal
          visible={isJoinModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsJoinModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalView}>
              <Text style={styles.modalTitle}>Join a CircL</Text>
              <TextInput
                placeholder="Enter Invite Code"
                value={joinCode}
                onChangeText={setJoinCode}
                style={styles.input}
              />
              <View style={styles.modalButtonContainer}>
                <Button text="Join" onPress={joinCircle} style={styles.modalButton} />
                <Button text="Cancel" status="danger" onPress={() => setIsJoinModalVisible(false)} style={styles.modalButton} />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  button: {
    flex: 1,
    marginHorizontal: 5,
  },
  circlesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  section: {
    flex: 1,
    marginHorizontal: 5,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  circleItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f0f0f0',
    borderRadius: 10,
    marginBottom: 10,
  },
  circleName: {
    fontSize: 18,
  },
  circleActions: {
    flexDirection: 'row',
  },
  emptyText: {
    textAlign: 'center',
    fontStyle: 'italic',
    color: '#888',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    width: width * 0.9,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 5,
  },
});
