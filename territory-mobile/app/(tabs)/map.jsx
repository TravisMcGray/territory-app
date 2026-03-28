import { View, Text } from 'react-native';

export default function MapScreen() {
    return (
        <View style={{ flex: 1, backgroundColor: '#030712', justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#10b981', fontSize: 20, fontWeight: '900' }}>Map Coming Soon</Text>
            <Text style={{ color: '#9ca3af', fontSize: 13, fontWeight: '700', marginTop: 8 }}>
                The unified map will be here
            </Text>
        </View>
    );
}