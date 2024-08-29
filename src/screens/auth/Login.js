import React, { useState, useRef, useEffect } from "react";
import {
  ScrollView,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Image,
  StyleSheet,
  Platform,
  Animated,
  Keyboard,
} from "react-native";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  Layout,
  Text,
  TextInput,
  Button,
  themeColor,
} from "react-native-rapi-ui";
import { LinearGradient } from 'expo-linear-gradient';

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
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  logo: {
    height: 120,
    width: 120,
    alignSelf: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    borderWidth: 0,
  },
  inputText: {
    color: '#ffffff',
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
  },
  linkText: {
    color: '#bb86fc',
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
});

export default function ({ navigation }) {
  const auth = getAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const titleOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const keyboardWillShowSub = Keyboard.addListener('keyboardWillShow', keyboardWillShow);
    const keyboardWillHideSub = Keyboard.addListener('keyboardWillHide', keyboardWillHide);

    return () => {
      keyboardWillShowSub.remove();
      keyboardWillHideSub.remove();
    };
  }, []);

  const keyboardWillShow = () => {
    Animated.timing(titleOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const keyboardWillHide = () => {
    Animated.timing(titleOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  async function login() {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <LinearGradient
        colors={['#1a1a1a', '#121212']}
        style={styles.gradientBackground}
      />
      <ScrollView 
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          resizeMode="contain"
          style={styles.logo}
          source={require("../../../assets/login.png")}
        />
        <Animated.View style={{ opacity: titleOpacity }}>
          <Text style={styles.title}>Welcome Back</Text>
        </Animated.View>
        <TextInput
          containerStyle={styles.input}
          style={styles.inputText}
          placeholder="Email"
          placeholderTextColor="#999999"
          value={email}
          autoCapitalize="none"
          autoCompleteType="email"
          autoCorrect={false}
          keyboardType="email-address"
          onChangeText={setEmail}
        />
        <TextInput
          containerStyle={styles.input}
          style={styles.inputText}
          placeholder="Password"
          placeholderTextColor="#999999"
          value={password}
          autoCapitalize="none"
          autoCompleteType="password"
          autoCorrect={false}
          secureTextEntry={true}
          onChangeText={setPassword}
        />
        <Button
          text={loading ? "Logging in..." : "Log In"}
          onPress={login}
          style={styles.button}
          disabled={loading}
          color="#bb86fc"
        />
        <View style={styles.footer}>
          <Text style={{ color: '#ffffff' }}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate("Register")}>
            <Text style={styles.linkText}>Sign Up</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("ForgetPassword")} style={{ alignSelf: 'center', marginTop: 10 }}>
          <Text style={styles.linkText}>Forgot Password?</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
