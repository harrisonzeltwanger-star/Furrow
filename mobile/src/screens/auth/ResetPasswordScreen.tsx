import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../config/api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ErrorBanner from '../../components/ui/ErrorBanner';

const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordScreen() {
  const route = useRoute<RouteProp<AuthStackParamList, 'ResetPassword'>>();
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const token = route.params?.token;

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    try {
      setError('');
      await api.post('/auth/reset-password', { token, password: data.password });
      setSuccess(true);
      setTimeout(() => navigation.navigate('Login'), 3000);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Failed to reset password. Please try again.');
    }
  };

  if (!token) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#faf8f4' }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: '#3a2a1a', marginBottom: 8 }}>Invalid Reset Link</Text>
        <Text style={{ fontSize: 15, color: '#7a6a5a', textAlign: 'center', marginBottom: 24 }}>No reset token was provided.</Text>
        <Button onPress={() => navigation.navigate('Login')}>Go to Login</Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
        style={{ backgroundColor: '#faf8f4' }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={{ alignItems: 'center', marginBottom: 32 }}>
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              backgroundColor: '#2d5a27',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#f0faf0', fontSize: 24, fontWeight: '700' }}>F</Text>
          </View>
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#3a2a1a' }}>Reset Password</Text>
          <Text style={{ fontSize: 15, color: '#7a6a5a', marginTop: 4, textAlign: 'center' }}>
            {success ? 'Your password has been reset' : 'Enter your new password below'}
          </Text>
        </View>

        {/* Form card */}
        <View
          style={{
            backgroundColor: '#fdfcf8',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#d8cebb',
            padding: 24,
          }}
        >
          {success ? (
            <View
              style={{
                backgroundColor: '#e8f5e8',
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 14, color: '#2d5a27' }}>
                Your password has been reset successfully. Redirecting to login...
              </Text>
            </View>
          ) : (
            <>
              <ErrorBanner message={error} />

              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="New Password"
                    placeholder="Minimum 8 characters"
                    secureTextEntry
                    autoComplete="password-new"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.password?.message}
                    containerStyle={{ marginBottom: 16 }}
                  />
                )}
              />

              <Controller
                control={control}
                name="confirmPassword"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Confirm Password"
                    placeholder="Repeat your password"
                    secureTextEntry
                    autoComplete="password-new"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.confirmPassword?.message}
                    containerStyle={{ marginBottom: 24 }}
                  />
                )}
              />

              <Button onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSubmitting}>
                {isSubmitting ? 'Resetting...' : 'Reset Password'}
              </Button>
            </>
          )}

          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text
              style={{ fontSize: 13, color: '#2d5a27', fontWeight: '600' }}
              onPress={() => navigation.navigate('Login')}
            >
              Back to Sign In
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
