import React, { useContext, useState } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Layout, Text, Button, TextInput } from 'react-native-rapi-ui';
import { AuthContext } from '../provider/AuthProvider';
import { getAuth, updatePassword, deleteUser } from 'firebase/auth';
import { getFirestore, doc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function ({ navigation }) {
	const auth = getAuth();
	const db = getFirestore();
	const { userData, setUserData } = useContext(AuthContext);
	const [newPassword, setNewPassword] = useState('');

	const handleChangePassword = async () => {
		try {
			await updatePassword(auth.currentUser, newPassword);
			Alert.alert('Success', 'Password updated successfully');
			setNewPassword('');
		} catch (error) {
			Alert.alert('Error', error.message);
		}
	};

	const handleDeleteAccount = async () => {
		Alert.alert(
			'Delete Account',
			'Are you sure you want to delete your account? This action cannot be undone.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Delete',
					style: 'destructive',
					onPress: async () => {
						try {
							await deleteDoc(doc(db, 'users', auth.currentUser.uid));
							await deleteUser(auth.currentUser);
							// The AuthProvider will handle the sign-out
						} catch (error) {
							Alert.alert('Error', error.message);
						}
					},
				},
			]
		);
	};

	const handleSignOut = async () => {
		try {
			await auth.signOut();
			// The AuthProvider will handle the sign-out
		} catch (error) {
			Alert.alert('Error', error.message);
		}
	};

	return (
		<Layout>
			<ScrollView>
				<View style={{ padding: 20 }}>
					<Text size="h3">Profile</Text>
					<Text style={{ marginTop: 10 }}>Email: {auth.currentUser?.email}</Text>
					
					<Text style={{ marginTop: 20 }}>Change Password</Text>
					<TextInput
						placeholder="New Password"
						value={newPassword}
						onChangeText={setNewPassword}
						secureTextEntry
					/>
					<Button
						text="Change Password"
						onPress={handleChangePassword}
						style={{ marginTop: 10 }}
					/>

					<Button
						text="Delete Account"
						status="danger"
						onPress={handleDeleteAccount}
						style={{ marginTop: 20 }}
					/>

					<Button
						text="Sign Out"
						status="warning"
						onPress={handleSignOut}
						style={{ marginTop: 20 }}
					/>
				</View>
			</ScrollView>
		</Layout>
	);
}
