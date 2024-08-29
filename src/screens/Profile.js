import React, { useContext, useState, useEffect } from 'react';
import { View, ScrollView, Alert, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Layout, Text, Button, TextInput } from 'react-native-rapi-ui';
import { AuthContext } from '../provider/AuthProvider';
import { getAuth, updatePassword, deleteUser, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';

export default function ({ navigation }) {
	const auth = getAuth();
	const db = getFirestore();
	const storage = getStorage();
	const { userData, setUserData } = useContext(AuthContext);
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [profileImage, setProfileImage] = useState(null);

	useEffect(() => {
		if (userData?.uid) {
			const userRef = doc(db, "users", userData.uid);
			const unsubscribe = onSnapshot(userRef, (doc) => {
				if (doc.exists()) {
					setProfileImage(doc.data().profilePictureURL);
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
		} catch (error) {
			Alert.alert('Error', error.message);
		} finally {
			setIsLoading(false);
		}
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
});
