import React, { useState, useEffect, useContext, useRef } from "react";
import { View, StyleSheet, Image, TouchableOpacity, Alert, ActivityIndicator, Dimensions } from "react-native";
import { Layout, Text } from "react-native-rapi-ui";
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from 'react-native-maps';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where, getDocs, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { AuthContext } from '../provider/AuthProvider';
import Icon from 'react-native-vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';

const { width, height } = Dimensions.get('window');

export default function ({ navigation }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [selectedCircleData, setSelectedCircleData] = useState(null);
  const [profilePictureURL, setProfilePictureURL] = useState(null);
  const { userData } = useContext(AuthContext);
  const auth = getAuth();
  const db = getFirestore();

  const [isLoading, setIsLoading] = useState(true);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [circles, setCircles] = useState([]);

  const locationSubscription = useRef(null);

  const [proximityAlerts, setProximityAlerts] = useState({
    enabled: false,
    distance: 0.5,
  });

  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);

  // Getting Location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

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

    return () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
      }
    };
  }, []);

  // Loading the user's data
  useEffect(() => {
    if (userData === null) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      fetchProfilePicture();
      fetchUserCircles();
    }
  }, [userData]);

  // Fetching the circle members
  useEffect(() => {
    if (selectedCircle) {
      fetchCircleMembers();
    }
  }, [selectedCircle]);

  // Setting up the notification handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Notifications are required for proximity alerts.');
      }
    })();
  }, []);

  // Fetching the user's data
  useEffect(() => {
    if (userData?.uid) {
      const userRef = doc(db, "users", userData.uid);
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          const data = doc.data();
          setProximityAlerts({
            enabled: data.proximityAlertsEnabled ?? true,
            distance: data.proximityDistance || 0.5,
          });
          setIsNotificationsEnabled(data.isNotificationsEnabled ?? true);
          setProfilePictureURL(data.profilePictureURL);
        }
      });
      return () => unsubscribe();
    }
  }, [userData]);

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
    const unsubscribe = onSnapshot(circleRef, async (docSnapshot) => {
      if (docSnapshot.exists()) {
        const circleData = docSnapshot.data();
        const memberPromises = circleData.members.map(memberId => 
          getDoc(doc(db, "users", memberId))
        );
        try {
          const memberDocs = await Promise.all(memberPromises);
          const memberData = memberDocs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(memberData);
          setSelectedCircleData(memberData);
          checkProximity(memberData);
        } catch (error) {
          console.error("Error fetching member data:", error);
          Alert.alert("Error", "Failed to fetch member data. Please try again.");
        }
      } else {
        console.error("Circle data not found for selected circle:", selectedCircle);
        Alert.alert(
          "Error",
          "Circle data not found. Please try again or contact support if the issue persists.",
          [{ text: "OK" }]
        );
      }
    });

    return unsubscribe;
  };

  const checkProximity = (members) => {
    if (!proximityAlerts.enabled || !location || !isNotificationsEnabled) return;

    Object.values(members).forEach((member) => {
      if (member.uid !== userData.uid && member.location) {
        const distance = calculateDistance(
          location.coords.latitude,
          location.coords.longitude,
          member.location.latitude,
          member.location.longitude
        );

        if (distance <= proximityAlerts.distance) {
          sendProximityAlert(member);
        }
      }
    });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    return distance;
  };

  const sendProximityAlert = async (member) => {
    const mutualCircles = await getMutualCircles(member.uid);
    const circleNames = mutualCircles.map(circle => circle.name).join(', ');

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Friend Nearby!",
        body: `${member.name} is within ${proximityAlerts.distance} miles of you! You're both in: ${circleNames}`,
      },
      trigger: null,
    });
  };

  const getMutualCircles = async (memberUid) => {
    const userCircles = await getUserCircles(userData.uid);
    const memberCircles = await getUserCircles(memberUid);
    return userCircles.filter(circle => memberCircles.some(memberCircle => memberCircle.id === circle.id));
  };

  const getUserCircles = async (uid) => {
    const userRef = doc(db, "users", uid);
    const userDoc = await getDoc(userRef);
    const circleIds = userDoc.data().memberCircles || [];
    const circles = await Promise.all(circleIds.map(id => getDoc(doc(db, "circles", id))));
    return circles.map(doc => ({ id: doc.id, ...doc.data() }));
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

  const handleMarkerPress = (userId) => {
    const member = selectedCircleData[userId];
    if (member) {
      const lastTracked = member.lastTracked ? new Date(member.lastTracked.toDate()).toLocaleString() : 'Unknown';
      Alert.alert(
        member.name || member.email,
        `Email: ${member.email}\nLast tracked: ${lastTracked}`,
        [{ text: "OK" }]
      );
    }
  };

  const handleCircleSelect = (circle) => {
    setSelectedCircle(circle);
  };

  if (isLoading) {
    return (
      <Layout>
        <LinearGradient
          colors={['#4c669f', '#3b5998', '#192f6a']}
          style={styles.loadingContainer}
        >
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.loadingText}>
              Gathering your CircL...
            </Text>
            <Icon 
              name="users" 
              size={80} 
              color="#ffffff"
              style={styles.loadingIcon}
            />
          </View>
        </LinearGradient>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        <View style={styles.overlay}>
          {circles.length > 0 ? (
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setIsPickerVisible(!isPickerVisible)}
            >
              <Text style={styles.dropdownButtonText}>
                {selectedCircle ? selectedCircle.name : "Select a CircL"}
              </Text>
              <Icon name="chevron-down" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
          {isPickerVisible && (
            <View style={styles.pickerContainer}>
              {circles.map((circle) => (
                <TouchableOpacity
                  key={circle.id}
                  style={styles.pickerItem}
                  onPress={() => {
                    handleCircleSelect(circle);
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
              latitude: location?.coords.latitude || 0,
              longitude: location?.coords.longitude || 0,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {location && (
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
            )}
             {selectedCircle && selectedCircleData && selectedCircleData.map((member) => (
                member.id !== userData.uid && member.location && (
                  <Marker
                    key={member.id}
                    coordinate={{
                      latitude: member.location.latitude,
                      longitude: member.location.longitude,
                    }}
                    title={member.name || member.email}
                  >
                    <Image
                      source={{ uri: member.profilePictureURL || profilePictureURL }}
                      style={{ width: 40, height: 40, borderRadius: 20 }}
                    />
                    </Marker>
                )
              ))}
            {proximityAlerts.enabled && location && (
              <Circle
                center={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                radius={proximityAlerts.distance * 1609.34}
                fillColor="rgba(0, 150, 255, 0.2)"
                strokeColor="rgba(0, 150, 255, 0.5)"
              />
            )}
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
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
  },
  dropdownButtonText: {
    fontSize: 16,
    color: '#fff',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: width,
    height: height,
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginVertical: 20,
    textAlign: 'center',
  },
  loadingIcon: {
    marginTop: 20,
  },
});