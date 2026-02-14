import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Location from 'expo-location';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import type { TeamMember, PendingInvite } from '../../types/models';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import Input from '../../components/ui/Input';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';

const roleBadge: Record<string, string> = {
  FARM_ADMIN: 'Admin',
  MANAGER: 'Manager',
  VIEWER: 'Viewer',
};

export default function AccountScreen() {
  const { user, logout, updateUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<{ Team: undefined }>>();
  const isAdmin = user?.role === 'FARM_ADMIN';

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Home address editing
  const [editingAddress, setEditingAddress] = useState(false);
  const [addressInput, setAddressInput] = useState(user?.organizationAddress || '');
  const [savingAddress, setSavingAddress] = useState(false);
  const [locatingForAddress, setLocatingForAddress] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const { data } = await api.get('/users/team');
      setTeam(data.users);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleSaveAddress = async () => {
    if (!addressInput.trim()) return;
    setSavingAddress(true);
    try {
      const { data } = await api.patch('/users/organization/address', {
        address: addressInput.trim(),
      });
      await updateUser({
        organizationAddress: data.address,
        organizationLatitude: data.latitude,
        organizationLongitude: data.longitude,
      });
      setEditingAddress(false);
    } catch {
      Alert.alert('Error', 'Failed to save address.');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleUseLocationForAddress = async () => {
    setLocatingForAddress(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location access is needed.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const address = geo
        ? [geo.streetNumber, geo.street, geo.city, geo.region, geo.postalCode].filter(Boolean).join(', ')
        : `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;

      setSavingAddress(true);
      const { data } = await api.patch('/users/organization/address', { address, latitude, longitude });
      await updateUser({
        organizationAddress: data.address,
        organizationLatitude: data.latitude,
        organizationLongitude: data.longitude,
      });
      setAddressInput(data.address);
      setEditingAddress(false);
    } catch {
      Alert.alert('Error', 'Failed to get location.');
    } finally {
      setLocatingForAddress(false);
      setSavingAddress(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#faf8f4' }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />}
    >
      {/* Profile */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle>My Account</CardTitle>
          <CardDescription>Your profile and organization details</CardDescription>
        </CardHeader>
        <CardContent>
          <View style={{ gap: 12 }}>
            <ProfileRow label="Name" value={user?.name || ''} />
            <ProfileRow label="Email" value={user?.email || ''} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#7a6a5a', textTransform: 'uppercase', letterSpacing: 0.5 }}>Role</Text>
              <Badge variant="default">{roleBadge[user?.role ?? ''] ?? user?.role}</Badge>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 11, color: '#7a6a5a', textTransform: 'uppercase', letterSpacing: 0.5 }}>Organization</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#3a2a1a' }}>{user?.organizationName}</Text>
            </View>
          </View>
        </CardContent>
      </Card>

      {/* Home Address */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 16 }}>Home Address</CardTitle>
          <CardDescription>Your organization's primary address</CardDescription>
        </CardHeader>
        <CardContent>
          {editingAddress ? (
            <View>
              <Input
                value={addressInput}
                onChangeText={setAddressInput}
                placeholder="Enter your address..."
                multiline
                style={{ marginBottom: 10 }}
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
                  onPress={handleSaveAddress}
                  disabled={savingAddress}
                  style={{
                    flex: 1,
                    backgroundColor: '#2d5a27',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    opacity: savingAddress ? 0.6 : 1,
                  }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
                    {savingAddress ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { setEditingAddress(false); setAddressInput(user?.organizationAddress || ''); }}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: '#d8cebb',
                    paddingVertical: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: '#3a2a1a', fontWeight: '500', fontSize: 14 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={handleUseLocationForAddress}
                disabled={locatingForAddress}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 10,
                  paddingVertical: 10,
                  borderWidth: 1,
                  borderColor: '#2d5a27',
                  borderRadius: 8,
                }}
              >
                {locatingForAddress ? (
                  <ActivityIndicator size="small" color="#2d5a27" style={{ marginRight: 8 }} />
                ) : (
                  <Text style={{ fontSize: 16, marginRight: 6 }}>{'\u{1F4CD}'}</Text>
                )}
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#2d5a27' }}>
                  {locatingForAddress ? 'Getting Location...' : 'Use Current Location'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View>
              {user?.organizationAddress ? (
                <Text style={{ fontSize: 14, color: '#3a2a1a', marginBottom: 10 }}>
                  {user.organizationAddress}
                </Text>
              ) : (
                <Text style={{ fontSize: 14, color: '#7a6a5a', marginBottom: 10, fontStyle: 'italic' }}>
                  No address set
                </Text>
              )}
              {isAdmin && (
                <TouchableOpacity
                  onPress={() => { setEditingAddress(true); setAddressInput(user?.organizationAddress || ''); }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: '#d8cebb',
                    borderRadius: 8,
                    alignSelf: 'flex-start',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '500', color: '#2d5a27' }}>
                    {user?.organizationAddress ? 'Edit Address' : 'Set Address'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </CardContent>
      </Card>

      {/* Team Members */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <CardTitle style={{ fontSize: 16 }}>Organization Users</CardTitle>
            {isAdmin && (
              <Button size="sm" onPress={() => navigation.navigate('Team')}>Manage Team</Button>
            )}
          </View>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
            <Text style={{ fontSize: 14, color: '#7a6a5a' }}>No team members found.</Text>
          ) : (
            team.map((member) => {
              const isSelf = member.id === user?.id;
              return (
                <View
                  key={member.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: '#f0ece4',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '500', color: '#3a2a1a' }}>{member.name}</Text>
                      {isSelf && <Text style={{ fontSize: 11, color: '#7a6a5a' }}>(you)</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: '#7a6a5a' }}>{member.email}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge variant={member.role === 'FARM_ADMIN' ? 'default' : 'secondary'}>
                      {roleBadge[member.role] ?? member.role}
                    </Badge>
                    <Badge variant={member.isActive ? 'success' : 'destructive'}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </View>
                </View>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Sign Out */}
      <Button variant="destructive" onPress={handleLogout}>Sign Out</Button>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 11, color: '#7a6a5a', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '500', color: '#3a2a1a' }}>{value}</Text>
    </View>
  );
}
