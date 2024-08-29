import React, { useState, useEffect } from "react";
import { View, Alert, StyleSheet, TouchableOpacity, Platform, Image, Keyboard, TouchableWithoutFeedback } from "react-native";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, setDoc, doc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Layout, Text, TextInput, Button, themeColor } from "react-native-rapi-ui";
import * as ImagePicker from 'expo-image-picker';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

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

  return (
    <Layout>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAwareScrollView contentContainerStyle={styles.container}>
          <Text size="h2" style={styles.title}>Create Account</Text>
          <TouchableOpacity onPress={pickImage} style={styles.imageContainer}>
            {profilePicture ? (
              <Image source={{ uri: profilePicture }} style={styles.profilePicture} />
            ) : (
              <View style={styles.placeholderImage}>
                <Text size="h4" style={styles.placeholderText}>Add Photo*</Text>
              </View>
            )}
          </TouchableOpacity>
          <TextInput
            containerStyle={styles.input}
            placeholder="Enter your name"
            value={name}
            onChangeText={(text) => setName(text)}
          />
          <TextInput
            containerStyle={styles.input}
            placeholder="Enter email"
            value={email}
            onChangeText={(text) => setEmail(text)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            containerStyle={styles.input}
            placeholder="Enter password"
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
              size="sm"
              style={styles.loginLink}
              onPress={() => navigation.navigate("Login")}
            >
              Log In
            </Text>
          </Text>
        </KeyboardAwareScrollView>
      </TouchableWithoutFeedback>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    marginBottom: 20,
    fontWeight: "bold",
  },
  imageContainer: {
    marginBottom: 20,
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
    backgroundColor: themeColor.gray200,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    color: themeColor.gray800,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 10,
    marginBottom: 10,
  },
  loginText: {
    marginTop: 20,
  },
  loginLink: {
    color: themeColor.primary,
    fontWeight: "bold",
  },
});
