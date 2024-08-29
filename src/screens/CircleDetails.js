import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Layout, Text, Button } from 'react-native-rapi-ui';
import { getFirestore, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { AuthContext } from '../provider/AuthProvider';

export default function CircleDetails({ route, navigation }) {
  const { circleId } = route.params;
  const { userData } = useContext(AuthContext);
  const [circle, setCircle] = useState(null);
  const [members, setMembers] = useState([]);
  const db = getFirestore();

  useEffect(() => {
    fetchCircleDetails();
  }, []);

  const fetchCircleDetails = async () => {
    const circleDoc = await getDoc(doc(db, 'circles', circleId));
    if (circleDoc.exists()) {
      setCircle({ id: circleDoc.id, ...circleDoc.data() });
      fetchMemberDetails(circleDoc.data().members);
    }
  };

  const fetchMemberDetails = async (memberIds) => {
    const memberPromises = memberIds.map(id => getDoc(doc(db, 'users', id)));
    const memberDocs = await Promise.all(memberPromises);
    setMembers(memberDocs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const leaveCircle = async () => {
    await updateDoc(doc(db, 'circles', circleId), {
      members: arrayRemove(userData.uid)
    });
    await updateDoc(doc(db, 'users', userData.uid), {
      memberCircles: arrayRemove(circleId)
    });
    navigation.goBack();
  };

  const renderMemberItem = ({ item }) => (
    <View style={styles.memberItem}>
      <Text>{item.name || item.email}</Text>
    </View>
  );

  if (!circle) {
    return (
      <Layout>
        <Text>Loading...</Text>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        <Text style={styles.title}>{circle.name}</Text>
        <Text style={styles.subtitle}>Members:</Text>
        <FlatList
          data={members}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
        />
        {circle.owner !== userData.uid && (
          <Button text="Leave CircL" onPress={leaveCircle} status="danger" style={styles.button} />
        )}
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
  subtitle: {
    fontSize: 18,
    marginBottom: 10,
  },
  memberItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  button: {
    marginTop: 20,
  },
});