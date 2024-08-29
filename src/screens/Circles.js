import React, { useState, useEffect, useContext } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Layout, Text, Button, TextInput } from 'react-native-rapi-ui';
import { AuthContext } from '../provider/AuthProvider';
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

export default function Circles({ navigation }) {
  const db = getFirestore();
  const { userData, setUserData } = useContext(AuthContext);
  const [newCircleName, setNewCircleName] = useState('');
  const [newFriendEmail, setNewFriendEmail] = useState('');

  useEffect(() => {
    if (!userData.circles) {
      updateDoc(doc(db, 'users', userData.uid), { circles: [] });
    }
  }, []);

  const createCircle = async () => {
    if (newCircleName.trim() === '') {
      Alert.alert('Error', 'Please enter a circle name');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', userData.uid), {
        circles: arrayUnion({ name: newCircleName, friends: [] })
      });
      setNewCircleName('');
      Alert.alert('Success', 'Circle created');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const addFriendToCircle = async (circleName) => {
    if (newFriendEmail.trim() === '') {
      Alert.alert('Error', 'Please enter a friend\'s email');
      return;
    }
    try {
      const updatedCircles = userData.circles.map(circle => {
        if (circle.name === circleName) {
          return { ...circle, friends: [...circle.friends, newFriendEmail] };
        }
        return circle;
      });
      await updateDoc(doc(db, 'users', userData.uid), { circles: updatedCircles });
      setNewFriendEmail('');
      Alert.alert('Success', 'Friend added to circle');
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  return (
    <Layout>
      <ScrollView>
        <View style={{ padding: 20 }}>
          <Text size="h3">Circles</Text>
          
          <TextInput
            placeholder="New Circle Name"
            value={newCircleName}
            onChangeText={setNewCircleName}
          />
          <Button
            text="Create Circle"
            onPress={createCircle}
            style={{ marginTop: 10 }}
          />

          {userData.circles && userData.circles.map((circle, index) => (
            <View key={index} style={{ marginTop: 20 }}>
              <Text size="h4">{circle.name}</Text>
              {circle.friends.map((friend, friendIndex) => (
                <Text key={friendIndex}>{friend}</Text>
              ))}
              <TextInput
                placeholder="Friend's Email"
                value={newFriendEmail}
                onChangeText={setNewFriendEmail}
              />
              <Button
                text="Add Friend"
                onPress={() => addFriendToCircle(circle.name)}
                style={{ marginTop: 10 }}
              />
            </View>
          ))}
        </View>
      </ScrollView>
    </Layout>
  );
}