import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import type { TeamMember, PendingInvite } from '../../types/models';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';

const roleBadge: Record<string, string> = {
  FARM_ADMIN: 'Admin',
  MANAGER: 'Manager',
  VIEWER: 'Viewer',
};

const orgTypeBadge: Record<string, string> = {
  BUYER: 'Buyer',
  GROWER: 'Grower',
  TRUCKING: 'Trucking',
};

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<{ Team: undefined }>>();
  const isAdmin = user?.role === 'FARM_ADMIN';

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#3a2a1a' }}>{user?.organizationName}</Text>
                {user?.organizationType && (
                  <Badge variant="secondary">{orgTypeBadge[user.organizationType] ?? user.organizationType}</Badge>
                )}
              </View>
            </View>
          </View>
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
