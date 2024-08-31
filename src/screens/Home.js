import React, { useState, useEffect, useContext, useRef } from "react";
import { View, StyleSheet, Image, Alert, ActivityIndicator, Dimensions, TouchableOpacity, PermissionsAndroid } from "react-native";
import { Layout, Text } from "react-native-rapi-ui";
import MapView, { Marker, Circle, Callout } from 'react-native-maps';
import { getFirestore, doc, setDoc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { AuthContext } from '../provider/AuthProvider';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import Icon from 'react-native-vector-icons/FontAwesome';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const { width, height } = Dimensions.get('window');

const LOCATION_TASK_NAME = 'background-location-task';

TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error(error);
    return;
  }
  if (data) {
    const { locations } = data;
    const location = locations[0];
    if (location) {
      try {
        const { latitude, longitude } = location.coords;
        const user = getAuth().currentUser;
        if (user) {
          await setDoc(doc(getFirestore(), "users", user.uid), {
            location: { latitude, longitude },
            lastTracked: new Date()
          }, { merge: true });
        }
      } catch (err) {
        console.error("Error updating location in background:", err);
      }
    }
  }
});

export default function ({ navigation }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [friendsData, setFriendsData] = useState([]);
  const [profilePictureURL, setProfilePictureURL] = useState(null);
  const { userData } = useContext(AuthContext);
  const auth = getAuth();
  const db = getFirestore();

  const [isLoading, setIsLoading] = useState(true);

  const mapRef = useRef(null);

  const [proximityAlerts, setProximityAlerts] = useState({
    enabled: false,
    distance: 0.5,
  });

  const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
  const [notifiedFriends, setNotifiedFriends] = useState(new Set());

  useEffect(() => {
    requestLocationPermission();
    return () => {
      Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    };
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus === 'granted') {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus === 'granted') {
          await startBackgroundTracking();
        } else {
          console.log('Background location permission denied');
        }
      } else {
        console.log('Foreground location permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const startBackgroundTracking = async () => {
    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 60000,
      distanceInterval: 0,
      foregroundService: {
        notificationTitle: "Location Tracking",
        notificationBody: "Tracking your location in the background",
      },
    });

    // Register background fetch task
    await BackgroundFetch.registerTaskAsync(LOCATION_TASK_NAME, {
      minimumInterval: 60, // 60 seconds
      stopOnTerminate: false,
      startOnBoot: true,
    });
  };

  // Loading and fetching the user's data
  useEffect(() => {
    if (userData === null) {
      setIsLoading(true);
    } else {
      setIsLoading(false);
      fetchProfilePicture();
      fetchFriendsData();

      if (userData.uid) {
        const userRef = doc(db, "users", userData.uid);
        const unsubscribe = onSnapshot(userRef, (doc) => {
          if (doc.exists()) {
            const data = doc.data();
            setProximityAlerts({
              enabled: data.proximityAlertsEnabled ?? false,
              distance: data.proximityDistance || 0.5,
            });
            setIsNotificationsEnabled(data.isNotificationsEnabled ?? true);
            setProfilePictureURL(data.profilePictureURL);
            setLocation(data.location);
          }
        });
        return () => unsubscribe();
      }
    }
  }, [userData]);

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
        setProximityAlerts(prev => ({ ...prev, enabled: false }));
      }
    })();
  }, []);

  const fetchFriendsData = async () => {
    if (userData?.uid) {
      const userRef = doc(db, "users", userData.uid);
      const unsubscribe = onSnapshot(userRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const friendIds = userData.friends || [];
          const friendPromises = friendIds.map(id => getDoc(doc(db, "users", id)));
          try {
            const friendDocs = await Promise.all(friendPromises);
            const friendData = friendDocs.map(doc => ({ id: doc.id, ...doc.data() }));
            setFriendsData(friendData);
            checkProximity(friendData);
          } catch (error) {
            console.error("Error fetching friend data:", error);
            Alert.alert("Error", "Failed to fetch friend data. Please check your internet connection and try again.");
          }
        }
      });
      return () => unsubscribe();
    }
  };

  const checkProximity = (friends) => {
    if (!proximityAlerts.enabled || !location || !isNotificationsEnabled) return;

    friends.forEach((friend) => {
      if (friend.location) {
        const distance = calculateDistance(
          location.latitude,
          location.longitude,
          friend.location.latitude,
          friend.location.longitude
        );

        console.log(`Distance to ${friend.name || friend.email}: ${distance} km`);
        console.log(`Proximity alert distance: ${proximityAlerts.distance} miles`);

        if (distance <= proximityAlerts.distance * 1.60934 && !notifiedFriends.has(friend.id)) {
          console.log(`Sending proximity alert for ${friend.name || friend.email}`);
          sendProximityAlert(friend);
          setNotifiedFriends(prev => new Set(prev).add(friend.id));
        } else if (distance > proximityAlerts.distance * 1.60934 && notifiedFriends.has(friend.id)) {
          console.log(`Removing ${friend.name || friend.email} from notified friends`);
          setNotifiedFriends(prev => {
            const newSet = new Set(prev);
            newSet.delete(friend.id);
            return newSet;
          });
        }
      }
    });
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Radius of the Earth in km
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

  const sendProximityAlert = async (friend) => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Friend Nearby!",
          body: `${friend.name || friend.email} is within ${proximityAlerts.distance} miles of you!`,
        },
        trigger: null,
      });
      console.log(`Proximity alert sent for ${friend.name || friend.email}`);
    } catch (error) {
      console.error("Error sending proximity alert:", error);
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
              Finding your friends...
            </Text>
          </View>
        </LinearGradient>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        {location ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: location?.latitude || 0,
              longitude: location?.longitude || 0,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
            onRegionChangeComplete={(region) => {
              if (mapRef.current) {
                mapRef.current.setNativeProps({ region });
              }
            }}
          >
            {location && (
              <Marker
                coordinate={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                }}
                title="Your Location"
              >
                <Image
                  source={{ uri: profilePictureURL }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              </Marker>
            )}
            {friendsData.map((friend) => (
              friend.location && (
                <Marker
                  key={friend.id}
                  coordinate={{
                    latitude: friend.location.latitude,
                    longitude: friend.location.longitude,
                  }}
                  title={friend.name || friend.email}
                >
                  <Image
                    source={{ uri: friend.profilePictureURL || profilePictureURL }}
                    style={{ width: 40, height: 40, borderRadius: 20 }}
                  />
                  <Callout>
                    <View style={styles.calloutContainer}>
                      <Text style={styles.calloutTitle}>{friend.name || friend.email}</Text>
                      <Text style={styles.calloutText}>Email: {friend.email}</Text>
                      <Text style={styles.calloutText}>Last tracked: {friend.lastTracked ? new Date(friend.lastTracked.toDate()).toLocaleString() : 'Unknown'}</Text>
                    </View>
                  </Callout>
                </Marker>
              )
            ))}
            {proximityAlerts.enabled && location && (
              <Circle
                center={{
                  latitude: location.latitude,
                  longitude: location.longitude,
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
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.alertButton}
            onPress={() => {
              if (!isNotificationsEnabled) {
                Alert.alert('Notifications Disabled', 'Please enable notifications in your profile settings to use proximity alerts.');
                return;
              }
              setProximityAlerts(prev => {
                const newState = { ...prev, enabled: !prev.enabled };
                // Update Firestore with the new state
                updateDoc(doc(db, "users", userData.uid), {
                  proximityAlertsEnabled: newState.enabled
                });
                return newState;
              });
            }}
          >
            <Icon name={proximityAlerts.enabled ? "bell" : "bell-slash"} size={24} color="#fff" />
          </TouchableOpacity>
        </View>
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
  calloutContainer: {
    width: 200,
    padding: 10,
  },
  calloutTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  calloutText: {
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 1,
  },
  alertButton: {
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
  },
});