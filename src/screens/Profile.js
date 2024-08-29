import React, { useContext, useState, useEffect } from 'react';
import { View, ScrollView, Alert, Image, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Layout, Text, Button, TextInput } from 'react-native-rapi-ui';
import { AuthContext } from '../provider/AuthProvider';
import { getAuth, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from 'firebase/auth';
import { getFirestore, doc, updateDoc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { Picker } from '@react-native-picker/picker';

export default function ({ navigation }) {
	const auth = getAuth();
	const db = getFirestore();
	const storage = getStorage();
	const { userData } = useContext(AuthContext);
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [profileImage, setProfileImage] = useState(null);
	const [proximityAlertsEnabled, setProximityAlertsEnabled] = useState(false);
	const [proximityDistance, setProximityDistance] = useState('0.5');
	const [customDistance, setCustomDistance] = useState('');
	const [isNotificationsEnabled, setIsNotificationsEnabled] = useState(true);
	const [tempProximityDistance, setTempProximityDistance] = useState('0.5');

	useEffect(() => {
		if (userData?.uid) {
			const userRef = doc(db, "users", userData.uid);
			const unsubscribe = onSnapshot(userRef, (doc) => {
				if (doc.exists()) {
					const data = doc.data();
					setProfileImage(data.profilePictureURL);
					setProximityAlertsEnabled(data.proximityAlertsEnabled ?? true);
					setProximityDistance(data.proximityDistance?.toString() || '0.5');
					setTempProximityDistance(data.proximityDistance?.toString() || '0.5');
					setIsNotificationsEnabled(data.isNotificationsEnabled ?? true);
				}
			});
			return () => unsubscribe();
		}
	}, [userData]);

	const handleChangePassword = async () => {
		if (!currentPassword || !newPassword) {
			Alert.alert('Error', 'Please enter both current and new passwords.');
			return;
		}

		setIsLoading(true);
		try {
			const credential = EmailAuthProvider.credential(
				auth.currentUser.email,
				currentPassword
			);
			await reauthenticateWithCredential(auth.currentUser, credential);
			await updatePassword(auth.currentUser, newPassword);
			Alert.alert('Success', 'Password updated successfully');
			setCurrentPassword('');
			setNewPassword('');
		} catch (error) {
			Alert.alert('Error', error.message);
		} finally {
			setIsLoading(false);
		}
	};

	const handleChangeProfilePicture = async () => {
		const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
		
		if (permissionResult.granted === false) {
			Alert.alert('Permission required', 'You need to grant permission to access your photos.');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 1,
		});

		if (!result.canceled) {
			setIsLoading(true);
			try {
				const response = await fetch(result.assets[0].uri);
				const blob = await response.blob();
				const filename = `profilePictures/${auth.currentUser.uid}/${Date.now()}.jpg`;
				const storageRef = ref(storage, filename);
				
				// Upload new profile picture to Firebase Storage
				await uploadBytes(storageRef, blob);
				const downloadURL = await getDownloadURL(storageRef);
				
				// Update user document with new profile picture URL
				await setDoc(doc(db, "users", auth.currentUser.uid), {
					email: auth.currentUser.email,
					profilePictureURL: downloadURL,
				}, { merge: true });
				
				// Update user profile
				await updateProfile(auth.currentUser, { photoURL: downloadURL });
				
				// Delete old profile picture if it exists
				if (profileImage) {
					try {
						const oldImageRef = ref(storage, profileImage);
						await deleteObject(oldImageRef);
					} catch (deleteError) {
						console.log('Error deleting old profile picture:', deleteError);
						// Continue execution even if old picture deletion fails
					}
				}
				
				setProfileImage(downloadURL);
				Alert.alert('Success', 'Profile picture updated successfully');
			} catch (error) {
				console.error('Error updating profile picture:', error);
				Alert.alert('Error', 'Failed to update profile picture. Please try again.');
			} finally {
				setIsLoading(false);
			}
		}
	};

	const handleAddProfilePicture = async () => {
		const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
		
		if (permissionResult.granted === false) {
			Alert.alert('Permission required', 'You need to grant permission to access your photos.');
			return;
		}

		const result = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ImagePicker.MediaTypeOptions.Images,
			allowsEditing: true,
			aspect: [1, 1],
			quality: 1,
		});

		if (!result.canceled) {
			setIsLoading(true);
			try {
				const response = await fetch(result.assets[0].uri);
				const blob = await response.blob();
				const filename = `profilePictures/${auth.currentUser.uid}/${Date.now()}.jpg`;
				const storageRef = ref(storage, filename);
				
				// Upload new profile picture to Firebase Storage
				await uploadBytes(storageRef, blob);
				const downloadURL = await getDownloadURL(storageRef);
				
				// Update user document with new profile picture URL
				await setDoc(doc(db, "users", auth.currentUser.uid), {
					email: auth.currentUser.email,
					profilePictureURL: downloadURL,
				}, { merge: true });
				
				// Update user profile
				await updateProfile(auth.currentUser, { photoURL: downloadURL });
				
				setProfileImage(downloadURL);
				Alert.alert('Success', 'Profile picture added successfully');
			} catch (error) {
				console.error('Error adding profile picture:', error);
				Alert.alert('Error', 'Failed to add profile picture. Please try again.');
			} finally {
				setIsLoading(false);
			}
		}
	};

	const handleDeleteAccount = async () => {
		Alert.alert(
			'Delete Account',
			'To delete your account, you need to re-enter your password for security reasons.',
			[
				{ text: 'Cancel', style: 'cancel' },
				{
					text: 'Continue',
					onPress: () => {
						Alert.prompt(
							'Enter Password',
							'Please enter your current password:',
							[
								{ text: 'Cancel', style: 'cancel' },
								{
									text: 'Delete Account',
									onPress: async (password) => {
										if (!password) {
											Alert.alert('Error', 'Password is required to delete your account.');
											return;
										}
										setIsLoading(true);
										try {
											// Re-authenticate the user before deletion
											const credential = EmailAuthProvider.credential(
												auth.currentUser.email,
												password
											);
											await reauthenticateWithCredential(auth.currentUser, credential);

											// Delete profile picture from storage
											if (profileImage) {
												try {
													const imageRef = ref(storage, profileImage);
													await deleteObject(imageRef);
												} catch (deleteError) {
													console.log('Error deleting profile picture:', deleteError);
													// Continue execution even if picture deletion fails
												}
											}
											
											// Try to delete user data from Firestore
											try {
												await deleteDoc(doc(db, 'users', auth.currentUser.uid));
											} catch (firestoreError) {
												console.error('Error deleting Firestore data:', firestoreError);
												// If Firestore deletion fails, continue with account deletion
											}
											
											// Delete user from Firebase Authentication
											await deleteUser(auth.currentUser);
											
											Alert.alert('Success', 'Your account has been deleted.');
										} catch (error) {
											console.error('Error deleting account:', error);
											if (error.code === 'auth/wrong-password') {
												Alert.alert('Error', 'Incorrect password. Please try again.');
											} else {
												Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
											}
										} finally {
											setIsLoading(false);
										}
									}
								}
							],
							'secure-text'
						);
					}
				}
			]
		);
	};

	const handleSignOut = async () => {
		setIsLoading(true);
		try {
			await auth.signOut();
			// Clear any local state that contains user data
			setCircles([]);
			setSelectedCircle(null);
			setCircleMembersData({});
			// Navigate to the login screen or wherever appropriate
			navigation.navigate('Login');
		} catch (error) {
			Alert.alert('Error', error.message);
		} finally {
			setIsLoading(false);
		}
	};

	const handleProximityAlertsToggle = async (value) => {
		setProximityAlertsEnabled(value);
		await updateDoc(doc(db, "users", userData.uid), {
			proximityAlertsEnabled: value,
			isNotificationsEnabled: value,
		});
		setIsNotificationsEnabled(value);
	};

	const handleProximityDistanceChange = (value) => {
		if (value === 'custom') {
			setTempProximityDistance('custom');
		} else {
			setTempProximityDistance(value);
		}
	};

	const handleSaveAlertDistance = async () => {
		const distance = tempProximityDistance === 'custom' ? parseFloat(customDistance) : parseFloat(tempProximityDistance);
		if (isNaN(distance) || distance <= 0) {
			Alert.alert('Invalid Distance', 'Please enter a valid number greater than 0.');
			return;
		}
		setProximityDistance(distance.toString());
		await updateDoc(doc(db, "users", userData.uid), {
			proximityDistance: distance,
		});
		Alert.alert('Success', 'Alert distance saved successfully.');
	};

	return (
		<Layout>
			<ScrollView contentContainerStyle={styles.container}>
				<View style={styles.profileImageContainer}>
					<TouchableOpacity onPress={profileImage ? handleChangeProfilePicture : handleAddProfilePicture}>
						<Image
							source={profileImage ? { uri: profileImage } : require('../../assets/images/default-profile.jpg')}
							style={styles.profileImage}
						/>
						<Text style={styles.changePhotoText}>
							{profileImage ? 'Change Photo' : 'Add Photo'}
						</Text>
					</TouchableOpacity>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Profile Information</Text>
					<Text style={styles.email}>{auth.currentUser?.email}</Text>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Change Password</Text>
					<TextInput
						containerStyle={styles.input}
						placeholder="Current Password"
						value={currentPassword}
						onChangeText={setCurrentPassword}
						secureTextEntry
					/>
					<TextInput
						containerStyle={styles.input}
						placeholder="New Password"
						value={newPassword}
						onChangeText={setNewPassword}
						secureTextEntry
					/>
					<Button
						text={isLoading ? 'Updating...' : 'Change Password'}
						onPress={handleChangePassword}
						disabled={isLoading}
						style={styles.button}
					/>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Proximity Alerts</Text>
					<View style={styles.row}>
						<Text>Enable Proximity Alerts</Text>
						<Switch
							value={proximityAlertsEnabled}
							onValueChange={handleProximityAlertsToggle}
						/>
					</View>
					<View style={styles.row}>
						<Text>Alert Distance</Text>
						<Picker
							selectedValue={tempProximityDistance}
							style={styles.picker}
							onValueChange={handleProximityDistanceChange}
							enabled={proximityAlertsEnabled}
						>
							<Picker.Item label="0.5 miles" value="0.5" />
							<Picker.Item label="1 mile" value="1" />
							<Picker.Item label="2 miles" value="2" />
							<Picker.Item label="5 miles" value="5" />
							<Picker.Item label="Custom" value="custom" />
						</Picker>
					</View>
					{tempProximityDistance === 'custom' && (
						<View style={styles.row}>
							<TextInput
								containerStyle={styles.input}
								placeholder="Enter custom distance (in miles)"
								value={customDistance}
								onChangeText={setCustomDistance}
								keyboardType="numeric"
								editable={proximityAlertsEnabled}
							/>
						</View>
					)}
					<Button
						text="Save Alert Distance"
						onPress={handleSaveAlertDistance}
						style={styles.button}
						disabled={!proximityAlertsEnabled}
					/>
				</View>

				<View style={styles.section}>
					<Text style={styles.sectionTitle}>Account Actions</Text>
					<Button
						text={isLoading ? 'Signing Out...' : 'Sign Out'}
						status="warning"
						onPress={handleSignOut}
						disabled={isLoading}
						style={styles.button}
					/>
					<Button
						text="Delete Account"
						status="danger"
						onPress={handleDeleteAccount}
						disabled={isLoading}
						style={styles.button}
					/>
				</View>
			</ScrollView>
		</Layout>
	);
}

const styles = StyleSheet.create({
	container: {
		padding: 20,
	},
	profileImageContainer: {
		alignItems: 'center',
		marginBottom: 20,
	},
	profileImage: {
		width: 120,
		height: 120,
		borderRadius: 60,
	},
	changePhotoText: {
		marginTop: 10,
		color: '#007AFF',
		textAlign: 'center',
	},
	section: {
		marginBottom: 30,
	},
	sectionTitle: {
		fontSize: 20,
		fontWeight: 'bold',
		marginBottom: 10,
	},
	email: {
		fontSize: 16,
		color: '#666',
	},
	input: {
		marginBottom: 10,
	},
	button: {
		marginTop: 10,
	},
	row: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 10,
	},
	picker: {
		width: 150,
	},
});
