import React, { useState, useEffect, useContext } from 'react';
import { View, StyleSheet, FlatList, Alert, Dimensions, TouchableOpacity } from 'react-native';
import { Layout, Text, Button } from 'react-native-rapi-ui';
import { getFirestore, doc, getDoc, updateDoc, arrayRemove, onSnapshot } from 'firebase/firestore';
import { AuthContext } from '../provider/AuthProvider';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function CircleDetails({ route, navigation }) {
  const { circleId } = route.params;
  const { userData } = useContext(AuthContext);
  const [circle, setCircle] = useState(null);
  const [members, setMembers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const db = getFirestore();

  useEffect(() => {
    const fetchCircleDetails = async () => {
      const circleRef = doc(db, "circles", circleId);
      const info = onSnapshot(circleRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const circleData = docSnapshot.data();
          setCircle(circleData);
          const memberPromises = circleData.members.map(memberId => 
            getDoc(doc(db, "users", memberId))
          );
          const memberDocs = await Promise.all(memberPromises);
          const memberData = memberDocs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setMembers(memberData);
        }
      });

      return info;
    };

    fetchCircleDetails();
  }, [circleId]);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to show your position on the map.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation(location);
    })();
  }, []);

  const removeMember = async (memberId) => {
    try {
      await updateDoc(doc(db, "circles", circleId), {
        members: arrayRemove(memberId)
      });
      await updateDoc(doc(db, "users", memberId), {
        memberCircles: arrayRemove(circleId)
      });
      Alert.alert("Success", "Member removed from the CircL");
    } catch (error) {
      console.error("Error removing member:", error);
      Alert.alert("Error", "Failed to remove member from the CircL");
    }
  };

  const leaveCircle = async () => {
    if (circle.owner === userData.uid) {
      Alert.alert("Error", "You cannot leave a CircL that you own.");
      return;
    }

    try {
      await updateDoc(doc(db, "circles", circleId), {
        members: arrayRemove(userData.uid)
      });
      await updateDoc(doc(db, "users", userData.uid), {
        memberCircles: arrayRemove(circleId)
      });
      Alert.alert("Success", "You have left the CircL");
      navigation.goBack();
    } catch (error) {
      console.error("Error leaving CircL:", error);
      Alert.alert("Error", "Failed to leave the CircL");
    }
  };

  const renderMemberItem = ({ item }) => (
    <View style={styles.memberItem}>
      <Text>{item.name || item.email}</Text>
      {circle.owner === userData.uid && item.id !== userData.uid && (
        <Button
          text="Remove"
          status="danger"
          onPress={() => removeMember(item.id)}
          style={styles.removeButton}
        />
      )}
    </View>
  );

  if (!circle) {
    return (
      <Layout>
        <View style={styles.container}>
          <Text>Loading circle details...</Text>
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.title}>{circle.name}</Text>
          {circle.owner !== userData.uid && (
            <Button
              text="Leave CircL"
              status="danger"
              onPress={leaveCircle}
              style={styles.leaveButton}
            />
          )}
        </View>
        {/* <MapView
          style={styles.map}
          region={{
            latitude: userLocation?.coords.latitude || 0,
            longitude: userLocation?.coords.longitude || 0,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {members.map((member) => (
            member.location && (
              <Marker
                key={member.id}
                coordinate={{
                  latitude: member.location.latitude,
                  longitude: member.location.longitude,
                }}
                title={member.name || member.email}
              />
            )
          ))}
        </MapView> */}
        <Text style={styles.sectionTitle}>Members</Text>
        <FlatList
          data={members}
          renderItem={renderMemberItem}
          keyExtractor={(item) => item.id}
          style={styles.memberList}
        />
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButton: {
    padding: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'left',
  },
  leaveButton: {
    backgroundColor: 'red',
    width: 120,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  removeButton: {
    width: 100,
  },
  memberList: {
    maxHeight: 200,
  },
  map: {
    width: width - 40,
    height: height / 3,
    marginBottom: 20,
  },
});