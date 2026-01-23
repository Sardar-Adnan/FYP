import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface MedicationCardProps {
    name: string;
    dosage: string;
    imageUrl?: string;
    status: 'upcoming' | 'taken' | 'missed';
    scheduledTime: string;
    onTake?: () => void;
    onSkip?: () => void;
    onDelete?: () => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({
    name,
    dosage,
    imageUrl,
    status,
    scheduledTime,
    onTake,
    onSkip,
    onDelete,
}) => {
    const getStatusColor = () => {
        switch (status) {
            case 'taken':
                return Colors.success || '#4ADE80'; // Green
            case 'missed':
                return Colors.danger || '#EF4444'; // Red
            default:
                return Colors.primary; // Blue (Upcoming)
        }
    };

    const getStatusText = () => {
        switch (status) {
            case 'taken':
                return 'Taken';
            case 'missed':
                return 'Missed';
            default:
                return 'Scheduled';
        }
    }

    return (
        <View style={[styles.card, { borderLeftColor: getStatusColor() }]}>
            <View style={styles.contentContainer}>
                <View style={styles.infoContainer}>
                    <View style={styles.headerRow}>
                        <Text style={[styles.timeText, { color: getStatusColor() }]}>{scheduledTime}</Text>
                        <View style={[styles.badge, { backgroundColor: getStatusColor() + '20' }]}>
                            <Text style={[styles.badgeText, { color: getStatusColor() }]}>{getStatusText()}</Text>
                        </View>
                    </View>

                    <Text style={styles.name}>{name}</Text>
                    <Text style={styles.dosage}>{dosage}</Text>
                </View>

                {imageUrl && (
                    <Image
                        source={{ uri: imageUrl }}
                        style={styles.image}
                        resizeMode="cover"
                        accessible={true}
                        accessibilityLabel={`Image of ${name} pill`}
                    />
                )}
            </View>

            {status === 'upcoming' && (
                <View style={styles.actionContainer}>
                    <TouchableOpacity
                        style={[styles.actionButton, styles.skipButton]}
                        onPress={onSkip}
                        accessibilityRole="button"
                        accessibilityLabel="Skip medication"
                    >
                        <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.actionButton, styles.takeButton]}
                        onPress={onTake}
                        accessibilityRole="button"
                        accessibilityLabel="Mark as taken"
                    >
                        <Ionicons name="checkmark-circle-outline" size={20} color="white" style={{ marginRight: 4 }} />
                        <Text style={styles.takeButtonText}>I've Taken It</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        borderLeftWidth: 6,
    },
    contentContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoContainer: {
        flex: 1,
        marginRight: 12,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    timeText: {
        fontFamily: 'Poppins-Bold',
        fontSize: 16,
        marginRight: 8,
    },
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    badgeText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 12,
    },
    name: {
        fontFamily: 'Poppins-Bold',
        fontSize: 22,
        color: '#1E293B',
        marginBottom: 4,
    },
    dosage: {
        fontFamily: 'Poppins-Regular',
        fontSize: 16,
        color: '#64748B',
    },
    image: {
        width: 90,
        height: 90,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
    },
    actionContainer: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 12,
    },
    actionButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    takeButton: {
        backgroundColor: Colors.success || '#4ADE80',
    },
    skipButton: {
        backgroundColor: '#F1F5F9',
    },
    takeButtonText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        color: '#FFFFFF',
    },
    skipButtonText: {
        fontFamily: 'Poppins-SemiBold',
        fontSize: 16,
        color: '#64748B',
    },
});
