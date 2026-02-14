import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ErrorBanner from '../../components/ui/ErrorBanner';

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  phone: z.string().optional(),
  organizationName: z.string().min(1, 'Organization name is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterScreen() {
  const { register: registerUser } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [error, setError] = useState('');

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {},
  });

  const onSubmit = async (data: RegisterForm) => {
    try {
      setError('');
      const { confirmPassword: _, ...registerData } = data;
      await registerUser(registerData);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Registration failed');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        style={{ backgroundColor: '#faf8f4' }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: 'center', marginBottom: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 14, backgroundColor: '#2d5a27', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ color: '#f0faf0', fontSize: 24, fontWeight: '700' }}>F</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#3a2a1a' }}>Create Account</Text>
          <Text style={{ fontSize: 15, color: '#7a6a5a', marginTop: 4 }}>Register your organization</Text>
        </View>

        <View style={{ backgroundColor: '#fdfcf8', borderRadius: 16, borderWidth: 1, borderColor: '#d8cebb', padding: 24 }}>
          <ErrorBanner message={error} />

          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Full Name" placeholder="John Doe" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.name?.message} containerStyle={{ marginBottom: 12 }} />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Email" placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.email?.message} containerStyle={{ marginBottom: 12 }} />
            )}
          />

          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Phone (optional)" placeholder="555-0100" keyboardType="phone-pad" onBlur={onBlur} onChangeText={onChange} value={value || ''} containerStyle={{ marginBottom: 12 }} />
            )}
          />

          <Controller
            control={control}
            name="organizationName"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Organization Name" placeholder="Your Farm or Feedlot" onBlur={onBlur} onChangeText={onChange} value={value} error={errors.organizationName?.message} containerStyle={{ marginBottom: 12 }} />
            )}
          />


          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Password" placeholder="Minimum 8 characters" secureTextEntry onBlur={onBlur} onChangeText={onChange} value={value} error={errors.password?.message} containerStyle={{ marginBottom: 12 }} />
            )}
          />

          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input label="Confirm Password" placeholder="Repeat your password" secureTextEntry onBlur={onBlur} onChangeText={onChange} value={value} error={errors.confirmPassword?.message} containerStyle={{ marginBottom: 24 }} />
            )}
          />

          <Button onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Create Account'}
          </Button>

          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ fontSize: 13, color: '#7a6a5a' }}>
              Already have an account?{' '}
              <Text style={{ color: '#2d5a27', fontWeight: '600' }} onPress={() => navigation.navigate('Login')}>
                Sign in
              </Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
