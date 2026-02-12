import { useState, useEffect } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../config/api';
import { setToken, setRefreshToken, setStoredUser } from '../../utils/storage';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import SelectPicker from '../../components/ui/SelectPicker';
import ErrorBanner from '../../components/ui/ErrorBanner';
import LoadingScreen from '../../components/ui/LoadingScreen';

interface InviteInfo {
  email: string;
  role: string;
  type: 'admin' | 'team';
  organizationName: string | null;
  organizationType: string | null;
}

export default function AcceptInviteScreen() {
  const route = useRoute<RouteProp<AuthStackParamList, 'AcceptInvite'>>();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const token = route.params?.token;

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('');

  useEffect(() => {
    if (!token) {
      setPageError('No invite token provided');
      setLoading(false);
      return;
    }

    api.get(`/users/invite/${token}`)
      .then(({ data }) => setInvite(data.invite))
      .catch((err) => setPageError(err.response?.data?.error?.message || 'Invalid invite link'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleSubmit() {
    setSubmitError('');
    setSubmitting(true);

    try {
      const body: Record<string, string | undefined> = { token, name, password, phone: phone || undefined };
      if (invite?.type === 'admin') {
        body.orgName = orgName;
        body.orgType = orgType;
      }

      const res = await api.post('/users/accept-invite', body);
      const { token: authToken, refreshToken, user } = res.data;
      await setToken(authToken);
      await setRefreshToken(refreshToken);
      await setStoredUser(user);
      // The auth state will pick up the new user
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setSubmitError(axiosErr.response?.data?.error?.message || 'Failed to accept invite');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingScreen message="Validating invite..." />;

  if (pageError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#faf8f4' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#3a2a1a', marginBottom: 8 }}>Invalid Invite</Text>
        <Text style={{ fontSize: 15, color: '#7a6a5a', textAlign: 'center', marginBottom: 24 }}>{pageError}</Text>
        <Button onPress={() => navigation.navigate('Login')}>Go to Login</Button>
      </View>
    );
  }

  if (!invite) return null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }} style={{ backgroundColor: '#faf8f4' }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: '#2d5a27', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#f0faf0', fontSize: 24, fontWeight: '700' }}>F</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#3a2a1a' }}>
            {invite.type === 'admin' ? 'Set Up Your Account' : 'Join the Team'}
          </Text>
          <Text style={{ fontSize: 14, color: '#7a6a5a', marginTop: 4, textAlign: 'center' }}>
            {invite.type === 'admin'
              ? "You've been invited to join Furrow as a new company admin."
              : `You've been invited to join ${invite.organizationName} on Furrow.`}
          </Text>
        </View>

        <View style={{ backgroundColor: '#fdfcf8', borderRadius: 16, borderWidth: 1, borderColor: '#d8cebb', padding: 24 }}>
          <ErrorBanner message={submitError} />

          <View style={{ backgroundColor: '#ede8df', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 13, color: '#7a6a5a' }}>Email: <Text style={{ fontWeight: '600', color: '#3a2a1a' }}>{invite.email}</Text></Text>
          </View>

          <Input label="Full Name" placeholder="Your name" value={name} onChangeText={setName} containerStyle={{ marginBottom: 12 }} />
          <Input label="Password" placeholder="At least 8 characters" secureTextEntry value={password} onChangeText={setPassword} containerStyle={{ marginBottom: 12 }} />
          <Input label="Phone (optional)" placeholder="555-123-4567" keyboardType="phone-pad" value={phone} onChangeText={setPhone} containerStyle={{ marginBottom: 12 }} />

          {invite.type === 'admin' && (
            <>
              <Input label="Organization Name" placeholder="Your company name" value={orgName} onChangeText={setOrgName} containerStyle={{ marginBottom: 12 }} />
              <SelectPicker
                label="Organization Type"
                value={orgType}
                options={[
                  { label: 'Buyer (Feedlot)', value: 'BUYER' },
                  { label: 'Grower (Hay Producer)', value: 'GROWER' },
                  { label: 'Trucking Company', value: 'TRUCKING' },
                ]}
                onValueChange={setOrgType}
                placeholder="Select type..."
              />
              <View style={{ height: 12 }} />
            </>
          )}

          <Button onPress={handleSubmit} loading={submitting} disabled={submitting || !name || !password}>
            {submitting ? 'Creating Account...' : 'Create Account'}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
