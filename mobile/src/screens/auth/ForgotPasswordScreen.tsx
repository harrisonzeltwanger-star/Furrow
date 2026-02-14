import { useState } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import api from '../../config/api';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import ErrorBanner from '../../components/ui/ErrorBanner';

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AuthStackParamList>>();
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordForm) => {
    try {
      setError('');
      await api.post('/auth/forgot-password', data);
      setSubmitted(true);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } } };
      setError(axiosErr.response?.data?.error?.message || 'Something went wrong. Please try again.');
    }
  };

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
          <Text style={{ fontSize: 28, fontWeight: '700', color: '#3a2a1a' }}>Forgot Password</Text>
          <Text style={{ fontSize: 15, color: '#7a6a5a', marginTop: 4, textAlign: 'center' }}>
            {submitted
              ? 'Check your email for a reset link'
              : "Enter your email and we'll send you a reset link"}
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
          {submitted ? (
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
                If an account with that email exists, a password reset link has been sent. Please check your inbox.
              </Text>
            </View>
          ) : (
            <>
              <ErrorBanner message={error} />

              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Email"
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    error={errors.email?.message}
                    containerStyle={{ marginBottom: 24 }}
                  />
                )}
              />

              <Button onPress={handleSubmit(onSubmit)} loading={isSubmitting} disabled={isSubmitting}>
                {isSubmitting ? 'Sending...' : 'Send Reset Link'}
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
