import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Medication {
    id: string;
    name: string;
    dosage: string;
}

export default function ManageMedicationScreen() {
    const router = useRouter();
    const [medications, setMedications] = useState<Medication[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMedications();
    }, []);

    const fetchMedications = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('medications')
                .select('id, name, dosage')
                .eq('patient_id', user.id)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setMedications(data || []);
        } catch (error) {
            console.error('Error fetching medications:', error);
            Alert.alert('Error', 'Failed to load medications.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (med: Medication) => {
        Alert.alert(
            'Delete Medication',
            `Are you sure you want to permanently delete ${med.name}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            const { error } = await supabase
                                .from('medications')
                                .update({ is_active: false })
                                .eq('id', med.id);

                            if (error) throw error;

                            // Remove from local list
                            setMedications(prev => prev.filter(m => m.id !== med.id));
                            Alert.alert('Success', 'Medication deleted.');
                        } catch (err) {
                            Alert.alert('Error', 'Failed to delete medication.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: Medication }) => (
        <TouchableOpacity
            style={styles.itemContainer}
            onPress={() => router.push({ pathname: '/elderly/medication-edit', params: { id: item.id } })}
        >
            <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.dosage}>{item.dosage}</Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item)}>
                <Ionicons name="trash" size={20} color="#EF4444" />
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Manage Medications</Text>
                <View style={{ width: 24 }} />
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={medications}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No active medications found.</Text>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerTitle: {
        fontFamily: 'Poppins-Bold',
        fontSize: 20,
        color: '#0F172A',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 20,
    },
    itemContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    name: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        color: '#1E293B',
    },
    dosage: {
        fontFamily: 'Poppins-Regular',
        fontSize: 14,
        color: '#64748B',
    },
    deleteButton: {
        padding: 8,
    },
    deleteText: {
        color: '#FFFFFF',
        fontFamily: 'Poppins-Medium',
        fontSize: 14,
    },
    emptyText: {
        textAlign: 'center',
        fontFamily: 'Poppins-Regular',
        color: '#94A3B8',
        marginTop: 40,
    }
});
