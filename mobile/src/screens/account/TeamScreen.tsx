import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import api from '../../config/api';
import { useAuth } from '../../hooks/useAuth';
import type { TeamMember, PendingInvite } from '../../types/models';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Badge from '../../components/ui/Badge';
import SelectPicker from '../../components/ui/SelectPicker';
import ErrorBanner from '../../components/ui/ErrorBanner';
import LoadingScreen from '../../components/ui/LoadingScreen';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';

export default function TeamScreen() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'FARM_ADMIN';

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Invite form
  const [inviteType, setInviteType] = useState<'team' | 'admin'>('team');
  const [inviteEmail, setInviteEmail] = useState('');
  const [teamRole, setTeamRole] = useState('MANAGER');
  const [inviteResult, setInviteResult] = useState<{ link: string } | null>(null);
  const [inviteError, setInviteError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [teamRes, invitesRes] = await Promise.all([
        api.get('/users/team'),
        isAdmin ? api.get('/users/invites') : Promise.resolve({ data: { invites: [] } }),
      ]);
      setTeam(teamRes.data.users);
      setInvites(invitesRes.data.invites);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAdmin]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleInvite = async () => {
    setInviteError('');
    setInviteResult(null);
    setSubmitting(true);

    const role = inviteType === 'admin' ? 'FARM_ADMIN' : teamRole;

    try {
      const res = await api.post('/users/invite', { email: inviteEmail, role, type: inviteType });
      setInviteResult({ link: res.data.invite.link });
      setInviteEmail('');
      fetchData();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setInviteError(axiosErr.response?.data?.error?.message || 'Failed to create invite');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInvite = (id: string) => {
    Alert.alert('Cancel Invite', 'Are you sure you want to cancel this invite?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/users/invites/${id}`);
            fetchData();
          } catch {
            // silent
          }
        },
      },
    ]);
  };

  const handleToggleActive = (userId: string, name: string, currentlyActive: boolean) => {
    const action = currentlyActive ? 'deactivate' : 'activate';
    Alert.alert(
      `${currentlyActive ? 'Deactivate' : 'Activate'} User`,
      `${currentlyActive ? 'Deactivate' : 'Activate'} ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentlyActive ? 'Deactivate' : 'Activate',
          onPress: async () => {
            try {
              await api.patch(`/users/${userId}/${action}`);
              fetchData();
            } catch (err: unknown) {
              const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
              Alert.alert('Error', axiosErr.response?.data?.error?.message || 'Action failed');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (userId: string, name: string) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to permanently delete ${name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/users/${userId}`);
              fetchData();
            } catch (err: unknown) {
              const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
              Alert.alert('Error', axiosErr.response?.data?.error?.message || 'Delete failed');
            }
          },
        },
      ]
    );
  };

  const copyLink = async (link: string) => {
    await Clipboard.setStringAsync(link);
    Alert.alert('Copied', 'Invite link copied to clipboard');
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#faf8f4' }}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2d5a27" />}
    >
      {/* Invite Form */}
      {isAdmin && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Invite User</CardTitle>
            <CardDescription>Send an invitation to join your organization</CardDescription>
          </CardHeader>
          <CardContent>
            <ErrorBanner message={inviteError} />

            <SelectPicker
              label="Invite Type"
              value={inviteType}
              options={[
                { label: `Team Member (joins ${user?.organizationName})`, value: 'team' },
                { label: 'New Company Admin (creates own org)', value: 'admin' },
              ]}
              onValueChange={(v) => setInviteType(v as 'team' | 'admin')}
            />
            <View style={{ height: 12 }} />

            <Input
              label="Email"
              placeholder="user@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              containerStyle={{ marginBottom: 12 }}
            />

            {inviteType === 'team' && (
              <>
                <SelectPicker
                  label="Role"
                  value={teamRole}
                  options={[
                    { label: 'Manager', value: 'MANAGER' },
                    { label: 'Viewer', value: 'VIEWER' },
                  ]}
                  onValueChange={setTeamRole}
                />
                <View style={{ height: 12 }} />
              </>
            )}

            <Button onPress={handleInvite} loading={submitting} disabled={!inviteEmail || submitting}>
              Create Invite Link
            </Button>

            {inviteResult && (
              <View style={{
                marginTop: 12,
                backgroundColor: '#e8f5e3',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#b8dbb0',
                padding: 12,
              }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#2d5a27', marginBottom: 8 }}>
                  Invite link created!
                </Text>
                <Text style={{ fontSize: 11, color: '#3a2a1a', marginBottom: 8 }} numberOfLines={2}>
                  {inviteResult.link}
                </Text>
                <Button size="sm" variant="outline" onPress={() => copyLink(inviteResult.link)}>
                  Copy Link
                </Button>
              </View>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Invites */}
      {isAdmin && invites.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <CardHeader>
            <CardTitle style={{ fontSize: 16 }}>Pending Invites</CardTitle>
          </CardHeader>
          <CardContent>
            {invites.map((inv) => (
              <View
                key={inv.id}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f0ece4',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ fontSize: 14, fontWeight: '500', color: '#3a2a1a' }}>{inv.email}</Text>
                  <Badge variant={inv.type === 'admin' ? 'default' : 'secondary'}>
                    {inv.type === 'admin' ? 'Admin' : 'Team'}
                  </Badge>
                </View>
                <Text style={{ fontSize: 11, color: '#7a6a5a', marginBottom: 8 }}>
                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button size="sm" variant="outline" onPress={() => copyLink(inv.link)}>Copy Link</Button>
                  <Button size="sm" variant="destructive" onPress={() => handleCancelInvite(inv.id)}>Cancel</Button>
                </View>
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team Members */}
      <Card style={{ marginBottom: 16 }}>
        <CardHeader>
          <CardTitle style={{ fontSize: 16 }}>Team Members</CardTitle>
        </CardHeader>
        <CardContent>
          {team.map((member) => {
            const isSelf = member.id === user?.id;
            const isFarmAdmin = member.role === 'FARM_ADMIN';
            const canManage = isAdmin && !isSelf && !isFarmAdmin;

            return (
              <View
                key={member.id}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: '#f0ece4',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: '#3a2a1a' }}>{member.name}</Text>
                      {isSelf && <Text style={{ fontSize: 11, color: '#7a6a5a' }}>(you)</Text>}
                    </View>
                    <Text style={{ fontSize: 12, color: '#7a6a5a' }}>{member.email}</Text>
                    <Text style={{ fontSize: 11, color: '#a09080', marginTop: 2 }}>
                      Last login: {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Never'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Badge variant={member.role === 'FARM_ADMIN' ? 'default' : 'secondary'}>
                      {member.role}
                    </Badge>
                    <Badge variant={member.isActive ? 'success' : 'destructive'}>
                      {member.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </View>
                </View>

                {canManage && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleToggleActive(member.id, member.name, member.isActive)}
                    >
                      {member.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onPress={() => handleDeleteUser(member.id, member.name)}
                    >
                      Delete
                    </Button>
                  </View>
                )}
              </View>
            );
          })}
        </CardContent>
      </Card>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}
