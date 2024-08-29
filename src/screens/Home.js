import React, { useState, useEffect, useContext, useRef } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import { Layout, Text } from "react-native-rapi-ui";
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from 'react-native-maps';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, getDocs, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { AuthContext } from '../provider/AuthProvider';
import Icon from 'react-native-vector-icons/FontAwesome';

export default function ({ navigation }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [circleMembers, setCircleMembers] = useState({});
  const [circles, setCircles] = useState([]);
  const [profilePictureURL, setProfilePictureURL] = useState(null);
  const { userData } = useContext(AuthContext);
  const auth = getAuth();
  const db = getFirestore();

  const [isLoading, setIsLoading] = useState(true);

  const locationSubscription = useRef(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Start watching position
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000,
          distanceInterval: 5
        },
        (newLocation) => {
          setLocation(newLocation);
          updateLocationInFirestore(newLocation);
        }
      );
    })();

    // Cleanup function
    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (userData === null) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      fetchProfilePicture();
      fetchUserCircles();
    }
  }, [userData]);

  useEffect(() => {
    if (selectedCircle) {
      fetchCircleMembers();
    }
  }, [selectedCircle]);

  const fetchUserCircles = async () => {
    if (userData?.uid) {
      const userRef = doc(db, "users", userData.uid);
      const unsubscribe = onSnapshot(userRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userCircles = docSnapshot.data().memberCircles || [];
          const circlePromises = userCircles.map(circleId => getDoc(doc(db, "circles", circleId)));
          try {
            const circleSnapshots = await Promise.all(circlePromises);
            const circleData = circleSnapshots.map(snapshot => ({ id: snapshot.id, ...snapshot.data() }));
            setCircles(circleData);
          } catch (error) {
            console.error("Error fetching circle data:", error);
            Alert.alert("Error", "Failed to fetch circle data. Please check your internet connection and try again.");
          }
        }
      }, (error) => {
        console.error("Error in user document snapshot:", error);
        Alert.alert("Error", "Failed to fetch user data. Please check your internet connection and try again.");
      });
      return () => unsubscribe();
    }
  };

  const fetchCircleMembers = async () => {
    if (!selectedCircle) return;
    const circleRef = doc(db, "circles", selectedCircle.id);
    const circleDoc = await getDoc(circleRef);
    if (circleDoc.exists()) {
      const members = circleDoc.data().members;
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "in", members));
      const querySnapshot = await getDocs(q);
      const memberData = {};
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        memberData[doc.id] = {
          uid: doc.id,
          name: userData.name,
          email: userData.email,
          location: userData.location,
          lastTracked: userData.lastTracked,
          profilePictureURL: userData.profilePictureURL
        };
      });
      setCircleMembersData(memberData);
    }
  };

  const updateLocationInFirestore = async (location) => {
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          lastTracked: new Date()
        }, { merge: true });
      } catch (error) {
        console.error("Error updating location in Firestore:", error);
      }
    }
  };

  const fetchProfilePicture = async () => {
    if (userData?.uid) {
      try {
        const userDoc = await getDoc(doc(db, "users", userData.uid));
        if (userDoc.exists()) {
          setProfilePictureURL(userDoc.data().profilePictureURL);
        }
      } catch (error) {
        console.error("Error fetching profile picture:", error);
      }
    }
  };

  const proximityDistance = userData?.proximityDistance || 0.5;
  const handleMarkerPress = (userId) => {
    const member = circleMembersData[userId];
    if (member) {
      const lastTracked = member.lastTracked ? new Date(member.lastTracked.toDate()).toLocaleString() : 'Unknown';
      Alert.alert(
        member.name || member.email,
        `Email: ${member.email}\nLast tracked: ${lastTracked}`,
        [{ text: "OK" }]
      );
    }
  };

  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [circleMembersData, setCircleMembersData] = useState({});

  if (isLoading) {
    return (
      <Layout>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>
            Gathering your CircL...
          </Text>
          <Icon 
            name="users" 
            size={60} 
            color="#007AFF"
            style={styles.loadingIcon}
          />
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="times" size={24} color="#007AFF" />
          </TouchableOpacity>
          {circles.length > 0 ? (
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setIsPickerVisible(!isPickerVisible)}
            >
              <Text style={styles.pickerButtonText}>
                {selectedCircle ? selectedCircle.name : 'Select CircL'}
              </Text>
              <Icon name="chevron-down" size={16} color="#007AFF" />
            </TouchableOpacity>
          ) : (
            <Text>No circles available</Text>
          )}
          {isPickerVisible && (
            <View style={styles.pickerContainer}>
              {circles.map((circle) => (
                <TouchableOpacity
                  key={circle.id}
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedCircle(circle);
                    setIsPickerVisible(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{circle.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {location ? (
          <MapView
            style={styles.map}
            region={{
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            <Marker
              coordinate={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              title="Your Location"
            >
              <Image
                source={{ uri: profilePictureURL }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            </Marker>
            {Object.values(circleMembersData).map((member) => (
              member.location && (
                <Marker
                  key={member.uid}
                  coordinate={{
                    latitude: member.location.latitude,
                    longitude: member.location.longitude,
                  }}
                  title={member.name || member.email}
                  onPress={() => handleMarkerPress(member.uid)}
                >
                  <Image
                    source={{ uri: member.profilePictureURL }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                </Marker>
              )
            ))}
          </MapView>
        ) : (
          <Text>{errorMsg || 'Loading map...'}</Text>
        )}
      </View>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    padding: 10,
    borderRadius: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 2,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  pickerContainer: {
    marginTop: 5,
    backgroundColor: '#fff',
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  pickerItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  pickerItemText: {
    fontSize: 16,
  },
});
