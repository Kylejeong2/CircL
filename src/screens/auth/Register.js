import React, { useState, useEffect } from "react";
import { View, Alert, StyleSheet, TouchableOpacity, Image, Keyboard, TouchableWithoutFeedback } from "react-native";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, setDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Layout, Text, TextInput, Button, themeColor } from "react-native-rapi-ui";
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

export default function ({ navigation }) {
  const auth = getAuth();
  const db = getFirestore();
  const storage = getStorage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [profilePicture, setProfilePicture] = useState(null);
  const [name, setName] = useState("");

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Sorry, we need camera roll permissions to make this work!');
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled) {
        setProfilePicture(result.assets[0].uri);
      } else {
        console.log('Image picking cancelled');
      }
    } catch (error) {
      console.error("Error picking image:", error);
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  async function register() {
    if (!profilePicture) {
      Alert.alert("Error", "Please select a profile picture");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Error", "Please enter your email");
      return;
    }
    if (!password.trim()) {
      Alert.alert("Error", "Please enter a password");
      return;
    }
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password);
      const response = await fetch(profilePicture);
      const blob = await response.blob();
      const filename = `profilePictures/${user.uid}/${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      await setDoc(doc(db, "users", user.uid), {
        email: email,
        name: name.trim(),
        profilePictureURL: downloadURL,
        friends: [],
        circles: [],
      });
      console.log("User document created successfully");
      setLoading(false);
    } catch (error) {
      console.error("Registration error:", error);
      setLoading(false);
      Alert.alert("Registration Error", error.message);
    }
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#121212',
    },
    gradientBackground: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      height: '100%',
    },
    content: {
      flex: 1,
      padding: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    title: {
      fontSize: 32,
      fontWeight: "bold",
      color: '#ffffff',
      marginBottom: 30,
      textAlign: 'center',
    },
    imageContainer: {
      marginBottom: 30,
    },
    profilePicture: {
      width: 120,
      height: 120,
      borderRadius: 60,
    },
    placeholderImage: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      justifyContent: "center",
      alignItems: "center",
    },
    placeholderText: {
      color: '#bb86fc',
      fontSize: 16,
    },
    input: {
      marginBottom: 15,
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      borderRadius: 8,
      borderWidth: 0,
      width: '100%',
    },
    inputText: {
      color: '#ffffff',
    },
    button: {
      marginTop: 20,
      marginBottom: 10,
      backgroundColor: '#bb86fc',
      borderRadius: 8,
      width: '100%',
    },
    loginText: {
      marginTop: 20,
      color: '#ffffff',
    },
    loginLink: {
      color: '#bb86fc',
      fontWeight: "bold",
    },
  });

  return (
    <Layout>
      <LinearGradient
        colors={['#1a1a1a', '#121212']}
        style={styles.gradientBackground}
      />
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAwareScrollView contentContainerStyle={styles.container}>
          <View style={styles.content}>
            <Text style={styles.title}>Create Account</Text>
            <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
              ) : (
                <View style={styles.placeholderImage}>
                  <Ionicons name="camera-outline" size={40} color="#bb86fc" />
                  <Text style={styles.placeholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
            <TextInput
              containerStyle={styles.input}
              style={styles.inputText}
              placeholder="Enter your name"
              placeholderTextColor="#999999"
              value={name}
              onChangeText={(text) => setName(text)}
            />
            <TextInput
              containerStyle={styles.input}
              style={styles.inputText}
              placeholder="Enter email"
              placeholderTextColor="#999999"
              value={email}
              onChangeText={(text) => setEmail(text)}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <TextInput
              containerStyle={styles.input}
              style={styles.inputText}
              placeholder="Enter password"
              placeholderTextColor="#999999"
              value={password}
              secureTextEntry
              onChangeText={(text) => setPassword(text)}
            />
            <Button
              text={loading ? "Creating Account..." : "Sign Up"}
              onPress={() => {
                register();
              }}
              style={styles.button}
              disabled={loading || !profilePicture}
            />
            <Text style={styles.loginText}>
              Already have an account?{" "}
              <Text
                style={styles.loginLink}
                onPress={() => navigation.navigate("Login")}
              >
                Log In
              </Text>
            </Text>
          </View>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </Layout>
  );
}
