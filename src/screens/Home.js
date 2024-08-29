import React, { useState, useEffect, useContext, useRef } from "react";
import { View, StyleSheet, Image } from "react-native";
import { Layout, Text, Picker } from "react-native-rapi-ui";
import * as Location from 'expo-location';
import MapView, { Marker, Circle } from 'react-native-maps';
import { getFirestore, doc, setDoc, onSnapshot, collection, query, where } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { AuthContext } from '../provider/AuthProvider';

export default function ({ navigation }) {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [selectedCircle, setSelectedCircle] = useState(null);
  const [friendLocations, setFriendLocations] = useState({});
  const [circles, setCircles] = useState([]);
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
    }
  }, [userData]);

  useEffect(() => {
    if (userData?.uid) {
      const userRef = doc(db, "users", userData.uid);
      const unsubscribe = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          setCircles(doc.data().circles || []);
        }
      });
      return () => unsubscribe();
    }
  }, [userData]);

  useEffect(() => {
    if (!selectedCircle || !circles) {
      return;
    }

    const circle = circles.find(c => c.name === selectedCircle);
    if (!circle || !circle.members) {
      return;
    }

    const friendEmails = circle.members.filter(email => email !== userData.email);
    const unsubscribes = friendEmails.map(email => 
      onSnapshot(query(collection(db, "users"), where("email", "==", email)), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            setFriendLocations(prev => ({...prev, [email]: change.doc.data().location}));
          }
        });
      })
    );

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, [selectedCircle, circles, db]);

  const updateLocationInFirestore = async (location) => {
    const user = auth.currentUser;
    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          location: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          }
        }, { merge: true });
      } catch (error) {
        console.error("Error updating location in Firestore:", error);
      }
    }
  };

  const proximityDistance = userData?.proximityDistance || 0.5;

  if (isLoading) {
    return (
      <Layout>
        <View style={styles.container}>
          <Text>Loading user data...</Text>
        </View>
      </Layout>
    );
  }

  return (
    <Layout>
      <View style={styles.container}>
        <View style={styles.overlay}>
          {circles.length > 0 ? (
            <Picker
              items={[
                { label: 'Select Circle', value: null },
                ...circles.map(circle => ({ label: circle.name, value: circle.name }))
              ]}
              value={selectedCircle}
              placeholder="Select Circle"
              onValueChange={(val) => setSelectedCircle(val)}
            />
          ) : (
            <Text>No circles available</Text>
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
                source={{ uri: userData.profilePictureURL }}
                style={{ width: 40, height: 40, borderRadius: 20 }}
              />
            </Marker>
            <Circle
              center={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              }}
              radius={proximityDistance * 1609.34}
              fillColor="rgba(0, 0, 255, 0.1)"
              strokeColor="rgba(0, 0, 255, 0.3)"
            />
            {Object.entries(friendLocations).map(([email, friendLocation]) => (
              <Marker
                key={email}
                coordinate={{
                  latitude: friendLocation.latitude,
                  longitude: friendLocation.longitude,
                }}
                title={email}
              >
                <Image
                  source={{ uri: friendLocation.profilePictureURL }}
                  style={{ width: 40, height: 40, borderRadius: 20 }}
                />
              </Marker>
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
});
