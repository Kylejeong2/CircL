import React, { useContext, useState, useEffect } from "react";
import { View, StyleSheet, FlatList, TouchableOpacity } from "react-native";
import { Layout, Text, Section, SectionContent, Button, TextInput } from "react-native-rapi-ui";
import { AuthContext } from "../provider/AuthProvider";
import { getFirestore, doc, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";

export default function ({ navigation }) {
	const { userData, setUserData } = useContext(AuthContext);
	const [circles, setCircles] = useState([]);
	const [selectedCircle, setSelectedCircle] = useState(null);
	const [newCircleName, setNewCircleName] = useState('');
	const [newMemberEmail, setNewMemberEmail] = useState('');
	const db = getFirestore();

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

	const createCircle = async () => {
		if (newCircleName.trim() === '') return;
		const userRef = doc(db, "users", userData.uid);
		await updateDoc(userRef, {
			circles: arrayUnion({ name: newCircleName, members: [userData.email] })
		});
		setNewCircleName('');
	};

	const addMemberToCircle = async () => {
		if (!selectedCircle || newMemberEmail.trim() === '') return;
		const userRef = doc(db, "users", userData.uid);
		const updatedCircles = circles.map(circle => {
			if (circle.name === selectedCircle.name) {
				return { ...circle, members: [...circle.members, newMemberEmail] };
			}
			return circle;
		});
		await updateDoc(userRef, { circles: updatedCircles });
		setNewMemberEmail('');
	};

	const removeMemberFromCircle = async (memberEmail) => {
		if (!selectedCircle) return;
		const userRef = doc(db, "users", userData.uid);
		const updatedCircles = circles.map(circle => {
			if (circle.name === selectedCircle.name) {
				return { ...circle, members: circle.members.filter(email => email !== memberEmail) };
			}
			return circle;
		});
		await updateDoc(userRef, { circles: updatedCircles });
	};

	return (
		<Layout>
			<View style={styles.container}>
				<Section>
					<SectionContent>
						<Text fontWeight="bold" style={styles.title}>CircL Management</Text>
						<TextInput
							placeholder="New Circle Name"
							value={newCircleName}
							onChangeText={setNewCircleName}
							style={styles.input}
						/>
						<Button text="Create Circle" onPress={createCircle} style={styles.button} />
					</SectionContent>
				</Section>
				<Section style={styles.section}>
					<SectionContent>
						<Text style={styles.subtitle}>Your Circles</Text>
						<FlatList
							data={circles}
							keyExtractor={(item) => item.name}
							renderItem={({ item }) => (
								<TouchableOpacity onPress={() => setSelectedCircle(item)} style={styles.circleItem}>
									<Text>{item.name}</Text>
								</TouchableOpacity>
							)}
						/>
					</SectionContent>
				</Section>
				{selectedCircle && (
					<Section style={styles.section}>
						<SectionContent>
							<Text style={styles.subtitle}>{selectedCircle.name} Members</Text>
							<FlatList
								data={selectedCircle.members}
								keyExtractor={(item) => item}
								renderItem={({ item }) => (
									<View style={styles.memberItem}>
										<Text>{item}</Text>
										<Button text="Remove" onPress={() => removeMemberFromCircle(item)} type="danger" />
									</View>
								)}
							/>
							<TextInput
								placeholder="New Member Email"
								value={newMemberEmail}
								onChangeText={setNewMemberEmail}
								style={styles.input}
							/>
							<Button text="Add Member" onPress={addMemberToCircle} style={styles.button} />
						</SectionContent>
					</Section>
				)}
			</View>
		</Layout>
	);
}

const styles = StyleSheet.create({
	container: {
		padding: 20,
	},
	title: {
		fontSize: 24,
		marginBottom: 10,
	},
	subtitle: {
		fontSize: 18,
		marginBottom: 10,
	},
	section: {
		marginTop: 20,
	},
	input: {
		marginBottom: 10,
	},
	button: {
		marginBottom: 10,
	},
	circleItem: {
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#ccc',
	},
	memberItem: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		padding: 10,
		borderBottomWidth: 1,
		borderBottomColor: '#ccc',
	},
});
